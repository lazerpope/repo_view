import { readFile, readdir } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import type { File, Import, Structure } from '../../../shared/types.ts'
import { parseJS } from './parsers/jsLike.ts'
import { parsePython } from './parsers/python.ts'

export type FileParser = (code: string) => Import[]

function normalizeExtension(extension: string): string {
    return extension.trim().replace(/^\./, '').toLowerCase()
}

function normalizePath(path: string): string {
    return path
        .replaceAll('\\', '/')
        .replace(/^\.\//, '')
        .replace(/^\/+|\/+$/g, '')
}

export class Parser {
    readonly #parsers = new Map<string, FileParser>()

    for(extensions: string | string[]) {
        const normalized = (Array.isArray(extensions) ? extensions : [extensions]).map(
            normalizeExtension,
        )

        return {
            register: (fileParser: FileParser) => {
                for (const extension of normalized) {
                    if (!extension) throw new Error('A parser extension cannot be empty.')
                    this.#parsers.set(extension, fileParser)
                }
                return this
            },
        }
    }

    has(extension: string): boolean {
        return this.#parsers.has(normalizeExtension(extension))
    }

    parse(extension: string, code: string): Import[] {
        const fileParser = this.#parsers.get(normalizeExtension(extension))
        return fileParser ? fileParser(code) : []
    }

    get extensions(): string[] {
        return [...this.#parsers.keys()]
    }
}

export const parser = new Parser()

parser.for('py').register(parsePython)
parser.for(['js', 'ts']).register(parseJS)
parser.for(['jsx', 'tsx']).register(parseJS)
parser.for('vue').register(parseJS)

const ignoredFolders = new Set([
    '.git',
    '.next',
    '.nuxt',
    '.repograph',
    '.venv',
    '.vitepress',
    '__pycache__',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'venv',
])

interface DiscoveredFile {
    entry: File
    absolutePath: string
    relativePath: string
}

interface DiscoveryResult {
    structure: Structure
    files: DiscoveredFile[]
}

async function discoverRepository(rootPath: string, registry: Parser): Promise<DiscoveryResult> {
    const repositoryRoot = resolve(rootPath)
    const files: DiscoveredFile[] = []

    const visit = async (directory: string): Promise<Structure> => {
        const entries = await readdir(directory, { withFileTypes: true })
        entries.sort((left, right) => left.name.localeCompare(right.name))
        const structure: Structure = []

        for (const entry of entries) {
            const absolutePath = join(directory, entry.name)
            if (entry.isDirectory()) {
                if (ignoredFolders.has(entry.name)) continue
                const contains = await visit(absolutePath)
                if (contains.length) structure.push({ type: 'folder', label: entry.name, contains })
                continue
            }
            if (!entry.isFile()) continue

            const extension = normalizeExtension(extname(entry.name))
            if (!registry.has(extension)) continue

            const file: File = {
                type: 'file',
                label: entry.name,
                extension,
                imports: [],
            }
            structure.push(file)
            files.push({
                entry: file,
                absolutePath,
                relativePath: normalizePath(relative(repositoryRoot, absolutePath)),
            })
        }

        return structure
    }

    return { structure: await visit(repositoryRoot), files }
}

export async function createFileStructure(
    rootPath: string,
    registry: Parser = parser,
): Promise<Structure> {
    return (await discoverRepository(rootPath, registry)).structure
}

function buildFileIndex(files: DiscoveredFile[]) {
    const aliases = new Map<string, Set<string>>()

    const addAlias = (alias: string, filePath: string) => {
        const key = normalizePath(alias)
        if (!key) return
        const matches = aliases.get(key) ?? new Set<string>()
        matches.add(filePath)
        aliases.set(key, matches)
    }

    for (const file of files) {
        const filePath = normalizePath(file.relativePath)
        const extension = extname(filePath)
        const withoutExtension = extension ? filePath.slice(0, -extension.length) : filePath
        addAlias(filePath, filePath)
        addAlias(withoutExtension, filePath)

        const stem = basename(withoutExtension)
        if (stem === 'index' || stem === '__init__') addAlias(dirname(withoutExtension), filePath)
    }

    return (candidate: string): string | null => {
        const normalized = normalizePath(candidate)
        const direct = aliases.get(normalized)
        if (direct?.size === 1) return [...direct][0]!

        const extension = extname(normalized)
        if (extension) {
            const withoutExtension = aliases.get(normalized.slice(0, -extension.length))
            if (withoutExtension?.size === 1) return [...withoutExtension][0]!
        }
        return null
    }
}

function localCandidates(imported: string, source: DiscoveredFile): string[] {
    const clean = imported.split(/[?#]/, 1)[0] ?? imported
    const sourceDirectory = dirname(source.relativePath)

    if (source.entry.extension === 'py') {
        const relativeMatch = clean.match(/^(\.+)(.*)$/)
        if (relativeMatch) {
            let base = sourceDirectory
            for (let level = 1; level < relativeMatch[1].length; level += 1) {
                base = dirname(base)
            }
            return [normalizePath(join(base, relativeMatch[2].replaceAll('.', '/')))]
        }
        return rootedCandidates(clean.replaceAll('.', '/'), sourceDirectory)
    }

    if (clean.startsWith('@/'))
        return rootedCandidates(join('src', clean.slice(2)), sourceDirectory)
    if (clean.startsWith('~/')) return rootedCandidates(clean.slice(2), sourceDirectory)
    if (clean.startsWith('/')) return [normalizePath(clean)]
    if (clean.startsWith('.')) return [normalizePath(join(sourceDirectory, clean))]
    return rootedCandidates(clean, sourceDirectory)
}

function rootedCandidates(imported: string, sourceDirectory: string): string[] {
    const candidates: string[] = []
    let directory = normalizePath(sourceDirectory)

    while (directory && directory !== '.') {
        candidates.push(normalizePath(join(directory, imported)))
        const parent = normalizePath(dirname(directory))
        if (!parent || parent === directory || parent === '.') break
        directory = parent
    }
    candidates.push(normalizePath(imported))
    return [...new Set(candidates)]
}

function resolveImport(
    imported: Import,
    source: DiscoveredFile,
    findFile: (candidate: string) => string | null,
): Import {
    if (imported.type === 'lib-builtin') return imported

    const candidates = localCandidates(imported.label, source)
    const localFile = candidates.map(findFile).find((match) => match !== null)
    if (localFile) return { type: 'file', label: localFile }

    if (imported.type === 'file') {
        return { type: 'file', label: candidates.at(-1) ?? imported.label }
    }
    if (source.entry.extension === 'py') {
        return { ...imported, label: imported.label.split('.')[0] ?? imported.label }
    }
    if (imported.type === 'lib-external') {
        const parts = imported.label.split('/')
        const label = imported.label.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
        return { ...imported, label: label ?? imported.label }
    }
    return imported
}

export async function parseRepository(
    rootPath: string,
    registry: Parser = parser,
): Promise<Structure> {
    const discovered = await discoverRepository(rootPath, registry)
    const findFile = buildFileIndex(discovered.files)

    await Promise.all(
        discovered.files.map(async (file) => {
            const code = await readFile(file.absolutePath, 'utf8')
            const imports = registry
                .parse(file.entry.extension ?? '', code)
                .map((imported) => resolveImport(imported, file, findFile))
            file.entry.imports = [
                ...new Map(
                    imports.map((imported) => [`${imported.type}:${imported.label}`, imported]),
                ).values(),
            ]
        }),
    )

    return discovered.structure
}

export default parser
