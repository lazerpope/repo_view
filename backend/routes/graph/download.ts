import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { openPromise, type Entry, type ZipFile } from 'yauzl'
import { workDirectory } from '../../config.ts'
import { parseRepository } from './parser.ts'
import type { JobReporter } from './jobs.ts'

const maximumArchiveBytes = 100 * 1024 * 1024
const maximumExtractedBytes = 750 * 1024 * 1024
const maximumEntryBytes = 100 * 1024 * 1024
const maximumEntries = 50_000

interface RepositorySource {
    provider: 'github' | 'gitlab'
    project: string
    repository: string
    canonicalUrl: string
    refCandidates: string[]
}

interface ResolvedSource extends RepositorySource {
    requestedRef: string
    resolvedCommit: string
    archiveUrl: string
}

function decodeSegments(pathname: string): string[] {
    return pathname
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment))
}

function possibleRefs(parts: string[]): string[] {
    const candidates = Array.from({ length: parts.length }, (_, index) =>
        parts.slice(0, parts.length - index).join('/'),
    ).filter(Boolean)
    return candidates.length <= 20
        ? candidates
        : [...candidates.slice(0, 10), ...candidates.slice(-10)]
}

function refsFromPath(action: string | undefined, parts: string[]): string[] {
    if (action === 'commit') return [parts[0] ?? '']
    if (action === 'tree' || action === 'blob') return possibleRefs(parts)
    return []
}

export function parseRepositoryUrl(value: string, explicitRef?: string): RepositorySource {
    const url = new URL(value)
    if (url.protocol !== 'https:') throw new Error('Repository URL must use HTTPS.')
    const segments = decodeSegments(url.pathname)

    if (url.hostname === 'github.com') {
        if (segments.length < 2) throw new Error('GitHub URL must include an owner and repository.')
        const owner = segments[0]!
        const repository = segments[1]!.replace(/\.git$/, '')
        const action = segments[2]
        const urlRef = refsFromPath(action, segments.slice(3))
        return {
            provider: 'github',
            project: `${owner}/${repository}`,
            repository,
            canonicalUrl: `https://github.com/${owner}/${repository}`,
            refCandidates: explicitRef?.trim() ? [explicitRef.trim()] : urlRef.filter(Boolean),
        }
    }

    if (url.hostname === 'gitlab.com') {
        const separator = segments.indexOf('-')
        const projectParts = separator >= 0 ? segments.slice(0, separator) : segments
        if (projectParts.length < 2) {
            throw new Error('GitLab URL must include a namespace and repository.')
        }
        const repository = projectParts.at(-1)!.replace(/\.git$/, '')
        projectParts[projectParts.length - 1] = repository
        const action = separator >= 0 ? segments[separator + 1] : undefined
        const remainder = separator >= 0 ? segments.slice(separator + 2) : []
        const urlRef = refsFromPath(action, remainder)
        return {
            provider: 'gitlab',
            project: projectParts.join('/'),
            repository,
            canonicalUrl: `https://gitlab.com/${projectParts.join('/')}`,
            refCandidates: explicitRef?.trim() ? [explicitRef.trim()] : urlRef.filter(Boolean),
        }
    }

    throw new Error('Only github.com and gitlab.com repository URLs are supported.')
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'repo-view' },
        signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`)
    return (await response.json()) as Record<string, unknown>
}

async function resolveSource(source: RepositorySource): Promise<ResolvedSource> {
    if (source.provider === 'github') {
        const base = `https://api.github.com/repos/${source.project}`
        const metadata = await fetchJson(base)
        const candidates = source.refCandidates.length
            ? source.refCandidates
            : [String(metadata.default_branch)]
        for (const candidate of candidates) {
            const response = await fetch(`${base}/commits/${encodeURIComponent(candidate)}`, {
                headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'repo-view' },
                signal: AbortSignal.timeout(20_000),
            })
            if (!response.ok) continue
            const commit = (await response.json()) as Record<string, unknown>
            const sha = String(commit.sha)
            return {
                ...source,
                requestedRef: candidate,
                resolvedCommit: sha,
                archiveUrl: `${base}/zipball/${encodeURIComponent(sha)}`,
            }
        }
        throw new Error('Could not resolve the requested GitHub branch, tag, or commit.')
    }

    const projectId = encodeURIComponent(source.project)
    const base = `https://gitlab.com/api/v4/projects/${projectId}`
    const metadata = await fetchJson(base)
    const candidates = source.refCandidates.length
        ? source.refCandidates
        : [String(metadata.default_branch)]
    for (const candidate of candidates) {
        const response = await fetch(
            `${base}/repository/commits/${encodeURIComponent(candidate)}`,
            { headers: { 'User-Agent': 'repo-view' }, signal: AbortSignal.timeout(20_000) },
        )
        if (!response.ok) continue
        const commit = (await response.json()) as Record<string, unknown>
        const sha = String(commit.id)
        return {
            ...source,
            requestedRef: candidate,
            resolvedCommit: sha,
            archiveUrl: `${base}/repository/archive.zip?sha=${encodeURIComponent(sha)}`,
        }
    }
    throw new Error('Could not resolve the requested GitLab branch, tag, or commit.')
}

