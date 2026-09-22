<script setup lang="ts">
import {
    IconAdjustments,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconArrowsExchange,
    IconBox,
    IconCheck,
    IconDeviceFloppy,
    IconDownload,
    IconEye,
    IconEyeOff,
    IconFileCode,
    IconFolder,
    IconFocusCentered,
    IconRefresh,
    IconRoute,
    IconX,
    IconMenu2,
    IconZoomIn,
    IconZoomOut,
} from '@tabler/icons-vue'
import { Background } from '@vue-flow/background'
import {
    VueFlow,
    useVueFlow,
    type NodeDragEvent,
    type NodeMouseEvent,
    type ViewportTransform,
} from '@vue-flow/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { applyConnectionCurves, applyGraphView, buildGraph } from '../graph.ts'
import { useAppData, type LibraryKind } from '../stores/appData.ts'
import {
    connectionKinds,
    nodeKinds,
    useAppUI,
    type ConnectionKind,
    type FocusMode,
    type NodeKind,
} from '../stores/appUI.ts'
import DirectionalStraightEdge from './DirectionalStraightEdge.vue'

const appData = useAppData()
const appUI = useAppUI()
const { fitView, onNodesInitialized, setViewport } = useVueFlow()
const graphCanvas = ref<HTMLElement | null>(null)
const nodeMenuElement = ref<HTMLElement | null>(null)
const initialViewFitted = ref(false)
const repositoryModalOpen = ref(!appUI.currentRepository)
const repositories = ref<string[]>([])
const repositoriesLoading = ref(false)
const repositoriesError = ref('')
const repositoryLink = ref('')
const repositoryRef = ref('')
const repositoryLinkChecked = ref(false)
const activeJob = ref<JobState | null>(null)
const activeJobKind = ref<'download' | 'rebuild' | null>(null)
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let jobEvents: EventSource | null = null

interface JobState {
    id: string
    phase:
        | 'queued'
        | 'resolving'
        | 'downloading'
        | 'extracting'
        | 'parsing'
        | 'saving'
        | 'complete'
        | 'error'
    message: string
    percent?: number
    repository?: string
}

type JobProgressPhase = Exclude<JobState['phase'], 'queued' | 'complete' | 'error'>
type JobStageStatus = 'pending' | 'active' | 'done' | 'error'

const repositoryJobStages: ReadonlyArray<{ phase: JobProgressPhase; label: string }> = [
    { phase: 'resolving', label: 'Resolve' },
    { phase: 'downloading', label: 'Download' },
    { phase: 'extracting', label: 'Extract' },
    { phase: 'parsing', label: 'Parse' },
    { phase: 'saving', label: 'Save' },
]
const lastJobProgressPhase = ref<JobProgressPhase | null>(null)

const jobRunning = computed(
    () => activeJob.value !== null && !['complete', 'error'].includes(activeJob.value.phase),
)

function isJobProgressPhase(phase: JobState['phase']): phase is JobProgressPhase {
    return repositoryJobStages.some((stage) => stage.phase === phase)
}

function repositoryJobStageStatus(phase: JobProgressPhase): JobStageStatus {
    const job = activeJob.value
    if (!job) return 'pending'
    if (job.phase === 'complete') return 'done'

    const currentPhase = isJobProgressPhase(job.phase) ? job.phase : lastJobProgressPhase.value
    if (!currentPhase) return job.phase === 'error' ? 'error' : 'pending'

    const currentIndex = repositoryJobStages.findIndex((stage) => stage.phase === currentPhase)
    const stageIndex = repositoryJobStages.findIndex((stage) => stage.phase === phase)
    if (stageIndex < currentIndex) return 'done'
    if (stageIndex > currentIndex) return 'pending'
    return job.phase === 'error' ? 'error' : 'active'
}

function repositoryJobStagePercent(phase: JobProgressPhase): number | undefined {
    return activeJob.value?.phase === phase ? activeJob.value.percent : undefined
}

