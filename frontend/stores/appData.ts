import { defineStore } from 'pinia'
import { computed, inject, ref } from 'vue'
import type { Folder, Structure } from '../../shared/types.ts'
import { collectSubtreeNodeKeys, extensionOf, parseStructure } from '../graph.ts'
import { memoryPreferencesProvider, preferencesProviderKey } from '../providers/preferences.ts'
import type { FocusMode } from './appUI.ts'

export interface FolderChoice {
    path: string
    name: string
    displayPath: string
    parentPath: string
    depth: number
    folder: Folder
}

export type LibraryKind = 'lib' | 'lib-external' | 'lib-builtin'

interface AppDataPreferences {
    selectedFolderPath: string | null
    hiddenExtensions: string[]
    hiddenNodeKeys: string[]
    hiddenLibraryKinds: LibraryKind[]
    focusedNodeKey: string | null
    focusDepth: number | null
    focusMode: FocusMode
    nodePositions: Record<string, Record<string, { x: number; y: number }>>
    viewports: Record<string, { x: number; y: number; zoom: number }>
}

const storageKey = 'repo-view:data-preferences'
function listFolders(structure: Structure): FolderChoice[] {
    const choices: FolderChoice[] = []

    const visit = (items: Structure, labelPath: string[]) => {
        items.forEach((entry) => {
            if (entry.type !== 'folder') return
            const nextLabelPath = [...labelPath, entry.label]
            choices.push({
                path: `/${nextLabelPath.join('/')}`,
                name: entry.label,
                displayPath: `/${nextLabelPath.join('/')}`,
                parentPath: labelPath.length ? `/${labelPath.join('/')}` : '',
                depth: labelPath.length,
                folder: entry,
            })
            visit(entry.contains, nextLabelPath)
        })
    }

    visit(structure, [])
    return choices
}

function listExtensions(structure: Structure): string[] {
    const extensions = new Set<string>()
    const visit = (items: Structure) => {
        for (const entry of items) {
            if (entry.type === 'folder') visit(entry.contains)
            else extensions.add(extensionOf(entry.label, entry.extension))
        }
    }
    visit(structure)
    return [...extensions].sort((left, right) => left.localeCompare(right))
}

