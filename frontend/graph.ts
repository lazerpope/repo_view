import { MarkerType, Position, type Edge, type Node } from '@vue-flow/core'
import { ImportTypes, type ImportType } from '../shared/types.ts'
import type { Structure, Import } from '../shared/types.ts'

export interface ProjectGraph {
    nodes: Node[]
    edges: Edge[]
}

function parseEntries(value: unknown): Structure {
    if (!Array.isArray(value)) throw new Error('Expected an array of project entries.')

    return value.map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') throw new Error('Invalid project entry.')
        const item = entry as Record<string, unknown>
        const label = item.label ?? item.iabel

        if (
            (item.type !== 'folder' && item.type !== 'file') ||
            typeof label !== 'string' ||
            !label.trim()
        ) {
            throw new Error('Each entry needs a folder/file type and a label.')
        }

        if (item.type === 'folder') {
            return { type: 'folder', label, contains: parseEntries(item.contains ?? []) }
        }

        const rawImports = item.imports ?? []
        if (!Array.isArray(rawImports)) throw new Error('File imports must be an array.')
        const imports = rawImports.map((value: unknown): Import => {
            // String imports remain supported for older backend responses.
            if (typeof value === 'string') return { type: 'lib', label: value }
            if (!value || typeof value !== 'object') throw new Error('Invalid file import.')

            const imported = value as Record<string, unknown>
            if (
                typeof imported.label !== 'string' ||
                !ImportTypes.includes(imported.type as ImportType)
            ) {
                throw new Error('Each import needs a label and a valid type.')
            }
            return { type: imported.type as Import['type'], label: imported.label }
        })
        return { type: 'file', label, imports }
    })
}

export function buildGraph(value: Structure): ProjectGraph {
    const entries = parseEntries(value)
    const nodes: Node[] = []
    const edges: Edge[] = []
    const files = new Map<string, string[]>()
    const pendingImports: { source: string; imports: Import[] }[] = []
    let row = 0
    let maxDepth = 0

    const connect = (source: string, target: string, imported = false) => {
        edges.push({
            id: `edge-${edges.length}`,
            source,
            target,
            type: 'smooth',
            label: imported ? 'imports' : undefined,
            markerEnd: MarkerType.ArrowClosed,
            class: imported ? 'import-edge' : 'contains-edge',
            style: { stroke: imported ? '#a78bfa' : '#64748b', strokeWidth: 2 },
            labelStyle: { fill: '#ddd6fe', fontSize: 11 },
            labelBgStyle: { fill: '#182131' },
        })
    }

    const visit = (items: Structure, depth: number, parent?: string) => {
        for (const entry of items) {
            const id = `project-${nodes.length}`
            maxDepth = Math.max(maxDepth, depth)
            nodes.push({
                id,
                position: { x: depth * 280, y: row++ * 125 },
                data: { label: entry.label, kind: entry.type },
                class: `project-node ${entry.type}-node`,
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            })
            if (parent) connect(parent, id)

            if (entry.type === 'folder') {
                visit(entry.contains ?? [], depth + 1, id)
            } else {
                files.set(entry.label, [...(files.get(entry.label) ?? []), id])
                pendingImports.push({ source: id, imports: entry.imports ?? [] })
            }
        }
    }
    visit(entries, 0)

    const external = new Map<string, string>()
    for (const { source, imports } of pendingImports) {
        const uniqueImports = new Map(imports.map((item) => [`${item.type}:${item.label}`, item]))
        for (const [key, imported] of uniqueImports) {
            const matches = imported.type === 'file' ? files.get(imported.label) : undefined
            let target = matches?.length === 1 ? matches[0] : external.get(key)
            if (!target) {
                target = `external-${external.size}`
                nodes.push({
                    id: target,
                    position: { x: (maxDepth + 1) * 280, y: external.size * 125 },
                    data: { label: imported.label, kind: imported.type },
                    class: `project-node dependency-node ${imported.type}-node`,
                    sourcePosition: Position.Right,
                    targetPosition: Position.Left,
                })
                external.set(key, target)
            }
            connect(source, target, true)
        }
    }

    return { nodes, edges }
}
