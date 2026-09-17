<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { AstNodeData } from './compiler/visualiser'
defineProps<NodeProps<AstNodeData>>()
</script>

<template>
  <div class="ast-card-root">
    <Handle type="target" :position="Position.Top" />
    <article class="ast-card">
      <header class="ast-card__header">
        <span class="ast-card__kind">{{ data.title }}</span>
        <span class="ast-card__line">line {{ data.line }}</span>
      </header>
      <div class="ast-card__detail">{{ data.detail }}</div>
    </article>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
