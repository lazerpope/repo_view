<script setup lang="ts">
import {
    IconAdjustments,
    IconBox,
    IconFileCode,
    IconFocusCentered,
    IconRefresh,
    IconRoute,
    IconZoomIn,
    IconZoomOut,
} from '@tabler/icons-vue'
import { Background } from '@vue-flow/background'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { computed, nextTick, onMounted, watch } from 'vue'
import { buildGraph } from '../graph.ts'
import { useAppData } from '../stores/appData.ts'
import {
    connectionKinds,
    nodeKinds,
    useAppUI,
    type ConnectionKind,
    type NodeKind,
} from '../stores/appUI.ts'

const appData = useAppData()
const appUI = useAppUI()
const { fitView, onNodesInitialized, zoomIn, zoomOut } = useVueFlow()

const graph = computed(() =>
    buildGraph(appData.visibleStructure, {
        basePath: appData.graphBasePath,
        enabledExtensions: appData.enabledExtensions,
        nodeStyles: appUI.nodeStyles,
        connectionStyles: appUI.connectionStyles,
    }),
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

function increaseZoom() {
    void zoomIn()
}

function decreaseZoom() {
    void zoomOut()
}

onNodesInitialized(fitGraph)
watch(graph, () => void nextTick(fitGraph))
onMounted(() => {
    if (!appData.rawData.length) void appData.loadData()
})
</script>

<template>
    <main class="graph-page">
        <header class="toolbar">
            <div>
                <h1>Project graph</h1>
                <p>{{ appData.selectedFolder?.displayPath ?? 'Entire project' }}</p>
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
                fit-view-on-init
            >
                <template #node-default="{ data }">
                    <span class="node-kind">{{ data.kind }}</span>
                    <strong class="node-label">{{ data.label }}</strong>
                </template>
                <Background pattern-color="#334155" :gap="22" />
            </VueFlow>

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
                <span
                    v-for="kind in nodeKinds"
                    :key="kind"
                    class="legend-node"
                    :style="{
                        color: appUI.nodeStyles[kind].color,
                        backgroundColor: appUI.nodeStyles[kind].backgroundColor,
                        fontSize: `${appUI.nodeStyles[kind].fontSize * 0.78}px`,
                    }"
                >
                    {{ nodeLabels[kind] }}
                </span>
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
                <button class="icon-button" title="Zoom in" @click="increaseZoom">
                    <IconZoomIn :size="19" />
                </button>
                <button class="icon-button" title="Zoom out" @click="decreaseZoom">
                    <IconZoomOut :size="19" />
                </button>
                <button class="icon-button" title="Fit graph" @click="fitGraph">
                    <IconFocusCentered :size="19" />
                </button>
             
            </div>
        </section>
    </main>
</template>
