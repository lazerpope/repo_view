<script setup lang="ts">
import {
    IconAdjustments,
    IconBox,
    IconDownload,
    IconEye,
    IconEyeOff,
    IconFileCode,
    IconFolder,
    IconFocus2,
    IconFocusCentered,
    IconRefresh,
    IconRoute,
    IconX,
    IconMenu2,
    IconZoomIn,
    IconZoomOut,
} from '@tabler/icons-vue'
import { Background } from '@vue-flow/background'
import { VueFlow, useVueFlow, type NodeMouseEvent } from '@vue-flow/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { applyConnectionCurves, applyGraphView, buildGraph } from '../graph.ts'
import { useAppData, type LibraryKind } from '../stores/appData.ts'
import {
    connectionKinds,
    nodeKinds,
    useAppUI,
    type ConnectionKind,
    type NodeKind,
} from '../stores/appUI.ts'

const appData = useAppData()
const appUI = useAppUI()
const { fitView, onNodesInitialized } = useVueFlow()
const graphCanvas = ref<HTMLElement | null>(null)
const nodeMenuElement = ref<HTMLElement | null>(null)
const initialViewFitted = ref(false)
const repositoryModalOpen = ref(!appUI.currentRepository)
const repositories = ref<string[]>([])
const repositoriesLoading = ref(false)
const repositoriesError = ref('')
const repositoryLink = ref('')
const repositoryLinkChecked = ref(false)

const repositoryLinkIsValid = computed(() => {
    const value = repositoryLink.value.trim()
    if (!value) return false

    try {
        const url = new URL(value)
        return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
    } catch {
        return false
    }
})

const topologyGraph = computed(() =>
    buildGraph(appData.visibleStructure, {
        basePath: appData.graphBasePath,
        enabledExtensions: appData.enabledExtensions,
    }),
)
const graphView = computed(() =>
    applyGraphView(topologyGraph.value, {
        hiddenNodeKeys: appData.hiddenNodeKeys,
        hiddenNodeKinds: appData.hiddenLibraryKinds,
        focusedNodeKey: appData.focusedNodeKey,
        focusDepth: appData.focusDepth,
    }),
)
const graph = computed(() =>
    applyConnectionCurves(graphView.value, {
        contains: appUI.connectionStyles.contains.curve,
        imports: appUI.connectionStyles.imports.curve,
    }),
)
const focusDepthStep = computed({
    get: () => appData.focusDepth ?? 7,
    set: (value: number) => appData.setFocusDepth(value === 7 ? null : value),
})
const graphVisualStyle = computed<Record<string, string>>(() => {
    const variables: Record<string, string> = {}

    for (const kind of nodeKinds) {
        const style = appUI.nodeStyles[kind]
        variables[`--${kind}-node-color`] = style.color
        variables[`--${kind}-node-background`] = style.backgroundColor
        variables[`--${kind}-node-font-size`] = `${style.fontSize}px`
    }
    for (const kind of connectionKinds) {
        const style = appUI.connectionStyles[kind]
        variables[`--${kind}-edge-color`] = style.color
        variables[`--${kind}-edge-dasharray`] =
            style.line === 'dashed' ? '8 5' : style.line === 'dotted' ? '2 5' : 'none'
        variables[`--${kind}-edge-animation-dasharray`] =
            style.line === 'dashed' ? '8 5' : style.line === 'dotted' ? '2 5' : '5'
    }

    return variables
})
const graphVisualClasses = computed(() =>
    connectionKinds
        .filter((kind) => appUI.connectionStyles[kind].animated)
        .map((kind) => `${kind}-edges-animated`),
)

const nodeLabels: Record<NodeKind, string> = {
    folder: 'Folder',
    file: 'File',
    lib: 'Library',
    'lib-external': 'External',
    'lib-builtin': 'Built-in',
}
const connectionLabels: Record<ConnectionKind, string> = {
    contains: 'Contains',
    imports: 'Imports',
}

function isLibraryKind(kind: NodeKind): kind is LibraryKind {
    return kind === 'lib' || kind === 'lib-external' || kind === 'lib-builtin'
}