function trustedDownloadHost(hostname: string): boolean {
    return (
        hostname === 'api.github.com' ||
        hostname === 'codeload.github.com' ||
        hostname.endsWith('.githubusercontent.com') ||
        hostname === 'gitlab.com'
    )
}

async function downloadArchive(
    url: string,
    destination: string,
    provider: RepositorySource['provider'],
    report: JobReporter,
) {
    const response = await fetch(url, {
        headers: {
            Accept: provider === 'github' ? 'application/vnd.github+json' : 'application/zip',
            'User-Agent': 'repo-view',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok || !response.body) {
        throw new Error(`Archive download returned HTTP ${response.status}.`)
    }
    if (!trustedDownloadHost(new URL(response.url).hostname)) {
        throw new Error('Archive redirected to an untrusted host.')
    }

    const total = Number(response.headers.get('content-length')) || 0
    if (total > maximumArchiveBytes) throw new Error('Repository archive is too large.')
    let received = 0
    const progress = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length
            if (received > maximumArchiveBytes) {
                callback(new Error('Repository archive exceeded the download limit.'))
                return
            }
            report({
                phase: 'downloading',
                message: 'Downloading repository',
                percent: total ? Math.min(99, Math.round((received / total) * 100)) : undefined,
            })
            callback(null, chunk)
        },
    })
    await pipeline(response.body, progress, createWriteStream(destination))
}

function safeArchivePath(fileName: string): string {
    if (fileName.includes('\0') || fileName.includes('\\')) throw new Error('Unsafe archive path.')
    const normalized = normalize(fileName).replaceAll('\\', '/')
    if (normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../')) {
        throw new Error('Archive contains a path outside its root.')
    }
    return normalized
}

function isLink(entry: Entry): boolean {
    const mode = (entry.externalFileAttributes >>> 16) & 0o170000
    return mode === 0o120000 || mode === 0o060000
}

async function openEntry(zip: ZipFile, entry: Entry) {
    return new Promise<NodeJS.ReadableStream>((resolveStream, reject) => {
        zip.openReadStream(entry, (error, stream) => {
            if (error) reject(error)
            else resolveStream(stream)
        })
    })
}