const repositoryLinkIsValid = computed(() => {
    const value = repositoryLink.value.trim()
    if (!value) return false

    try {
        const url = new URL(value)
        return (
            url.protocol === 'https:' &&
            (url.hostname === 'github.com' || url.hostname === 'gitlab.com')
        )
    } catch {
        return false
    }
})

const topologyGraph = computed(() => {
    const topology = buildGraph(appData.visibleStructure, {
        basePath: appData.graphBasePath,
        enabledExtensions: appData.enabledExtensions,
    })
    const positions = appUI.currentRepository
        ? (appData.nodePositions[appUI.currentRepository] ?? {})
        : {}
    return {
        ...topology,
        nodes: topology.nodes.map((node) => {
            const position = positions[String(node.data.key)]
            return position ? { ...node, position } : node
        }),
    }
})
const graphView = computed(() =>
    applyGraphView(topologyGraph.value, {
        hiddenNodeKeys: appData.hiddenNodeKeys,
        hiddenNodeKinds: appData.hiddenLibraryKinds,
        focusedNodeKey: appData.focusedNodeKey,
        focusDepth: appData.focusDepth,
        focusMode: appData.focusMode,
    }),
)
const graph = computed(() =>
    applyConnectionCurves(
        graphView.value,
        {
            contains: appUI.connectionStyles.contains.curve,
            imports: appUI.connectionStyles.imports.curve,
        },
        {
            contains: {
                count: appUI.connectionStyles.contains.straightArrowCount,
                spacing: appUI.connectionStyles.contains.straightArrowSpacing,
            },
            imports: {
                count: appUI.connectionStyles.imports.straightArrowCount,
                spacing: appUI.connectionStyles.imports.straightArrowSpacing,
            },
        },
    ),
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

async function startRemoteJob(endpoint: string, body: Record<string, unknown>): Promise<JobState> {
    jobEvents?.close()
    lastJobProgressPhase.value = 'resolving'
    activeJob.value = { id: '', phase: 'queued', message: 'Starting job' }
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    })
    const result = (await response.json()) as { jobId?: string; error?: string }
    if (!response.ok || !result.jobId) throw new Error(result.error ?? `HTTP ${response.status}`)

    return new Promise((resolveJob, rejectJob) => {
        const events = new EventSource(`/data/jobs/${encodeURIComponent(result.jobId!)}/events`)
        jobEvents = events
        events.onmessage = (event) => {
            const state = JSON.parse(event.data) as JobState
            activeJob.value = state
            if (isJobProgressPhase(state.phase)) lastJobProgressPhase.value = state.phase
            if (state.phase === 'complete') {
                events.close()
                jobEvents = null
                resolveJob(state)
            } else if (state.phase === 'error') {
                events.close()
                jobEvents = null
                rejectJob(new Error(state.message))
            }
        }
        events.onerror = () => {
            events.close()
            jobEvents = null
            rejectJob(new Error('Lost connection to the repository job.'))
        }
    })
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

async function submitRepositoryLink() {
    repositoryLinkChecked.value = true
    if (!repositoryLinkIsValid.value) return

    try {
        activeJobKind.value = 'download'
        const result = await startRemoteJob('/data/repositories/download', {
            url: repositoryLink.value.trim(),
            ref: repositoryRef.value.trim() || undefined,
        })
        if (!result.repository) throw new Error('Download completed without a repository name.')
        await loadRepositories()
        await selectRepository(result.repository)
        repositoryLink.value = ''
        repositoryRef.value = ''
        repositoryLinkChecked.value = false
        activeJob.value = null
        activeJobKind.value = null
    } catch (cause) {
        activeJob.value = {
            id: activeJob.value?.id ?? '',
            phase: 'error',
            message: cause instanceof Error ? cause.message : 'Repository download failed.',
        }
    }
}

