import { defineStore } from 'pinia'
import { inject, onScopeDispose, reactive, ref, watch, type Ref } from 'vue'
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

export interface NodeMenuState {
    key: string
    label: string
    kind: 'folder' | 'file'
    x: number
    y: number
}

interface AppUIPreferences {
    sidebarOpen: boolean
    sidebarWidth: number
    activeTab: SidebarTab
    jsonFontSize: number
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
    const sidebarWidth = ref(Math.max(500, saved?.sidebarWidth ?? 500))
    const activeTab = ref<SidebarTab>(saved?.activeTab ?? 'styles')
    const jsonFontSize = ref(Math.max(8, Math.min(24, saved?.jsonFontSize ?? 12)))
    const nodeMenu = ref<NodeMenuState | null>(null)
    const nodeStyles = reactive(cloneDefaults(defaultNodeStyles))
    const connectionStyles = reactive(cloneDefaults(defaultConnectionStyles))
    const currentRepository = ref<string|null>(null)

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

    function openNodeMenu(menu: NodeMenuState) {
        nodeMenu.value = menu
    }

    function closeNodeMenu() {
        nodeMenu.value = null
    }

    let storeTimeout: ReturnType<typeof setTimeout>
    watch(
        () => ({
            sidebarOpen: sidebarOpen.value,
            sidebarWidth: sidebarWidth.value,
            activeTab: activeTab.value,
            jsonFontSize: jsonFontSize.value,
            nodeStyles,
            connectionStyles,
        }),
        (preferences) => {
            clearTimeout(storeTimeout)
            storeTimeout = setTimeout(() => provider.store(storageKey, preferences), 250)
        },
        { deep: true },
    )
    onScopeDispose(() => clearTimeout(storeTimeout))

    return {
        sidebarOpen,
        sidebarWidth,
        activeTab,
        jsonFontSize,
        nodeStyles,
        connectionStyles,
        nodeMenu,
        openSidebar,
        closeSidebar,
        openNodeMenu,
        closeNodeMenu,
        resetStyles,
    }
})
