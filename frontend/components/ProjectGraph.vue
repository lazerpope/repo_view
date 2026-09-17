<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { buildGraph, type ProjectGraph } from '../graph'
import type { Structure } from '../shared/types.ts'

const graph = shallowRef<ProjectGraph>({ nodes: [], edges: [] })
const loading = ref(true)
const error = ref('')
const { fitView, onNodesInitialized } = useVueFlow()

onNodesInitialized(() => void fitView({ padding: 0.2, maxZoom: 1 }))

async function loadGraph() {
    loading.value = true
    error.value = ''

    try {
        const response = await fetch('/data', { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`)
        graph.value = buildGraph((await response.json()) as Structure)
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Unknown error.'
    } finally {
        loading.value = false
    }
}

onMounted(loadGraph)
</script>

<template>
    <main class="app-shell">
        <header class="toolbar">
            <div>
                <h1>Project graph</h1>
                <p>Folders, files, and their imports</p>
            </div>
            <div class="toolbar-actions">
                <button :disabled="loading" @click="loadGraph">
                    {{ loading ? 'Loading…' : 'Refresh' }}
                </button>
            </div>
        </header>

        <section class="graph-canvas" aria-label="Project structure graph" :aria-busy="loading">
                <div class="graph-count"
                    >{{ graph.nodes.length }} nodes · {{ graph.edges.length }} connections</div
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
                <Controls :show-interactive="false" />
            </VueFlow>

            <div v-if="error" class="notice" role="alert">
                <strong>Could not load the project graph</strong>
                <p>{{ error }}</p>
                <button @click="loadGraph">Try again</button>
            </div>
            <div v-else-if="loading" class="notice" role="status">Loading project graph…</div>
            <div v-else-if="!graph.nodes.length" class="notice" role="status">
                The backend returned an empty project.
            </div>

            <div class="legend">
                <span class="folder-key">Folder</span>
                <span class="file-key">File</span>
                <span class="dependency-key">Dependency</span>
                <span>Solid: contains · Dashed: imports</span>
            </div>
        </section>
    </main>
</template>