async function rebuildCurrentRepository() {
    if (!appUI.currentRepository || jobRunning.value) return
    try {
        activeJobKind.value = 'rebuild'
        await startRemoteJob('/data/graph/rebuild', { repo: appUI.currentRepository })
        await loadCurrentRepository()
        activeJob.value = null
        activeJobKind.value = null
    } catch (cause) {
        activeJob.value = {
            id: activeJob.value?.id ?? '',
            phase: 'error',
            message: cause instanceof Error ? cause.message : 'Graph rebuild failed.',
        }
    }
}

async function saveWorkspace() {
    saveState.value = 'saving'
    try {
        await Promise.all([appUI.savePreferences(), appData.savePreferences()])
        saveState.value = 'saved'
        setTimeout(() => {
            if (saveState.value === 'saved') saveState.value = 'idle'
        }, 1800)
    } catch (error) {
        console.error('Failed to save workspace:', error)
        saveState.value = 'error'
    }
}

function rememberNodePosition({ node }: NodeDragEvent) {
    if (!appUI.currentRepository) return
    appData.setNodePosition(appUI.currentRepository, String(node.data.key), {
        x: node.position.x,
        y: node.position.y,
    })
}

function rememberViewport(viewport: ViewportTransform) {
    if (appUI.currentRepository) appData.setViewport(appUI.currentRepository, viewport)
}

function openNodeMenu({ event, node }: NodeMouseEvent) {
    const kind = node.data.kind
    const point = 'touches' in event ? (event.touches[0] ?? event.changedTouches[0]) : event
    if (!nodeKinds.includes(kind as NodeKind) || !point || !graphCanvas.value) {
        appUI.closeNodeMenu()
        return
    }

    const bounds = graphCanvas.value.getBoundingClientRect()
    appUI.openNodeMenu({
        key: String(node.data.key),
        label: String(node.data.label),
        kind: kind as NodeKind,
        x: Math.max(8, Math.min(point.clientX - bounds.left, bounds.width - 230)),
        y: Math.max(8, Math.min(point.clientY - bounds.top, bounds.height - 250)),
    })
}

function hideMenuNode() {
    if (!appUI.nodeMenu) return
    appData.hideNode(appUI.nodeMenu.key)
    appUI.closeNodeMenu()
}

function focusMenuNode(mode: FocusMode) {
    if (!appUI.nodeMenu) return
    appData.focusNode(appUI.nodeMenu.key, mode)
    appUI.closeNodeMenu()
}

function closeMenuFromOutside(event: PointerEvent) {
    if (!appUI.nodeMenu || nodeMenuElement.value?.contains(event.target as globalThis.Node)) return
    appUI.closeNodeMenu()
}

