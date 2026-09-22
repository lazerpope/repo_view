<script setup lang="ts">
import { BaseEdge, getStraightPath, type EdgeProps } from '@vue-flow/core'
import { computed } from 'vue'

interface DirectionalEdgeData {
    straightArrowCount?: number
    straightArrowSpacing?: number
    straightArrowReverse?: boolean
}

const props = defineProps<EdgeProps<DirectionalEdgeData>>()

const edgePath = computed(() =>
    getStraightPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
    }),
)

const arrowPaths = computed(() => {
    const deltaX = props.targetX - props.sourceX
    const deltaY = props.targetY - props.sourceY
    const edgeLength = Math.hypot(deltaX, deltaY)
    const maximum = Math.max(0, Math.min(8, Math.round(props.data.straightArrowCount ?? 2)))
    if (!maximum || edgeLength < 1) return []

    const spacing = Math.max(50, props.data.straightArrowSpacing ?? 400)
    const count = Math.min(maximum, Math.max(1, Math.ceil(edgeLength / spacing)))
    const direction = props.data.straightArrowReverse ? -1 : 1
    const unitX = (deltaX / edgeLength) * direction
    const unitY = (deltaY / edgeLength) * direction
    const perpendicularX = -unitY
    const perpendicularY = unitX
    const spread = count === 1 ? 0 : Math.min(0.45, (count - 1) * 0.12)

    return Array.from({ length: count }, (_, index) => {
        const fraction = count === 1 ? 0.5 : 0.5 - spread / 2 + (spread * index) / (count - 1)
        const centerX = props.sourceX + deltaX * fraction
        const centerY = props.sourceY + deltaY * fraction
        const tipX = centerX + unitX * 7
        const tipY = centerY + unitY * 7
        const backX = centerX - unitX * 7
        const backY = centerY - unitY * 7

        return [
            `M ${backX + perpendicularX * 5} ${backY + perpendicularY * 5}`,
            `L ${tipX} ${tipY}`,
            `L ${backX - perpendicularX * 5} ${backY - perpendicularY * 5}`,
        ].join(' ')
    })
})
</script>

<template>
    <BaseEdge
        :id="id"
        :path="edgePath[0]"
        :label-x="edgePath[1]"
        :label-y="edgePath[2]"
        :label="label"
        :marker-start="markerStart"
        :marker-end="markerEnd"
        :interaction-width="interactionWidth"
    />
    <path
        v-for="(arrowPath, index) in arrowPaths"
        :key="index"
        class="direction-arrow"
        :d="arrowPath"
    />
</template>
