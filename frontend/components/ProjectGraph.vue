<script setup lang="ts">
import {
    IconAdjustments,
    IconBox,
    IconEye,
    IconEyeOff,
    IconFileCode,
    IconFocus2,
    IconFocusCentered,
    IconRefresh,
    IconRoute,
    IconX,
    IconZoomIn,
    IconZoomOut,
} from '@tabler/icons-vue'
import { Background } from '@vue-flow/background'
import { VueFlow, useVueFlow, type NodeMouseEvent } from '@vue-flow/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { applyGraphView, buildGraph } from '../graph.ts'
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

const baseGraph = computed(() =>
    buildGraph(appData.visibleStructure, {
        basePath: appData.graphBasePath,
        enabledExtensions: appData.enabledExtensions,
        nodeStyles: appUI.nodeStyles,
        connectionStyles: appUI.connectionStyles,
    }),
)
const graph = computed(() =>
    applyGraphView(baseGraph.value, {
        hiddenNodeKeys: appData.hiddenNodeKeys,
        hiddenNodeKinds: appData.hiddenLibraryKinds,
        focusedNodeKey: appData.focusedNodeKey,
        focusDepth: appData.focusDepth,
    }),
)
const focusDepthStep = computed({
    get: () => appData.focusDepth ?? 7,
    set: (value: number) => appData.setFocusDepth(value === 7 ? null : value),
})

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
onMounted(() => {
    document.addEventListener('pointerdown', closeMenuFromOutside)
    if (!appData.rawData.length) void appData.loadData()
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeMenuFromOutside))
</script>

<template>
    <main class="graph-page">
        <header class="toolbar">
            <div>
                <h1>Project graph <IconAdjustments :size="20"  /></h1>
                
            </div>
            <div class="toolbar-actions">
                <button
                    class="icon-button"
                    :disabled="appData.loading"
                    title="Reload backend data"
                    @click="appData.loadData"
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
            ref="graphCanvas"
            class="graph-canvas"
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
                <button class="primary-button" @click="appData.loadData">
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
    </main>
</template>
