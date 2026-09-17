import { MarkerType, type Edge, type Node } from '@vue-flow/core'
import type { ArrayAccessExpression, ArrayCreationExpression, AssignmentStatement, AssignmentTarget, Expression, Program, Statement } from './language/ast'

type ArrayElementAssignment = AssignmentStatement & { target: ArrayAccessExpression }

export type AstStatementKind = Statement['type']
export type AstSemanticGroup = 'data' | 'condition' | 'loop' | 'hardware' | 'documentation'

export interface AstNodeData extends Record<string, unknown> {
    title: string
    detail: string
    kind: AstStatementKind
    group: AstSemanticGroup
    line: number
    compactedStatements?: number
}

export interface AstGraph {
    n: Node<AstNodeData>[]
    e: Edge[]
}

interface VisualiserHotData {
    astVisualiserProgram?: Program | null
}

const AST_SESSION_KEY = 'turingScript:lastCanonicalAst'

const loadSessionAst = (): Program | null => {
    if (typeof window === 'undefined') return null
    try {
        const saved = window.sessionStorage.getItem(AST_SESSION_KEY)
        return saved ? (JSON.parse(saved) as Program) : null
    } catch {
        return null
    }
}

const hotData = import.meta.hot?.data as VisualiserHotData | undefined
let lastAst: Program | null = hotData?.astVisualiserProgram ?? loadSessionAst()
const listeners = new Set<() => void>()

if (import.meta.hot) {
    import.meta.hot.dispose((data: VisualiserHotData) => {
        data.astVisualiserProgram = lastAst
    })
}

export function fulfill(program: Program): void {
    lastAst = program
    if (typeof window !== 'undefined') {
        try {
            window.sessionStorage.setItem(AST_SESSION_KEY, JSON.stringify(program))
        } catch {

        }
    }
    listeners.forEach((listener) => listener())
}

