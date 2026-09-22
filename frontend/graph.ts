import { MarkerType, Position, type Edge, type Node } from '@vue-flow/core'
import {
    ImportTypes,
    type File,
    type Folder,
    type Import,
    type ImportType,
    type Structure,
} from '../shared/types.ts'
import type { ConnectionCurve, ConnectionKind, NodeKind } from './stores/appUI.ts'

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
}

export interface ProjectGraph {
    nodes: Node[]
    edges: Edge[]
}

export interface GraphViewOptions {
    hiddenNodeKeys: readonly string[]
    hiddenNodeKinds?: readonly NodeKind[]
    focusedNodeKey: string | null
    focusDepth: number | null
}

export type ConnectionCurves = Record<ConnectionKind, ConnectionCurve>

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

export function collectSubtreeNodeKeys(structure: Structure, folderKey: string): string[] {
    const folderPath = normalizePath(folderKey.replace(/^folder:/, ''))
    const keys: string[] = []

    const visit = (entries: Structure, parentPath: string) => {
        for (const entry of entries) {
            const path = normalizePath(`${parentPath}/${entry.label}`)
            if (path === folderPath || path.startsWith(`${folderPath}/`)) {
                keys.push(`${entry.type}:${path}`)
            }
            if (entry.type === 'folder') visit(entry.contains, path)
        }
    }

    visit(structure, '')
    return keys
}

function edgeType(curve: ConnectionCurve): string {
    return curve === 'bezier' ? 'default' : curve
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
    const folderIndent = 290
    const fileOffset = 290
    const fileGap = 230
    const rowGap = 195
    const filesPerRow = 4
    let layoutY = 20
    let maxProjectX = 0

    const addFileIndex = (index: Map<string, string[]>, key: string, id: string) => {
        index.set(key, [...(index.get(key) ?? []), id])
    }

    const connect = (source: string, target: string, kind: ConnectionKind) => {
        edges.push({
            id: `edge-${edges.length}`,
            source,
            target,
            data: { kind },
            markerStart:
                kind === 'imports'
                    ? { type: MarkerType.ArrowClosed, color: 'var(--imports-edge-color)' }
                    : undefined,
            markerEnd:
                kind !== 'imports'
                    ? { type: MarkerType.ArrowClosed, color: 'var(--contains-edge-color)' }
                    : undefined,
            class: `project-edge ${kind}-edge`,
        })
    }

    const addNode = (
        label: string,
        kind: NodeKind,
        position: { x: number; y: number },
        path: string,
    ) => {
        const key = `${kind}:${path}`
        const id = `node-${encodeURIComponent(key)}`
        nodes.push({
            id,
            position,
            data: { label, kind, path, key },
            class: `project-node ${kind}-node`,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        })
        return id
    }

    const addProjectFile = (
        file: File,
        parent: string | undefined,
        parentPath: string,
        position: { x: number; y: number },
    ) => {
        const path = normalizePath(`${parentPath}/${file.label}`)
        const id = addNode(fileName(file), 'file', position, path)
        maxProjectX = Math.max(maxProjectX, position.x)
        if (parent) connect(parent, id, 'contains')
        addFileIndex(filesByPath, path, id)
        addFileIndex(filesByPath, normalizePath(`${parentPath}/${fileName(file)}`), id)
        pendingImports.push({ source: id, imports: file.imports })
    }

    const visibleFiles = (items: Structure) =>
        items.filter(
            (entry): entry is File =>
                entry.type === 'file' &&
                options.enabledExtensions.has(extensionOf(entry.label, entry.extension)),
        )

    const visitFolder = (
        folder: Folder,
        depth: number,
        parent: string | undefined,
        parentPath: string,
    ) => {
        const path = normalizePath(`${parentPath}/${folder.label}`)
        const folderX = depth * folderIndent
        const folderY = layoutY
        const id = addNode(folder.label, 'folder', { x: folderX, y: folderY }, path)
        maxProjectX = Math.max(maxProjectX, folderX)
        if (parent) connect(parent, id, 'contains')

        const files = visibleFiles(folder.contains)
        files.forEach((file, index) => {
            addProjectFile(file, id, path, {
                x: folderX + fileOffset + (index % filesPerRow) * fileGap,
                y: folderY + 180 + Math.floor(index / filesPerRow) * rowGap,
            })
        })

        const fileRows = Math.ceil(files.length / filesPerRow)
        layoutY = folderY + (fileRows ? 105 + fileRows * rowGap : 130)

        for (const child of folder.contains) {
            if (child.type === 'folder') visitFolder(child, depth + 1, id, path)
        }
    }

    const rootFiles = visibleFiles(entries)
    rootFiles.forEach((file, index) => {
        addProjectFile(file, undefined, options.basePath, {
            x: (index % filesPerRow) * fileGap,
            y: layoutY + Math.floor(index / filesPerRow) * rowGap,
        })
    })
    if (rootFiles.length) layoutY += Math.ceil(rootFiles.length / filesPerRow) * rowGap + 30

    for (const entry of entries) {
        if (entry.type === 'folder') visitFolder(entry, 0, undefined, options.basePath)
    }

    const externalNodes = new Map<string, string>()
    const externalX = maxProjectX + 300
    let externalY = 20
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
                const sourceY = nodes.find((node) => node.id === source)?.position.y ?? 0
                externalY = Math.max(externalY, sourceY)
                target = addNode(imported.label, imported.type, { x: externalX, y: externalY }, key)
                externalY += 110
                externalNodes.set(key, target)
            }
            connect(source, target, 'imports')
        }
    }

    return { nodes, edges }
}

export function applyConnectionCurves(
    graph: ProjectGraph,
    connectionCurves: ConnectionCurves,
): ProjectGraph {
    return {
        nodes: graph.nodes,
        edges: graph.edges.map((edge) => {
            const kind = edge.data?.kind as ConnectionKind
            return { ...edge, type: edgeType(connectionCurves[kind]) }
        }),
    }
}

export function applyGraphView(graph: ProjectGraph, options: GraphViewOptions): ProjectGraph {
    const hiddenKeys = new Set(options.hiddenNodeKeys)
    const hiddenKinds = new Set(options.hiddenNodeKinds ?? [])
    let nodes = graph.nodes.filter(
        (node) =>
            !hiddenKeys.has(String(node.data.key)) && !hiddenKinds.has(node.data.kind as NodeKind),
    )
    const nodeIds = new Set(nodes.map((node) => node.id))
    let edges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

    if (!options.focusedNodeKey) return { nodes, edges }
    const root = nodes.find((node) => node.data.key === options.focusedNodeKey)
    if (!root) return { nodes: [], edges: [] }

    const visibleIds = new Set([root.id])
    let frontier = new Set([root.id])
    const depth = options.focusDepth ?? Number.POSITIVE_INFINITY
    let step = 0

    while (frontier.size && step < depth) {
        const next = new Set<string>()
        for (const edge of edges) {
            if (!frontier.has(edge.source) || visibleIds.has(edge.target)) continue
            visibleIds.add(edge.target)
            next.add(edge.target)
        }
        frontier = next
        step += 1
    }

    nodes = nodes.filter((node) => visibleIds.has(node.id))
    edges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    return { nodes, edges }
}
