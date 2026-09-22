import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createFileStructure, parseRepository, Parser } from '../backend/routes/graph/parser.ts'
import type { File, Structure } from '../shared/types.ts'

async function temporaryRepository() {
    return mkdtemp(join(tmpdir(), 'repo-view-parser-'))
}

function findFile(structure: Structure, label: string): File | null {
    for (const entry of structure) {
        if (entry.type === 'file' && entry.label === label) return entry
        if (entry.type === 'folder') {
            const match = findFile(entry.contains, label)
            if (match) return match
        }
    }
    return null
}

test('first pass includes only files with registered parsers', async () => {
    const repository = await temporaryRepository()
    const registry = new Parser()
    registry.for('foo').register(() => [])

    try {
        await mkdir(join(repository, 'src'))
        await mkdir(join(repository, 'empty'))
        await mkdir(join(repository, 'node_modules', 'dependency'), { recursive: true })
        await writeFile(join(repository, 'src', 'included.foo'), 'supported')
        await writeFile(join(repository, 'src', 'ignored.txt'), 'unsupported')
        await writeFile(join(repository, 'node_modules', 'dependency', 'hidden.foo'), 'ignored')

        assert.deepEqual(await createFileStructure(repository, registry), [
            {
                type: 'folder',
                label: 'src',
                contains: [
                    {
                        type: 'file',
                        label: 'included.foo',
                        extension: 'foo',
                        imports: [],
                    },
                ],
            },
        ])
    } finally {
        await rm(repository, { recursive: true, force: true })
    }
})

test('second pass parses and resolves JavaScript and Python imports', async () => {
    const repository = await temporaryRepository()

    try {
        await mkdir(join(repository, 'src'))
        await mkdir(join(repository, 'pkg'))
        await writeFile(
            join(repository, 'src', 'main.ts'),
            [
                "import { helper } from './util'",
                "import React from 'react'",
                "import { readFile } from 'node:fs'",
            ].join('\n'),
        )
        await writeFile(join(repository, 'src', 'util.ts'), 'export const helper = true')
        await writeFile(join(repository, 'root.ts'), "import { helper } from 'src/util'")
        await writeFile(
            join(repository, 'pkg', 'app.py'),
            ['from .helper import run', 'import os', 'import requests'].join('\n'),
        )
        await writeFile(join(repository, 'pkg', 'helper.py'), 'def run():\n    pass')
        await writeFile(join(repository, 'runner.py'), 'from pkg.helper import run')
        await writeFile(join(repository, 'README.md'), 'unsupported')

        const structure = await parseRepository(repository)
        assert.deepEqual(findFile(structure, 'main.ts')?.imports, [
            { type: 'file', label: 'src/util.ts' },
            { type: 'lib-external', label: 'react' },
            { type: 'lib-builtin', label: 'fs' },
        ])
        assert.deepEqual(findFile(structure, 'app.py')?.imports, [
            { type: 'file', label: 'pkg/helper.py' },
            { type: 'lib-builtin', label: 'os' },
            { type: 'lib-external', label: 'requests' },
        ])
        assert.deepEqual(findFile(structure, 'runner.py')?.imports, [
            { type: 'file', label: 'pkg/helper.py' },
        ])
        assert.deepEqual(findFile(structure, 'root.ts')?.imports, [
            { type: 'file', label: 'src/util.ts' },
        ])
        assert.equal(findFile(structure, 'README.md'), null)
    } finally {
        await rm(repository, { recursive: true, force: true })
    }
})
