import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiPreferencesProvider } from '../frontend/providers/preferences.ts'

test('coalesces preference changes while a save is in flight', async () => {
    const originalFetch = globalThis.fetch
    const postBodies: string[] = []
    let releaseFirstPost = () => {}
    const firstPost = new Promise<void>((resolve) => {
        releaseFirstPost = resolve
    })

    globalThis.fetch = (async (_input, init) => {
        if (init?.method !== 'POST') return Response.json({})

        postBodies.push(String(init.body))
        if (postBodies.length === 1) await firstPost
        return Response.json({ success: true })
    }) as typeof fetch

    try {
        const provider = await createApiPreferencesProvider()
        provider.store('repo-view:ui', { sidebarWidth: 501 })
        provider.store('repo-view:ui', { sidebarWidth: 502 })
        provider.store('repo-view:ui', { sidebarWidth: 503 })

        assert.equal(postBodies.length, 1)
        releaseFirstPost()

        await assert.doesNotReject(async () => {
            const timeoutAt = Date.now() + 1_000
            while (postBodies.length < 2) {
                if (Date.now() >= timeoutAt) throw new Error('Timed out waiting for the final save')
                await new Promise((resolve) => setTimeout(resolve, 1))
            }
        })

        assert.equal(postBodies.length, 2)
        assert.deepEqual(JSON.parse(postBodies[1]!), {
            'repo-view:ui': { sidebarWidth: 503 },
        })
    } finally {
        globalThis.fetch = originalFetch
    }
})
