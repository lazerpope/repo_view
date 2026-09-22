import { Router } from 'express'
import type { Structure } from '../../../shared/types.ts'
import { readFile, writeFile } from 'node:fs/promises'
import { workDirectory } from '../../config.ts'
import { join } from 'node:path'
import {getFolders} from './files.ts'

const graphFile = join(workDirectory, 'graph.json')

const router = Router()

async function readGraph() {
    try {
        return await readFile(graphFile, 'utf8')
    } catch (error) {
        console.log('readGraph: ', error)
        return ''
    }
}

router.get('/graph', async (req, res) => {
    
    
    try {
        res.send(await readGraph())
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
        })
    }
})

router.get('/projects', async (req, res) => {
    
    const folders = await getFolders(workDirectory)
    console.log(folders);
    
    
    try {
        res.send( folders)
    } catch (error) {
        res.status(500).json({
            error: 'Internal server error',
        })
    }
})

export default router
