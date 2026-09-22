import { randomUUID } from 'node:crypto'
import type { Response } from 'express'

export type JobPhase =
    | 'queued'
    | 'resolving'
    | 'downloading'
    | 'extracting'
    | 'parsing'
    | 'saving'
    | 'complete'
    | 'error'

export interface JobState {
    id: string
    phase: JobPhase
    message: string
    percent?: number
    repository?: string
}

export type JobReporter = (update: Omit<Partial<JobState>, 'id'>) => void

interface JobRecord {
    state: JobState
    listeners: Set<(state: JobState) => void>
}

const jobs = new Map<string, JobRecord>()

function sendEvent(response: Response, state: JobState) {
    response.write(`data: ${JSON.stringify(state)}\n\n`)
}

export function startJob(task: (report: JobReporter) => Promise<{ repository?: string }>): string {
    const id = randomUUID()
    const record: JobRecord = {
        state: { id, phase: 'queued', message: 'Queued' },
        listeners: new Set(),
    }
    jobs.set(id, record)

    const report: JobReporter = (update) => {
        record.state = { ...record.state, ...update, id }
        for (const listener of record.listeners) listener(record.state)
    }

    queueMicrotask(() => {
        void task(report)
            .then((result) => {
                report({
                    phase: 'complete',
                    message: 'Complete',
                    percent: 100,
                    repository: result.repository,
                })
            })
            .catch((error: unknown) => {
                console.error('Repository job failed:', error)
                report({
                    phase: 'error',
                    message: error instanceof Error ? error.message : 'Unknown job error.',
                })
            })
            .finally(() => setTimeout(() => jobs.delete(id), 10 * 60_000))
    })

    return id
}

export function streamJob(id: string, response: Response): boolean {
    const job = jobs.get(id)
    if (!job) return false

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()

    const listener = (state: JobState) => sendEvent(response, state)
    job.listeners.add(listener)
    sendEvent(response, job.state)
    const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 15_000)

    response.on('close', () => {
        clearInterval(keepAlive)
        job.listeners.delete(listener)
    })
    return true
}
