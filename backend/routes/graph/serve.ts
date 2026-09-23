import { Router, type Response } from 'express'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { workDirectory } from '../../config.ts'
import type { ReqWithBody, ReqWithParams, ReqWithQuery } from '../../types.ts'
import { downloadRepository } from './download.ts'
import { deleteRepository, getFolders } from './files.ts'
import { startJob, streamJob } from './jobs.ts'
import { parseRepository } from './parser.ts'

const router = Router()

router.get('/graph', async (
    req: ReqWithQuery<{ repo: string }>,
    res: Response<string |{error:string}>
) => {
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

        const graph = await readFile(join(workDirectory, repository, 'graph.json'), 'utf8')
        res.type('application/json').send(graph)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            res.status(404).json({ error: 'Saved graph not found. Rebuild this repository.' })
            return
        }

        console.error('Failed to load graph:', error)
        res.status(500).json({
            error: 'Internal server error',
        })
    }
})

router.post('/graph/rebuild', async (
    req: ReqWithBody<{ repo: string }>, 
    res: Response<{ jobId: string }|{error:string}>
) => {
    const repository = req.body?.repo
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
        const id = startJob(async (report) => {
            report({ phase: 'parsing', message: 'Rebuilding project graph' })
            const graph = await parseRepository(join(workDirectory, repository))
            report({ phase: 'saving', message: 'Saving project graph' })
            await writeFile(
                join(workDirectory, repository, 'graph.json'),
                JSON.stringify(graph, null, 2),
                'utf8',
            )
            return { repository }
        })
        res.status(202).json({ jobId: id })
    } catch (error) {
        console.error('Failed to start graph rebuild:', error)
        res.status(500).json({ error: 'Could not start graph rebuild.' })
    }
})

router.post('/repositories/download', (
    req: ReqWithBody<{ url: string, ref: string }>, 
    res: Response<{ jobId: string }|{error:string}>
) => {
    const url = req.body?.url
    const ref = req.body?.ref
    if (typeof url !== 'string' || (ref !== undefined && typeof ref !== 'string')) {
        res.status(400).json({ error: 'A repository URL and optional ref are required.' })
        return
    }

    const id = startJob((report) => downloadRepository(url, ref, report))
    res.status(202).json({ jobId: id })
})

router.delete('/repositories/:repository', async (
    req: ReqWithParams<{ repository: string }>,
    res: Response<{},{error:string}>
) => {
    const repository = req.params.repository
    if (!repository?.trim()) {
        res.status(400).json({ error: 'A repository name is required.' })
        return
    }

    try {
        if (!(await deleteRepository(workDirectory, repository))) {
            res.status(404).json({ error: 'Repository not found.' })
            return
        }
        res.status(204).end()
    } catch (error) {
        console.error('Failed to delete repository:', error)
        res.status(500).json({ error: 'Could not delete the repository.' })
    }
})

router.get('/jobs/:id/events', (req, res) => {
    if (!streamJob(req.params.id, res)) res.status(404).json({ error: 'Job not found.' })
})

router.get('/projects', async (_, res: Response<string[] | { error: string }>) => {
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
