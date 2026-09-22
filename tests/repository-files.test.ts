import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { deleteRepository, getFolders } from '../backend/routes/graph/files.ts'

test('deletes a listed repository and its underlying folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'repo-view-delete-'))
    const repository = join(root, 'example')

    try {
        await mkdir(join(repository, 'src'), { recursive: true })
        await writeFile(join(repository, 'src', 'app.ts'), 'export {}', 'utf8')
        assert.deepEqual(await getFolders(root), ['example'])

        assert.equal(await deleteRepository(root, 'example'), true)
        await assert.rejects(access(repository), { code: 'ENOENT' })
        assert.equal(await deleteRepository(root, 'example'), false)
    } finally {
        await rm(root, { recursive: true, force: true })
    }
})

test('does not delete a path that is not a listed repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'repo-view-delete-'))
    const outside = await mkdtemp(join(tmpdir(), 'repo-view-outside-'))

    try {
        await writeFile(join(outside, 'keep.txt'), 'keep', 'utf8')
        assert.equal(await deleteRepository(root, `../${basename(outside)}`), false)
        await assert.doesNotReject(access(join(outside, 'keep.txt')))
    } finally {
        await rm(root, { recursive: true, force: true })
        await rm(outside, { recursive: true, force: true })
    }
})
