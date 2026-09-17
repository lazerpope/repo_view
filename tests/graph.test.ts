import assert from 'node:assert/strict'
import test from 'node:test'
import type { Structure } from '../shared/types.ts'
import {
    applyGraphView,
    buildGraph,
    collectSubtreeNodeKeys,
    type GraphOptions,
} from '../frontend/graph.ts'
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

test('lays out direct files beside their folder and nested folders below it', () => {
    const layoutStructure: Structure = [
        {
            type: 'folder',
            label: 'root',
            contains: [
                { type: 'file', label: 'one', extension: 'ts', imports: [] },
                { type: 'file', label: 'two', extension: 'ts', imports: [] },
                { type: 'folder', label: 'child', contains: [] },
            ],
        },
    ]
    const graph = buildGraph(layoutStructure, options)
    const root = graph.nodes.find((node) => node.data.key === 'folder:/root')
    const one = graph.nodes.find((node) => node.data.key === 'file:/root/one')
    const two = graph.nodes.find((node) => node.data.key === 'file:/root/two')
    const child = graph.nodes.find((node) => node.data.key === 'folder:/root/child')

    assert.ok(root)
    assert.ok(one)
    assert.ok(two)
    assert.ok(child)
    assert.equal(one.position.y, two.position.y)
    assert.ok(one.position.x > root.position.x)
    assert.ok(child.position.x > root.position.x)
    assert.ok(child.position.y > one.position.y)
})

test('limits a focused graph by outgoing connection depth', () => {
    const baseGraph = buildGraph(structure, options)
    const graph = applyGraphView(baseGraph, {
        hiddenNodeKeys: [],
        focusedNodeKey: 'folder:/A',
        focusDepth: 1,
    })

    assert.deepEqual(graph.nodes.map((node) => node.data.key).sort(), ['file:/A/main', 'folder:/A'])
})

test('removes a hidden node and all of its connections', () => {
    const baseGraph = buildGraph(structure, options)
    const hiddenNode = baseGraph.nodes.find((node) => node.data.key === 'file:/A/main')
    assert.ok(hiddenNode)

    const graph = applyGraphView(baseGraph, {
        hiddenNodeKeys: ['file:/A/main'],
        focusedNodeKey: null,
        focusDepth: null,
    })

    assert.equal(
        graph.nodes.some((node) => node.id === hiddenNode.id),
        false,
    )
    assert.equal(
        graph.edges.some((edge) => edge.source === hiddenNode.id || edge.target === hiddenNode.id),
        false,
    )
})

test('collects every descendant when a folder is hidden', () => {
    const nestedStructure: Structure = [
        {
            type: 'folder',
            label: 'root',
            contains: [
                {
                    type: 'folder',
                    label: 'child',
                    contains: [
                        {
                            type: 'file',
                            label: 'leaf',
                            extension: 'ts',
                            imports: [],
                        },
                    ],
                },
            ],
        },
    ]

    assert.deepEqual(collectSubtreeNodeKeys(nestedStructure, 'folder:/root').sort(), [
        'file:/root/child/leaf',
        'folder:/root',
        'folder:/root/child',
    ])
})