onNodesInitialized(() => {
    if (initialViewFitted.value || !graph.value.nodes.length) return
    initialViewFitted.value = true
    const viewport = appUI.currentRepository
        ? appData.viewports[appUI.currentRepository]
        : undefined
    if (viewport) void setViewport(viewport)
    else fitGraph()
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
onBeforeUnmount(() => {
    jobEvents?.close()
    document.removeEventListener('pointerdown', closeMenuFromOutside)
})
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
                    :disabled="appData.loading || jobRunning || !appUI.currentRepository"
                    title="Rebuild graph from repository files"
                    @click="rebuildCurrentRepository"
                >
                    <IconRefresh :size="20" :class="{ spinning: appData.loading || jobRunning }" />
                </button>
                <button
                    class="icon-button"
                    :disabled="saveState === 'saving'"
                    :title="
                        saveState === 'error' ? 'Save failed; try again' : 'Save workspace state'
                    "
                    @click="saveWorkspace"
                >
                    <IconCheck v-if="saveState === 'saved'" :size="20" />
                    <IconDeviceFloppy v-else :size="20" />
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
                @node-drag-stop="rememberNodePosition"
                @pane-click="appUI.closeNodeMenu"
                @viewport-change-end="rememberViewport"
            >
                <template #edge-directional-straight="edgeProps">
                    <DirectionalStraightEdge v-bind="edgeProps" />
                </template>
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
                <button
                    type="button"
                    title="Show every import connection for this node"
                    @click="focusMenuNode('connected')"
                >
                    <IconArrowsExchange :size="17" />
                    Show connected
                </button>
                <template v-if="appUI.nodeMenu.kind !== 'folder'">
                    <button
                        type="button"
                        title="Show files and libraries that import this node"
                        @click="focusMenuNode('importers')"
                    >
                        <IconArrowBackUp :size="17" />
                        Who imports this
                    </button>
                    <button
                        type="button"
                        title="Show files and libraries imported by this node"
                        @click="focusMenuNode('imports')"
                    >
                        <IconArrowForwardUp :size="17" />
                        Imports of this
                    </button>
                </template>
            </div>

            <div v-if="jobRunning" class="notice job-notice" role="status">
                <strong>{{ activeJob?.message }}</strong>
                <progress
                    v-if="activeJob?.percent !== undefined"
                    max="100"
                    :value="activeJob.percent"
                />
                <p v-if="activeJob?.percent !== undefined">{{ activeJob.percent }}%</p>
            </div>
            <div v-else-if="activeJob?.phase === 'error'" class="notice" role="alert">
                <strong>Repository operation failed</strong>
                <p>{{ activeJob.message }}</p>
                <button type="button" @click="activeJob = null">Dismiss</button>
            </div>
            <div v-else-if="appData.error" class="notice" role="alert">
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

                <div class="repository-divider"><span>or download a repository</span></div>

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
                            :disabled="jobRunning"
                            @input="repositoryLinkChecked = false"
                        />
                        <button
                            type="submit"
                            class="icon-button"
                            title="Download repository"
                            :disabled="jobRunning"
                        >
                            <IconDownload :size="20" />
                        </button>
                    </div>
                    <label for="repository-ref">Branch, tag, or commit (optional)</label>
                    <input
                        id="repository-ref"
                        v-model="repositoryRef"
                        class="repository-ref-input"
                        type="text"
                        autocomplete="off"
                        placeholder="Detected from URL or default branch"
                        :disabled="jobRunning"
                    />
                    <p
                        v-if="repositoryLinkChecked"
                        class="repository-link-result"
                        :class="{ 'error-text': !repositoryLinkIsValid }"
                    >
                        {{
                            repositoryLinkIsValid
                                ? 'Repository link looks valid.'
                                : 'Enter a valid GitHub or GitLab HTTPS repository URL.'
                        }}
                    </p>
                    <div
                        v-if="activeJob && activeJobKind === 'download'"
                        class="repository-job"
                        aria-live="polite"
                    >
                        <div
                            v-for="(stage, index) in repositoryJobStages"
                            :key="stage.phase"
                            class="repository-job-stage"
                            :class="`is-${repositoryJobStageStatus(stage.phase)}`"
                        >
                            <span class="repository-job-stage-number">Stage {{ index + 1 }}</span>
                            <strong>{{ stage.label }}</strong>
                            <span class="repository-job-stage-state">
                                <IconCheck
                                    v-if="repositoryJobStageStatus(stage.phase) === 'done'"
                                    :size="18"
                                    aria-label="Complete"
                                />
                                <IconX
                                    v-else-if="repositoryJobStageStatus(stage.phase) === 'error'"
                                    :size="18"
                                    aria-label="Failed"
                                />
                                <IconRefresh
                                    v-else-if="repositoryJobStageStatus(stage.phase) === 'active'"
                                    :size="17"
                                    class="spinning"
                                    aria-label="In progress"
                                />
                                <span v-if="repositoryJobStagePercent(stage.phase) !== undefined">
                                    {{ repositoryJobStagePercent(stage.phase) }}%
                                </span>
                            </span>
                        </div>
                        <p v-if="activeJob.phase === 'error'" class="error-text">
                            {{ activeJob.message }}
                        </p>
                    </div>
                </form>
            </section>
        </div>
    </main>
</template>
