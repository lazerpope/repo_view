import { MarkerType, Position, type Edge, type Node } from '@vue-flow/core'

interface ProjectEntry {
  type: 'folder' | 'file'
  label: string
  contains?: ProjectEntry[]
  imports?: string[]
}

export interface ProjectGraph {
  nodes: Node[]
  edges: Edge[]
}

function parseEntries(value: unknown): ProjectEntry[] {
  if (!Array.isArray(value)) throw new Error('Expected an array of project entries.')

  return value.map((entry: unknown): ProjectEntry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid project entry.')
    const item = entry as Record<string, unknown>
    const label = item.label ?? item.iabel

    if ((item.type !== 'folder' && item.type !== 'file') || typeof label !== 'string' || !label.trim()) {
      throw new Error('Each entry needs a folder/file type and a label.')
    }

    if (item.type === 'folder') {
      return { type: 'folder', label, contains: parseEntries(item.contains ?? []) }
    }

    const imports = item.imports ?? []
    if (!Array.isArray(imports) || !imports.every((name) => typeof name === 'string')) {
      throw new Error('File imports must be an array of strings.')
    }
    return { type: 'file', label, imports }
  })
}

export function buildGraph(value: unknown): ProjectGraph {
  const entries = parseEntries(value)
  const nodes: Node[] = []
  const edges: Edge[] = []
  const files = new Map<string, string[]>()
  const pendingImports: { source: string; names: string[] }[] = []
  let row = 0
  let maxDepth = 0

  const connect = (source: string, target: string, imported = false) => {
    edges.push({
      id: `edge-${edges.length}`,
      source,
      target,
      type: 'smoothstep',
      label: imported ? 'imports' : undefined,
      markerEnd: MarkerType.ArrowClosed,
      class: imported ? 'import-edge' : 'contains-edge',
      style: { stroke: imported ? '#a78bfa' : '#64748b', strokeWidth: 2 },
      labelStyle: { fill: '#ddd6fe', fontSize: 11 },
      labelBgStyle: { fill: '#182131' },
    })
  }

  const visit = (items: ProjectEntry[], depth: number, parent?: string) => {
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
        pendingImports.push({ source: id, names: entry.imports ?? [] })
      }
    }
  }
  visit(entries, 0)

  const external = new Map<string, string>()
  for (const { source, names } of pendingImports) {
    for (const name of new Set(names)) {
      const matches = files.get(name)
      let target = matches?.length === 1 ? matches[0] : external.get(name)
      if (!target) {
        target = `external-${external.size}`
        nodes.push({
          id: target,
          position: { x: (maxDepth + 1) * 280, y: external.size * 125 },
          data: { label: name, kind: 'dependency' },
          class: 'project-node dependency-node',
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        })
        external.set(name, target)
      }
      connect(source, target, true)
    }
  }

  return { nodes, edges }
}
