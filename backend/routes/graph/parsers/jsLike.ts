import { builtinModules } from 'node:module'
import type { Import } from '../../../../shared/types.ts'

const builtins = new Set(
    builtinModules.flatMap((name) => [name, name.replace(/^node:/, ''), `node:${name}`]),
)

function classifyImport(specifier: string): Import {
    const label = specifier.trim()
    const bareLabel = label.replace(/^node:/, '').split('/')[0] ?? label

    if (
        label.startsWith('.') ||
        label.startsWith('/') ||
        label.startsWith('@/') ||
        label.startsWith('~/')
    ) {
        return { type: 'file', label }
    }
    if (builtins.has(label) || builtins.has(bareLabel)) {
        return { type: 'lib-builtin', label: bareLabel }
    }
    return { type: 'lib-external', label }
}

export function parseJS(code: string): Import[] {
    const specifiers: string[] = []
    const runtimeCode = code.replace(
        /\b(?:import|export)\s+type\b[\s\S]*?\bfrom\s*["'][^"']+["']\s*;?/g,
        '',
    )
    const staticImport =
        /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g
    const calledImport = /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g

    for (const pattern of [staticImport, calledImport]) {
        for (const match of runtimeCode.matchAll(pattern)) {
            if (match[1]) specifiers.push(match[1])
        }
    }

    return [
        ...new Map(
            specifiers.map((specifier) => {
                const imported = classifyImport(specifier)
                return [`${imported.type}:${imported.label}`, imported]
            }),
        ).values(),
    ]
}

export default parseJS