export const useAppData = defineStore('appData', () => {
    const provider = inject(preferencesProviderKey, memoryPreferencesProvider)
    const saved = provider.load<Partial<AppDataPreferences>>(storageKey)
    const rawData = ref<Structure>([])
    const loading = ref(false)
    const error = ref('')
    const selectedFolderPath = ref<string | null>(saved?.selectedFolderPath ?? null)
    const hiddenExtensions = ref<string[]>(saved?.hiddenExtensions ?? [])
    const hiddenNodeKeys = ref<string[]>(saved?.hiddenNodeKeys ?? [])
    const hiddenLibraryKinds = ref<LibraryKind[]>(saved?.hiddenLibraryKinds ?? [])
    const focusedNodeKey = ref<string | null>(saved?.focusedNodeKey ?? null)
    const focusDepth = ref<number | null>(saved?.focusDepth ?? null)
    const focusMode = ref<FocusMode>(
        saved?.focusMode === 'importers' || saved?.focusMode === 'imports'
            ? saved.focusMode
            : 'connected',
    )
    const nodePositions = ref<Record<string, Record<string, { x: number; y: number }>>>(
        saved?.nodePositions && typeof saved.nodePositions === 'object' ? saved.nodePositions : {},
    )
    const viewports = ref<Record<string, { x: number; y: number; zoom: number }>>(
        saved?.viewports && typeof saved.viewports === 'object' ? saved.viewports : {},
    )

    const folders = computed(() => listFolders(rawData.value))
    const selectedFolder = computed(
        () => folders.value.find((folder) => folder.path === selectedFolderPath.value) ?? null,
    )
    const visibleStructure = computed<Structure>(() =>
        selectedFolder.value ? [selectedFolder.value.folder] : rawData.value,
    )
    const graphBasePath = computed(() => selectedFolder.value?.parentPath ?? '')
    const extensions = computed(() => listExtensions(visibleStructure.value))
    const enabledExtensions = computed(
        () => new Set(extensions.value.filter((value) => !hiddenExtensions.value.includes(value))),
    )

    function setData(value: unknown) {
        rawData.value = parseStructure(value)
        if (selectedFolderPath.value && !selectedFolder.value) selectedFolderPath.value = null
    }

    async function loadData(repo: string) {
        loading.value = true
        error.value = ''
        const params = new URLSearchParams({ repo })
        try {
            const response = await fetch(`/data/graph?${params}`, {
                signal: AbortSignal.timeout(10_000),
            })
            if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`)
            setData(await response.json())
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : 'Unknown error.'
        } finally {
            loading.value = false
        }
    }

    function selectFolder(id: string | null) {
        selectedFolderPath.value = id
    }

    function setExtensionEnabled(extension: string, enabled: boolean) {
        const hidden = new Set(hiddenExtensions.value)
        if (enabled) hidden.delete(extension)
        else hidden.add(extension)
        hiddenExtensions.value = [...hidden]
    }

    function hideNode(key: string) {
        const subtreeKeys = key.startsWith('folder:')
            ? collectSubtreeNodeKeys(rawData.value, key)
            : [key]
        const keys = subtreeKeys.length ? subtreeKeys : [key]
        hiddenNodeKeys.value = [...new Set([...hiddenNodeKeys.value, ...keys])]
        if (focusedNodeKey.value && keys.includes(focusedNodeKey.value)) clearFocus()
    }

    function toggleLibraryKind(kind: LibraryKind) {
        const hidden = new Set(hiddenLibraryKinds.value)
        if (hidden.has(kind)) hidden.delete(kind)
        else hidden.add(kind)
        hiddenLibraryKinds.value = [...hidden]
    }

    function clearHiddenNodes() {
        hiddenNodeKeys.value = []
        hiddenLibraryKinds.value = []
    }

    function focusNode(key: string, mode: FocusMode = 'connected') {
        focusedNodeKey.value = key
        focusMode.value = mode
        focusDepth.value = null
    }

    function clearFocus() {
        focusedNodeKey.value = null
        focusDepth.value = null
    }

    function setFocusDepth(depth: number | null) {
        focusDepth.value = depth
    }

    function setNodePosition(repository: string, key: string, position: { x: number; y: number }) {
        nodePositions.value = {
            ...nodePositions.value,
            [repository]: { ...nodePositions.value[repository], [key]: position },
        }
    }

    function setViewport(repository: string, viewport: { x: number; y: number; zoom: number }) {
        viewports.value = { ...viewports.value, [repository]: viewport }
    }

    function savePreferences() {
        return provider.store<AppDataPreferences>(storageKey, {
            selectedFolderPath: selectedFolderPath.value,
            hiddenExtensions: hiddenExtensions.value,
            hiddenNodeKeys: hiddenNodeKeys.value,
            hiddenLibraryKinds: hiddenLibraryKinds.value,
            focusedNodeKey: focusedNodeKey.value,
            focusDepth: focusDepth.value,
            focusMode: focusMode.value,
            nodePositions: nodePositions.value,
            viewports: viewports.value,
        })
    }

    return {
        rawData,
        loading,
        error,
        selectedFolderPath,
        hiddenExtensions,
        hiddenNodeKeys,
        hiddenLibraryKinds,
        focusedNodeKey,
        focusDepth,
        focusMode,
        nodePositions,
        viewports,
        folders,
        selectedFolder,
        visibleStructure,
        graphBasePath,
        extensions,
        enabledExtensions,
        loadData,
        setData,
        selectFolder,
        setExtensionEnabled,
        hideNode,
        toggleLibraryKind,
        clearHiddenNodes,
        focusNode,
        clearFocus,
        setFocusDepth,
        setNodePosition,
        setViewport,
        savePreferences,
    }
})
