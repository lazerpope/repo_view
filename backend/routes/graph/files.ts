import { readdir, rm } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
export async function getFolders(path: string, includeEmpty = false) {
    const entries = await readdir(path, { withFileTypes: true })
    if (includeEmpty) {
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    }

    const result = []

    for (const folder of entries.filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith('.download-'),
    )) {
        const fullPath = join(path, folder.name)
        const contents = await readdir(fullPath)

        if (contents.length > 0) {
            result.push(folder.name)
        }
    }

    return result
}

export async function deleteRepository(path: string, repository: string): Promise<boolean> {
    const repositories = await getFolders(path)
    if (!repositories.includes(repository)) return false

    const root = resolve(path)
    const target = resolve(root, repository)
    const relativeTarget = relative(root, target)
    if (
        !relativeTarget ||
        relativeTarget === '..' ||
        relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
        isAbsolute(relativeTarget)
    ) {
        throw new Error('Refusing to delete a path outside the repository directory.')
    }

    await rm(target, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 })
    return true
}
