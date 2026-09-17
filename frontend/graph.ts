import { MarkerType, Position, type Edge, type Node } from '@vue-flow/core'
import {
    ImportTypes,
    type File,
    type Folder,
    type Import,
    type ImportType,
    type Structure,
} from '../shared/types.ts'
import type {
    ConnectionCurve,
    ConnectionKind,
    ConnectionVisualStyle,
    NodeKind,
    NodeVisualStyle,
} from './stores/appUI.ts'

export const noExtensionKey = '(no extension)'

export function extensionOf(label: string, extension: string | null): string {
    const normalized = extension?.trim().replace(/^\./, '').toLowerCase()
    if (normalized) return normalized
    const dot = label.lastIndexOf('.')
    return dot > 0 && dot < label.length - 1 ? label.slice(dot + 1).toLowerCase() : noExtensionKey
}

export interface GraphOptions {
    basePath: string
    enabledExtensions: ReadonlySet<string>
    nodeStyles: Record<NodeKind, NodeVisualStyle>
    connectionStyles: Record<ConnectionKind, ConnectionVisualStyle>
}

export interface ProjectGraph {
    nodes: Node[]
    edges: Edge[]
}

function parseImport(value: unknown): Import {
    if (typeof value === 'string') return { type: 'lib', label: value }
    if (!value || typeof value !== 'object') throw new Error('Invalid file import.')

    const imported = value as Record<string, unknown>
    if (typeof imported.label !== 'string' || !ImportTypes.includes(imported.type as ImportType)) {
        throw new Error('Each import needs a label and a valid type.')
    }

    return {
        type: imported.type as ImportType,
        label: imported.label,
    }
}

function parseEntry(value: unknown): Folder | File {
    if (!value || typeof value !== 'object') throw new Error('Invalid project entry.')
    const item = value as Record<string, unknown>
    const label = item.label ?? item.iabel

    if ((item.type !== 'folder' && item.type !== 'file') || typeof label !== 'string') {
        throw new Error('Each entry needs a folder/file type and a label.')
    }

    if (item.type === 'folder') {
        if (!Array.isArray(item.contains ?? []))
            throw new Error('Folder contents must be an array.')
        return {
            type: 'folder',
            label,
            contains: (item.contains as unknown[] | undefined)?.map(parseEntry) ?? [],
        }
    }

    if (!Array.isArray(item.imports ?? [])) throw new Error('File imports must be an array.')
    if (
        item.extension !== undefined &&
        item.extension !== null &&
        typeof item.extension !== 'string'
    ) {
        throw new Error('A file extension must be a string or null.')
    }

    return {
        type: 'file',
        label,
        extension: (item.extension as string | null | undefined) ?? null,
        imports: (item.imports as unknown[] | undefined)?.map(parseImport) ?? [],
    }
}

export function parseStructure(value: unknown): Structure {
    if (!Array.isArray(value)) throw new Error('Expected an array of project entries.')
    return value.map(parseEntry)
}

function normalizePath(value: string): string {
    const normalized = value.replaceAll('\\', '/').replace(/\/+/g, '/').replace(/\/$/, '')
    return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function edgeType(curve: ConnectionCurve): string {
    return curve === 'bezier' ? 'default' : curve
}

function dashArray(line: ConnectionVisualStyle['line']): string | undefined {
    if (line === 'dashed') return '8 5'
    if (line === 'dotted') return '2 5'
    return undefined
}

function fileName(file: File): string {
    const extension = file.extension?.replace(/^\./, '')
    if (!extension || file.label.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
        return file.label
    }
    return `${file.label}.${extension}`
}

export function buildGraph(entries: Structure, options: GraphOptions): ProjectGraph {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const filesByPath = new Map<string, string[]>()
    const pendingImports: { source: string; imports: Import[] }[] = []
    let row = 0
    let maxDepth = 0

    const addFileIndex = (index: Map<string, string[]>, key: string, id: string) => {
        index.set(key, [...(index.get(key) ?? []), id])
    }

    const connect = (source: string, target: string, kind: ConnectionKind) => {
        const style = options.connectionStyles[kind]
        edges.push({
            id: `edge-${edges.length}`,
            source,
            target,
            type: edgeType(style.curve),
            animated: style.animated,
            markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
            class: `project-edge ${kind}-edge ${style.line}-edge`,
            style: {
                stroke: style.color,
                strokeWidth: 2,
                strokeDasharray: dashArray(style.line),
            },
        })
    }

    const addNode = (label: string, kind: NodeKind, depth: number, path: string) => {
        const id = `project-${nodes.length}`
        const style = options.nodeStyles[kind]
        nodes.push({
            id,
            position: { x: depth * 280, y: row++ * 125 },
            data: { label, kind, path },
            class: `project-node ${kind}-node`,
            style: {
                color: style.color,
                backgroundColor: style.backgroundColor,
                borderColor: style.color,
                fontSize: `${style.fontSize}px`,
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        })
        return id
    }

    const visit = (
        items: Structure,
        depth: number,
        parent: string | undefined,
        parentPath: string,
    ) => {
        for (const entry of items) {
            const path = normalizePath(`${parentPath}/${entry.label}`)
            if (
                entry.type === 'file' &&
                !options.enabledExtensions.has(extensionOf(entry.label, entry.extension))
            ) {
                continue
            }

            maxDepth = Math.max(maxDepth, depth)
            const id = addNode(
                entry.type === 'file' ? fileName(entry) : entry.label,
                entry.type,
                depth,
                path,
            )
            if (parent) connect(parent, id, 'contains')

            if (entry.type === 'folder') {
                visit(entry.contains, depth + 1, id, path)
            } else {
                addFileIndex(filesByPath, path, id)
                addFileIndex(filesByPath, normalizePath(`${parentPath}/${fileName(entry)}`), id)
                pendingImports.push({ source: id, imports: entry.imports })
            }
        }
    }

    visit(entries, 0, undefined, options.basePath)

    const externalNodes = new Map<string, string>()
    for (const { source, imports } of pendingImports) {
        const uniqueImports = new Map(imports.map((item) => [`${item.type}:${item.label}`, item]))
        for (const [key, imported] of uniqueImports) {
            if (imported.type === 'file') {
                const pathMatches = filesByPath.get(normalizePath(imported.label))
                if (pathMatches?.length === 1) connect(source, pathMatches[0]!, 'imports')
                continue
            }

            let target = externalNodes.get(key)
            if (!target) {
                target = addNode(imported.label, imported.type, maxDepth + 1, key)
                externalNodes.set(key, target)
            }
            connect(source, target, 'imports')
        }
    }

    return { nodes, edges }
}
