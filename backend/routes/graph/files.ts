import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
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
