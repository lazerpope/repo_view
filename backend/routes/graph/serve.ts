import { Router } from 'express'
import { readFile } from 'node:fs/promises'
import { workDirectory } from '../../config.ts'
import { join } from 'node:path'
import { getFolders } from './files.ts'

const router = Router()

async function readGraph(repository: string) {
    const graphFile = join(workDirectory, repository, 'graph.json')
    return readFile(graphFile, 'utf8')
}

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

        res.type('application/json').send(await readGraph(repository))
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            res.status(404).json({ error: 'Graph data not found for this repository.' })
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
