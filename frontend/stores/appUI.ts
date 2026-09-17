import { defineStore } from 'pinia'
import { inject, reactive, ref, watch } from 'vue'
import { memoryPreferencesProvider, preferencesProviderKey } from '../providers/preferences.ts'

export const nodeKinds = ['folder', 'file', 'lib', 'lib-external', 'lib-builtin'] as const
export const connectionKinds = ['contains', 'imports'] as const

export type NodeKind = (typeof nodeKinds)[number]
export type ConnectionKind = (typeof connectionKinds)[number]
export type SidebarTab = 'styles' | 'raw' | 'folders'
export type ConnectionLine = 'solid' | 'dashed' | 'dotted'
export type ConnectionCurve = 'smoothstep' | 'step' | 'straight' | 'bezier'

export interface NodeVisualStyle {
    color: string
    backgroundColor: string
    fontSize: number
}

export interface ConnectionVisualStyle {
    color: string
    line: ConnectionLine
    animated: boolean
    curve: ConnectionCurve
}

interface AppUIPreferences {
    sidebarOpen: boolean
    activeTab: SidebarTab
    nodeStyles: Record<NodeKind, NodeVisualStyle>
    connectionStyles: Record<ConnectionKind, ConnectionVisualStyle>
}

export const defaultNodeStyles: Record<NodeKind, NodeVisualStyle> = {
    folder: { color: '#fbbf24', backgroundColor: '#292518', fontSize: 14 },
    file: { color: '#5eead4', backgroundColor: '#152b32', fontSize: 14 },
    lib: { color: '#a78bfa', backgroundColor: '#241d38', fontSize: 14 },
    'lib-external': { color: '#f472b6', backgroundColor: '#321b2d', fontSize: 14 },
    'lib-builtin': { color: '#60a5fa', backgroundColor: '#172b46', fontSize: 14 },
}

export const defaultConnectionStyles: Record<ConnectionKind, ConnectionVisualStyle> = {
    contains: { color: '#64748b', line: 'solid', animated: false, curve: 'smoothstep' },
    imports: { color: '#a78bfa', line: 'dashed', animated: false, curve: 'smoothstep' },
}

const storageKey = 'repo-view:ui'

function cloneDefaults<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

export const useAppUI = defineStore('appUI', () => {
    const provider = inject(preferencesProviderKey, memoryPreferencesProvider)
    const saved = provider.load<Partial<AppUIPreferences>>(storageKey)
    const sidebarOpen = ref(saved?.sidebarOpen ?? false)
    const activeTab = ref<SidebarTab>(saved?.activeTab ?? 'styles')
    const nodeStyles = reactive(cloneDefaults(defaultNodeStyles))
    const connectionStyles = reactive(cloneDefaults(defaultConnectionStyles))

    for (const kind of nodeKinds) Object.assign(nodeStyles[kind], saved?.nodeStyles?.[kind])
    for (const kind of connectionKinds) {
        Object.assign(connectionStyles[kind], saved?.connectionStyles?.[kind])
    }

    function openSidebar(tab: SidebarTab = activeTab.value) {
        activeTab.value = tab
        sidebarOpen.value = true
    }

    function closeSidebar() {
        sidebarOpen.value = false
    }

    function resetStyles() {
        for (const kind of nodeKinds) Object.assign(nodeStyles[kind], defaultNodeStyles[kind])
        for (const kind of connectionKinds) {
            Object.assign(connectionStyles[kind], defaultConnectionStyles[kind])
        }
    }

    watch(
        () => ({
            sidebarOpen: sidebarOpen.value,
            activeTab: activeTab.value,
            nodeStyles,
            connectionStyles,
        }),
        (preferences) => provider.store(storageKey, preferences),
        { deep: true },
    )

    return {
        sidebarOpen,
        activeTab,
        nodeStyles,
        connectionStyles,
        openSidebar,
        closeSidebar,
        resetStyles,
    }
})