async function extractArchive(archivePath: string, destination: string, report: JobReporter) {
    const zip = await openPromise(archivePath, { lazyEntries: true, validateEntrySizes: true })
    if (zip.entryCount > maximumEntries) throw new Error('Repository contains too many files.')
    let extractedBytes = 0
    let processedEntries = 0

    await new Promise<void>((resolveExtraction, reject) => {
        const fail = (error: unknown) => {
            zip.close()
            reject(error)
        }
        zip.on('error', fail)
        zip.on('end', resolveExtraction)
        zip.on('entry', (entry: Entry) => {
            void (async () => {
                const archivePath = safeArchivePath(entry.fileName)
                const relativePath = archivePath.split('/').slice(1).join('/')
                processedEntries += 1
                if (!relativePath) {
                    zip.readEntry()
                    return
                }
                if (isLink(entry)) throw new Error('Repository archives may not contain links.')
                if (entry.uncompressedSize > maximumEntryBytes) {
                    throw new Error(`Archive entry is too large: ${relativePath}`)
                }
                extractedBytes += entry.uncompressedSize
                if (extractedBytes > maximumExtractedBytes) {
                    throw new Error('Extracted repository exceeded the size limit.')
                }

                const target = resolve(destination, relativePath)
                if (
                    target !== destination &&
                    !target.startsWith(
                        `${resolve(destination)}${process.platform === 'win32' ? '\\' : '/'}`,
                    )
                ) {
                    throw new Error('Archive entry escaped the extraction directory.')
                }
                if (entry.fileName.endsWith('/')) {
                    await mkdir(target, { recursive: true })
                } else {
                    await mkdir(dirname(target), { recursive: true })
                    const stream = await openEntry(zip, entry)
                    await pipeline(stream, createWriteStream(target, { flags: 'wx' }))
                }
                report({
                    phase: 'extracting',
                    message: 'Extracting repository',
                    percent: Math.round((processedEntries / zip.entryCount) * 100),
                })
                zip.readEntry()
            })().catch(fail)
        })
        zip.readEntry()
    })
}

async function availableRepositoryName(base: string): Promise<string> {
    const safeBase = base.replace(/[^a-zA-Z0-9._-]+/g, '--').replace(/^\.+/, '') || 'repository'
    for (let suffix = 0; suffix < 10_000; suffix += 1) {
        const candidate = suffix ? `${safeBase}-${suffix + 1}` : safeBase
        try {
            await stat(join(workDirectory, candidate))
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return candidate
            throw error
        }
    }
    throw new Error('Could not allocate a repository folder.')
}

export async function downloadRepository(
    url: string,
    ref: string | undefined,
    report: JobReporter,
): Promise<{ repository: string }> {
    await mkdir(workDirectory, { recursive: true })
    const temporaryRoot = await mkdtemp(join(workDirectory, '.download-'))
    const archivePath = join(temporaryRoot, 'repository.zip')
    const extractedPath = join(temporaryRoot, 'repository')

    try {
        report({ phase: 'resolving', message: 'Resolving repository and ref' })
        const source = await resolveSource(parseRepositoryUrl(url, ref))
        await mkdir(extractedPath)
        await downloadArchive(source.archiveUrl, archivePath, source.provider, report)
        report({ phase: 'extracting', message: 'Extracting repository', percent: 0 })
        await extractArchive(archivePath, extractedPath, report)
        report({ phase: 'parsing', message: 'Building project graph' })
        const graph = await parseRepository(extractedPath)
        report({ phase: 'saving', message: 'Saving repository and graph' })
        await writeFile(join(extractedPath, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8')
        await mkdir(join(extractedPath, '.repograph'), { recursive: true })
        await writeFile(
            join(extractedPath, '.repograph', 'source.json'),
            JSON.stringify(
                {
                    provider: source.provider,
                    source: source.canonicalUrl,
                    requestedRef: source.requestedRef,
                    resolvedCommit: source.resolvedCommit,
                    downloadedAt: new Date().toISOString(),
                },
                null,
                2,
            ),
            'utf8',
        )
        const repository = await availableRepositoryName(
            `${source.project.replaceAll('/', '--')}--${source.resolvedCommit.slice(0, 7)}`,
        )
        await rename(extractedPath, join(workDirectory, repository))
        return { repository }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
    }
}