export function subscribeAst(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const semanticGroup: Record<AstStatementKind, AstSemanticGroup> = {
    declaration: 'data', assignment: 'data', hardwareWrite: 'hardware',
    screen8Store: 'hardware', screen8Present: 'hardware', if: 'condition', while: 'loop',
    break: 'loop', continue: 'loop', comment: 'documentation',
}

const expressionLabel = (expression: Expression | ArrayCreationExpression): string => {
    switch (expression.type) {
        case 'literal': return expression.raw
        case 'identifier': return expression.name
        case 'arrayAccess': return `${expression.name}[${expressionLabel(expression.index)}]`
        case 'arrayCreation': return `Array(${expression.size})`
        case 'unary': return `${expression.operator}${expressionLabel(expression.operand)}`
        case 'binary': return `${expressionLabel(expression.left)} ${expression.operator} ${expressionLabel(expression.right)}`
        case 'hardwareRead': return `${expression.operation}()`
        case 'screen8Buffer': return `framebuffer (${expression.byteCount} bytes)`
    }
}

const targetLabel = (target: AssignmentTarget): string => target.type === 'identifier'
    ? target.name
    : `${target.name}[${expressionLabel(target.index)}]`

const presentation = (statement: Statement): Pick<AstNodeData, 'title' | 'detail'> => {
    switch (statement.type) {
        case 'declaration': return { title: 'Declaration', detail: `${statement.name} = ${expressionLabel(statement.initializer)}` }
        case 'assignment': return { title: 'Assignment', detail: `${targetLabel(statement.target)} = ${expressionLabel(statement.value)}` }
        case 'hardwareWrite': return { title: statement.operation === 'screen' ? 'Screen output' : 'Hardware output', detail: `${statement.operation}(${statement.arguments.map(expressionLabel).join(', ')})` }
        case 'screen8Store': return { title: 'Pixel write', detail: `framebuffer[${expressionLabel(statement.offset)}] = ${expressionLabel(statement.value)}` }
        case 'screen8Present': return { title: 'Present frame', detail: `clear color ${expressionLabel(statement.color)}` }
        case 'if': return { title: 'If', detail: expressionLabel(statement.condition) }
        case 'while': return { title: 'While loop', detail: expressionLabel(statement.condition) }
        case 'break': return { title: 'Break', detail: 'Exit the nearest loop' }
        case 'continue': return { title: 'Continue', detail: 'Start the next loop iteration' }
        case 'comment': return { title: 'Comment', detail: statement.text.replace(/^\s*(?:\/\/|#|\/\*)\s?/, '') }
    }
}

export function exportAst(): AstGraph {
    if (!lastAst) return { n: [], e: [] }
    lastAst = fetch('/data')

    const nodes: Node<AstNodeData>[] = []
    const edges: Edge[] = []
    let nodeCounter = 0
    let edgeCounter = 0
    let nextY = 0

    const addEdge = (source: string, target: string, label?: string, branch = false): void => {
        edges.push({
            id: `ast-edge-${edgeCounter++}`, source, target, type: branch ? 'smoothstep' : 'step', label, animated: branch,
            markerEnd: MarkerType.ArrowClosed, class: `ast-edge ast-edge--${branch ? 'branch' : 'sequence'}`
        })
    }

    const visit = (
        statements: readonly Statement[],
        depth: number,
        owner?: { id: string; label: string },
        loopId?: string,
    ): { lastId?: string; lastTerminates: boolean } => {
        let previous: string | undefined
        let lastId: string | undefined
        let lastTerminates = false
        let statementIndex = 0

        while (statementIndex < statements.length) {
            const statement = statements[statementIndex]!
            const compacted: ArrayElementAssignment[] = []

            if (statement.type === 'declaration' && statement.initializer.type === 'arrayCreation') {
                for (let index = statementIndex + 1; index < statements.length; index += 1) {
                    const candidate = statements[index]!
                    if (candidate.type !== 'assignment' || candidate.target.type !== 'arrayAccess' || candidate.target.name !== statement.name) break
                    compacted.push(candidate as ArrayElementAssignment)
                }
            }

            const id = `ast-node-${nodeCounter++}`
            const nodePresentation = presentation(statement)
            const isCompactedArray = compacted.length > 0
            const detail = isCompactedArray
                ? [nodePresentation.detail, ...compacted.map((assignment) =>
                    `[${expressionLabel(assignment.target.index)}] = ${expressionLabel(assignment.value)}`)].join('\n')
                : nodePresentation.detail

            nodes.push({
                id,
                type: 'ast',
                position: { x: depth * 300, y: nextY },
                class: `ast-node--${semanticGroup[statement.type]} ast-node--${statement.type}${isCompactedArray ? ' ast-node--array' : ''}`,
                data: {
                    ...nodePresentation,
                    title: isCompactedArray ? 'Array initialization' : nodePresentation.title,
                    detail,
                    kind: statement.type,
                    group: semanticGroup[statement.type],
                    line: statement.location.line,
                    compactedStatements: compacted.length || undefined,
                },
            })
            nextY += 112 + compacted.length * 22

            if (statementIndex === 0 && owner) addEdge(owner.id, id, owner.label, true)
            else if (previous) addEdge(previous, id)
            lastId = id
            lastTerminates = statement.type === 'break' || statement.type === 'continue'

            if (statement.type === 'continue' && loopId) {
                addEdge(id, loopId, 'continue', true)
            }

            previous = lastTerminates ? undefined : id

            if (statement.type === 'if') {
                visit(statement.thenBranch, depth + 1, { id, label: 'true' }, loopId)
                if (statement.elseBranch?.length) visit(statement.elseBranch, depth + 1, { id, label: 'false' }, loopId)
            } else if (statement.type === 'while') {
                const body = visit(statement.body, depth + 1, { id, label: 'body' }, id)
                if (body.lastId && !body.lastTerminates) addEdge(body.lastId, id, 'repeat', true)
            }

            statementIndex += compacted.length + 1
        }

        return { lastId, lastTerminates }
    }

    visit(lastAst.statements, 0)
    return { n: nodes, e: edges }
}