function legendLineStyle(kind: ConnectionKind) {
    const style = appUI.connectionStyles[kind]
    return {
        stroke: style.color,
        strokeDasharray:
            style.line === 'dashed' ? '8 5' : style.line === 'dotted' ? '2 5' : undefined,
    }
}

function legendPath(kind: ConnectionKind) {
    const curve = appUI.connectionStyles[kind].curve
    if (curve === 'step') return 'M 1 2 H 16 V 14 H 31'
    if (curve === 'smoothstep') return 'M 1 2 C 9 2 9 14 16 14 S 23 2 31 2'
    if (curve === 'bezier') return 'M 1 14 C 8 0 24 0 31 14'
    return 'M 1 8 L 31 8'
}

function fitGraph() {
    void fitView({ padding: 0.18, maxZoom: 1 })
}

async function loadRepositories() {
    repositoriesLoading.value = true
    repositoriesError.value = ''

    try {
        const response = await fetch('/data/projects', { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`)

        const value: unknown = await response.json()
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
            throw new Error('Server returned an invalid repository list.')
        }
        repositories.value = value
    } catch (cause) {
        repositories.value = []
        repositoriesError.value = cause instanceof Error ? cause.message : 'Unknown error.'
    } finally {
        repositoriesLoading.value = false
    }
}

async function loadCurrentRepository() {
    if (!appUI.currentRepository) return
    initialViewFitted.value = false
    appData.setData([])
    await appData.loadData(appUI.currentRepository)
}

async function selectRepository(repository: string) {
    appUI.currentRepository = repository
    repositoryModalOpen.value = false
    await loadCurrentRepository()
}

function openRepositoryModal() {
    repositoryModalOpen.value = true
    void loadRepositories()
}

function submitRepositoryLink() {
    repositoryLinkChecked.value = true
    if (repositoryLinkIsValid.value) {
        console.log('Repository link is valid:', repositoryLink.value.trim())
    } else {
        console.log('Repository link is not valid:', repositoryLink.value)
    }
}

function openNodeMenu({ event, node }: NodeMouseEvent) {
    const kind = node.data.kind
    const point = 'touches' in event ? (event.touches[0] ?? event.changedTouches[0]) : event
    if ((kind !== 'folder' && kind !== 'file') || !point || !graphCanvas.value) {
        appUI.closeNodeMenu()
        return
    }

    const bounds = graphCanvas.value.getBoundingClientRect()
    appUI.openNodeMenu({
        key: String(node.data.key),
        label: String(node.data.label),
        kind,
        x: Math.max(8, Math.min(point.clientX - bounds.left, bounds.width - 230)),
        y: Math.max(8, Math.min(point.clientY - bounds.top, bounds.height - 140)),
    })
}

function hideMenuNode() {
    if (!appUI.nodeMenu) return
    appData.hideNode(appUI.nodeMenu.key)
    appUI.closeNodeMenu()
}

function focusMenuNode() {
    if (!appUI.nodeMenu) return
    appData.focusNode(appUI.nodeMenu.key)
    appUI.closeNodeMenu()
}

function closeMenuFromOutside(event: PointerEvent) {
    if (!appUI.nodeMenu || nodeMenuElement.value?.contains(event.target as globalThis.Node)) return
    appUI.closeNodeMenu()
}

onNodesInitialized(() => {
    if (initialViewFitted.value || !graph.value.nodes.length) return
    initialViewFitted.value = true
    fitGraph()
})
onMounted(async () => {
    document.addEventListener('pointerdown', closeMenuFromOutside)
    await loadRepositories()

    if (
        appUI.currentRepository &&
        !repositoriesError.value &&
        repositories.value.includes(appUI.currentRepository)
    ) {
        repositoryModalOpen.value = false
        await loadCurrentRepository()
        return
    }

    appUI.currentRepository = null
    appData.setData([])
    repositoryModalOpen.value = true
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeMenuFromOutside))
</script>

<template>
    <main class="graph-page">
        <header class="toolbar">
            <button
                type="button"
                class="repository-menu-button"
                title="Choose a repository"
                @click="openRepositoryModal"
            >
                <span style="font-size: 1.5rem">Project graph </span>
                <IconMenu-2 :size="20" style="transform: translate(0, 4px)" />
                <small v-if="appUI.currentRepository">{{ appUI.currentRepository }}</small>
            </button>
            <div class="toolbar-actions">
                <button
                    class="icon-button"
                    :disabled="appData.loading || !appUI.currentRepository"
                    title="Reload backend data"
                    @click="loadCurrentRepository"
                >
                    <IconRefresh :size="20" :class="{ spinning: appData.loading }" />
                </button>
                <button
                    v-if="!appUI.sidebarOpen"
                    class="icon-button"
                    title="Open graph settings"
                    @click="appUI.openSidebar()"
                >
                    <IconAdjustments :size="19" />
                </button>
            </div>
        </header>

        <section
            v-if="appUI.currentRepository"
            ref="graphCanvas"
            class="graph-canvas"
            :class="graphVisualClasses"
            :style="graphVisualStyle"
            aria-label="Project structure graph"
            :aria-busy="appData.loading"
        >
            <VueFlow
                :nodes="graph.nodes"
                :edges="graph.edges"
                :min-zoom="0.1"
                :max-zoom="3"
                :nodes-connectable="false"
                :delete-key-code="null"
                @node-click="openNodeMenu"
                @pane-click="appUI.closeNodeMenu"
            >
                <template #node-default="{ data }">
                    <span class="node-kind">{{ data.kind }}</span>
                    <strong class="node-label">{{ data.label }}</strong>
                </template>
                <Background pattern-color="#334155" :gap="22" />
            </VueFlow>

            <div
                v-if="appUI.nodeMenu"
                ref="nodeMenuElement"
                class="node-menu"
                :style="{ left: `${appUI.nodeMenu.x}px`, top: `${appUI.nodeMenu.y}px` }"
                @pointerdown.stop
            >
                <strong :title="appUI.nodeMenu.label">{{ appUI.nodeMenu.label }}</strong>
                <button type="button" title="Hide this node" @click="hideMenuNode">
                    <IconEyeOff :size="17" />
                    Hide
                </button>
                <button type="button" title="Show graph from this node" @click="focusMenuNode">
                    <IconFocus2 :size="17" />
                    Explore from here
                </button>
            </div>

            <div v-if="appData.error" class="notice" role="alert">
                <strong>Could not load the project graph</strong>
                <p>{{ appData.error }}</p>
                <button class="primary-button" @click="loadCurrentRepository">
                    <IconRefresh :size="17" />
                    Try again
                </button>
            </div>
            <div v-else-if="appData.loading" class="notice" role="status">
                Loading project graph...
            </div>
            <div v-else-if="!graph.nodes.length" class="notice" role="status">
                No nodes match the current filters.
            </div>

            <div class="legend" aria-label="Graph legend">
                <template v-for="kind in nodeKinds" :key="kind">
                    <button
                        v-if="isLibraryKind(kind)"
                        class="legend-node legend-toggle"
                        :class="{ hidden: appData.hiddenLibraryKinds.includes(kind) }"
                        :style="{
                            color: appUI.nodeStyles[kind].color,
                            backgroundColor: appUI.nodeStyles[kind].backgroundColor,
                        }"
                        :title="`Toggle ${nodeLabels[kind]}`"
                        :aria-pressed="!appData.hiddenLibraryKinds.includes(kind)"
                        @click="appData.toggleLibraryKind(kind)"
                    >
                        {{ nodeLabels[kind] }}
                    </button>
                    <span
                        v-else
                        class="legend-node"
                        :style="{
                            color: appUI.nodeStyles[kind].color,
                            backgroundColor: appUI.nodeStyles[kind].backgroundColor,
                        }"
                    >
                        {{ nodeLabels[kind] }}
                    </span>
                </template>
                <span v-for="kind in connectionKinds" :key="kind" class="legend-connection">
                    <svg width="32" height="16" viewBox="0 0 32 16" aria-hidden="true">
                        <path
                            :d="legendPath(kind)"
                            :style="legendLineStyle(kind)"
                            :class="{ animated: appUI.connectionStyles[kind].animated }"
                        />
                    </svg>
                    {{ connectionLabels[kind] }}
                </span>
            </div>

            <div class="extension-filters">
                <label v-for="extension in appData.extensions" :key="extension">
                    <input
                        type="checkbox"
                        :checked="appData.enabledExtensions.has(extension)"
                        @change="
                            appData.setExtensionEnabled(
                                extension,
                                ($event.target as HTMLInputElement).checked,
                            )
                        "
                    />
                    <IconFileCode :size="15" />
                    <span>{{ extension }}</span>
                </label>
            </div>

            <div class="graph-count" aria-label="Graph filters and controls">
                <span class="count-item" title="Nodes">
                    <IconBox :size="17" />
                    {{ graph.nodes.length }}
                </span>
                <span class="count-item" title="Connections">
                    <IconRoute :size="17" />
                    {{ graph.edges.length }}
                </span>
                <div v-if="appData.focusedNodeKey" class="focus-depth" title="Connection depth">
                    <IconRoute :size="17" />
                    <input v-model.number="focusDepthStep" type="range" min="1" max="7" step="1" />
                    <output>{{ appData.focusDepth ?? '∞' }}</output>
                </div>
                <button
                    v-if="appData.hiddenNodeKeys.length || appData.hiddenLibraryKinds.length"
                    class="icon-button"
                    title="Unhide all"
                    @click="appData.clearHiddenNodes"
                >
                    <IconEye :size="19" />
                </button>
                <button
                    v-if="appData.focusedNodeKey"
                    class="icon-button danger-button"
                    title="Exit focused view"
                    @click="appData.clearFocus"
                >
                    <IconX :size="19" />
                </button>
                <button class="icon-button" title="Fit graph" @click="fitGraph">
                    <IconFocusCentered :size="19" />
                </button>
            </div>
        </section>

        <div
            v-if="repositoryModalOpen"
            class="repository-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="repository-modal-title"
        >
            <section class="repository-dialog">
                <button
                    v-if="appUI.currentRepository"
                    type="button"
                    class="icon-button repository-dialog-close"
                    title="Close repository chooser"
                    @click="repositoryModalOpen = false"
                >
                    <IconX :size="20" />
                </button>

                <div class="repository-dialog-heading">
                    <span class="repository-dialog-icon"><IconFolder :size="26" /></span>
                    <div>
                        <h1 id="repository-modal-title">Choose a repository</h1>
                        <p>Select a local project to open its graph.</p>
                    </div>
                </div>

                <div class="repository-list" aria-live="polite">
                    <p v-if="repositoriesLoading" class="repository-list-status">
                        Loading repositories...
                    </p>
                    <div v-else-if="repositoriesError" class="repository-list-status error-text">
                        <p>{{ repositoriesError }}</p>
                        <button type="button" @click="loadRepositories">
                            <IconRefresh :size="17" />
                            Try again
                        </button>
                    </div>
                    <p v-else-if="!repositories.length" class="repository-list-status">
                        No repositories were found.
                    </p>
                    <template v-else>
                        <button
                            v-for="repository in repositories"
                            :key="repository"
                            type="button"
                            class="repository-choice"
                            :class="{ selected: repository === appUI.currentRepository }"
                            @click="selectRepository(repository)"
                        >
                            <IconFolder :size="19" />
                            <span>{{ repository }}</span>
                        </button>
                    </template>
                </div>

                <div class="repository-divider"><span>or clone a repository</span></div>

                <form
                    class="repository-link-form"
                    novalidate
                    @submit.prevent="submitRepositoryLink"
                >
                    <label for="repository-link">Repository URL</label>
                    <div class="repository-link-control">
                        <input
                            id="repository-link"
                            v-model="repositoryLink"
                            type="url"
                            inputmode="url"
                            autocomplete="url"
                            placeholder="https://github.com/owner/repository.git"
                            :aria-invalid="repositoryLinkChecked && !repositoryLinkIsValid"
                            @input="repositoryLinkChecked = false"
                        />
                        <button type="submit" class="icon-button" title="Download repository">
                            <IconDownload :size="20" />
                        </button>
                    </div>
                    <p
                        v-if="repositoryLinkChecked"
                        class="repository-link-result"
                        :class="{ 'error-text': !repositoryLinkIsValid }"
                    >
                        {{
                            repositoryLinkIsValid
                                ? 'Repository link looks valid.'
                                : 'Enter a valid HTTP or HTTPS repository URL.'
                        }}
                    </p>
                </form>
            </section>
        </div>
    </main>
</template>
