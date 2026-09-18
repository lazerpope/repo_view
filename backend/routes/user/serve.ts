import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Router } from 'express'
import { workDirectory } from '../../config.ts'

const router = Router()
const preferencesFile = join(workDirectory, 'prefs')
let pendingWrite = Promise.resolve()

type Preferences = Record<string, unknown>

async function readPreferences(): Promise<Preferences> {
    try {
        const contents = await readFile(preferencesFile, 'utf8')
        const value: unknown = JSON.parse(contents)
        return value !== null && typeof value === 'object' && !Array.isArray(value)
            ? (value as Preferences)
            : {}
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
        throw error
    }
}

function savePreferences(preferences: Preferences): Promise<void> {
    const write = pendingWrite.then(async () => {
        await mkdir(workDirectory, { recursive: true })
        await writeFile(preferencesFile, JSON.stringify(preferences, null, 2), 'utf8')
    })

    pendingWrite = write.catch(() => undefined)
    return write
}

router.get('/', async (_req, res) => {
    try {
        await pendingWrite
        res.status(200).json(await readPreferences())
    } catch (error) {
        console.error('Failed to load user preferences:', error)
        res.status(500).json({ error: 'Internal server error on GET /user' })
    }
})

router.post('/', async (req, res) => {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
        res.status(400).json({ error: 'Preferences must be a JSON object' })
        return
    }

    try {
        await savePreferences(req.body as Preferences)
        res.status(200).json({ success: true })
    } catch (error) {
        console.error('Failed to save user preferences:', error)
        res.status(500).json({ error: 'Internal server error on POST /user' })
    }
})

export default router
