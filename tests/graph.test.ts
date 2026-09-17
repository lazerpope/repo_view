import assert from 'node:assert/strict'
import test from 'node:test'
import type { Structure } from '../shared/types.ts'
import { buildGraph, type GraphOptions } from '../frontend/graph.ts'
import { defaultConnectionStyles, defaultNodeStyles } from '../frontend/stores/appUI.ts'

const structure: Structure = [
    {
        type: 'folder',
        label: 'A',
        contains: [
            {
                type: 'file',
                label: 'main',
                extension: 'ts',
                imports: [
                    { type: 'file', label: 'B/target' },
                    { type: 'lib', label: 'express' },
                ],
            },
        ],
    },
    {
        type: 'folder',
        label: 'B',
        contains: [
            {
                type: 'file',
                label: 'target',
                extension: 'ts',
                imports: [],
            },
        ],
    },
]

const options: GraphOptions = {
    basePath: '',
    enabledExtensions: new Set(['ts']),
    nodeStyles: defaultNodeStyles,
    connectionStyles: defaultConnectionStyles,
}

test('links project files by full folder path', () => {
    const graph = buildGraph(structure, options)
    const source = graph.nodes.find((node) => node.data.path === '/A/main')
    const target = graph.nodes.find((node) => node.data.path === '/B/target')

    assert.ok(source)
    assert.ok(target)
    assert.ok(graph.edges.some((edge) => edge.source === source.id && edge.target === target.id))
    assert.ok(graph.nodes.some((node) => node.data.label === 'express' && node.data.kind === 'lib'))
})

test('ignores project-file links outside the selected folder', () => {
    const graph = buildGraph([structure[0]!], options)

    assert.equal(
        graph.nodes.some((node) => node.data.path === '/B/target'),
        false,
    )
    assert.equal(
        graph.nodes.some((node) => node.data.label === 'B/target'),
        false,
    )
    assert.ok(graph.nodes.some((node) => node.data.label === 'express'))
})
