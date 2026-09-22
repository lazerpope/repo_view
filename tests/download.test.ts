import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRepositoryUrl } from '../backend/routes/graph/download.ts'

test('parses GitHub repository, branch, file, and commit URLs', () => {
    const repository = parseRepositoryUrl('https://github.com/example/project.git')
    const branch = parseRepositoryUrl(
        'https://github.com/example/project/tree/feature/login/src/app.ts',
    )
    const commit = parseRepositoryUrl('https://github.com/example/project/commit/abc123')

    assert.equal(repository.project, 'example/project')
    assert.deepEqual(repository.refCandidates, [])
    assert.deepEqual(branch.refCandidates, [
        'feature/login/src/app.ts',
        'feature/login/src',
        'feature/login',
        'feature',
    ])
    assert.deepEqual(commit.refCandidates, ['abc123'])
})

test('parses nested GitLab projects and allows an explicit ref override', () => {
    const source = parseRepositoryUrl(
        'https://gitlab.com/example/team/project/-/blob/main/src/app.ts',
        'release/2.0',
    )

    assert.equal(source.project, 'example/team/project')
    assert.equal(source.repository, 'project')
    assert.deepEqual(source.refCandidates, ['release/2.0'])
})

test('rejects unsupported and non-HTTPS repository URLs', () => {
    assert.throws(() => parseRepositoryUrl('http://github.com/example/project'), /HTTPS/)
    assert.throws(() => parseRepositoryUrl('https://example.com/example/project'), /supported/)
})
