<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef } from 'vue'
import { Background } from '@vue-flow/background'
import { ControlButton, Controls } from '@vue-flow/controls'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import AstNode from './AstNode.vue'
import { exportAst, subscribeAst } from './compiler/visualiser'
import './assets/ast-visualiser.css'

const graph = shallowRef(exportAst())
const { onInit, setViewport, fitView, getViewport } = useVueFlow()

const fitFromTop = async (): Promise<void> => {
  await fitView({ padding: 0.16 })
  const viewport = getViewport()
  await setViewport({ x: viewport.x, y: 24, zoom: viewport.zoom })
}

const refreshGraph = (): void => {
  graph.value = exportAst()
  void nextTick(fitFromTop)
}

const unsubscribeAst = subscribeAst(refreshGraph)
onBeforeUnmount(unsubscribeAst)

onInit(() => void fitFromTop())

function resetTransform(): void {
  setViewport({ x: 0, y: 0, zoom: 1 })
}
</script>

<template>
  <div class="ast-visualiser">
    <VueFlow
      :nodes="graph.n"
      :edges="graph.e"
      class="ast-flow"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.2"
      :max-zoom="4"
    >
      <template #node-ast="nodeProps">
        <AstNode v-bind="nodeProps" />
      </template>
      <Background pattern-color="#4a4f5d" :gap="18" />
      <Controls position="top-left">
        <ControlButton title="Reset view" @click="resetTransform">
          <span aria-hidden="true">↺</span>
        </ControlButton>
      </Controls>
    </VueFlow>
  </div>
</template>

<style scoped>
.ast-visualiser,
.ast-flow {
  width: 100%;
  height: 100%;
}
.ast-visualiser {
  background: #20232a;
}
</style>
