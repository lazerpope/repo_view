import { Router } from 'express'
import { workDirectory } from '../../config.ts'
import { join } from 'node:path'
import { getFolders } from './files.ts'
import { parseRepository } from './parser.ts'

const router = Router()

router.get('/graph', async (req, res) => {
    const repository = req.query.repo
    if (typeof repository !== 'string' || !repository.trim()) {
        res.status(400).json({ error: 'A repository name is required.' })
        return
    }

    try {
        const projects = await getFolders(workDirectory)
        if (!projects.includes(repository)) {
            res.status(404).json({ error: 'Repository not found.' })
            return
        }

        res.json(await parseRepository(join(workDirectory, repository)))
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            res.status(404).json({ error: 'Repository files not found.' })
            return
        }

        console.error('Failed to load graph:', error)
        res.status(500).json({
            error: 'Internal server error',
        })
    }
})

router.get('/projects', async (req, res) => {
    try {
        res.json(await getFolders(workDirectory))
    } catch (error) {
        console.error('Failed to list projects:', error)
        res.status(500).json({
            error: 'Internal server error',
        })
    }
})

export default router
