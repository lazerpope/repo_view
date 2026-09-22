<script setup lang="ts">
import {
    IconActivity,
    IconBackground,
    IconBraces,
    IconColorPicker,
    IconLine,
    IconLineDashed,
    IconLineDotted,
    IconPalette,
    IconPlayerPause,
    IconPlayerPlay,
    IconRestore,
    IconRouteSquare,
    IconSlash,
    IconTypography,
    IconVectorSpline,
    IconX,
} from '@tabler/icons-vue'
import { computed, defineAsyncComponent, onBeforeUnmount } from 'vue'
import { useAppData } from '../stores/appData.ts'
import {
    connectionKinds,
    nodeKinds,
    useAppUI,
    type ConnectionKind,
    type NodeKind,
    type SidebarTab,
} from '../stores/appUI.ts'

const appData = useAppData()
const appUI = useAppUI()
const RawJsonEditor = defineAsyncComponent(() => import('./RawJsonEditor.vue'))
const rawJson = computed(() => JSON.stringify(appData.rawData, null, 4))

if (appUI.activeTab === 'folders') appUI.activeTab = 'styles'

const nodeLabels = {
    folder: 'Folder',
    file: 'File',
    lib: 'Library',
    'lib-external': 'External library',
    'lib-builtin': 'Built-in library',
}
const connectionLabels = {
    contains: 'Contains',
    imports: 'Imports',
}
const tabs: { id: SidebarTab; label: string; icon: typeof IconPalette }[] = [
    { id: 'styles', label: 'Styles', icon: IconPalette },
    { id: 'raw', label: 'JSON', icon: IconBraces },
]
const pendingUpdates = new Map<string, () => void>()
let updateFrame: number | null = null

function applyScheduledUpdates() {
    updateFrame = null
    const updates = [...pendingUpdates.values()]
    pendingUpdates.clear()
    for (const update of updates) update()
}

function scheduleUpdate(key: string, update: () => void) {
    pendingUpdates.set(key, update)
    updateFrame ??= requestAnimationFrame(applyScheduledUpdates)
}

function flushScheduledUpdates() {
    if (updateFrame !== null) cancelAnimationFrame(updateFrame)
    if (pendingUpdates.size) applyScheduledUpdates()
}

function inputValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement).value
}

function updateConnectionColor(kind: ConnectionKind, event: Event) {
    const value = inputValue(event)
    scheduleUpdate(`connection:${kind}:color`, () => {
        appUI.connectionStyles[kind].color = value
    })
}

function updateNodeColor(kind: NodeKind, property: 'color' | 'backgroundColor', event: Event) {
    const value = inputValue(event)
    scheduleUpdate(`node:${kind}:${property}`, () => {
        appUI.nodeStyles[kind][property] = value
    })
}

function updateNodeFontSize(kind: NodeKind, event: Event) {
    const value = Number(inputValue(event))
    scheduleUpdate(`node:${kind}:fontSize`, () => {
        appUI.nodeStyles[kind].fontSize = value
    })
}

function saveRawData(value: unknown) {
    try {
        appData.setData(value)
    } catch (cause) {
        window.alert(cause instanceof Error ? cause.message : 'Invalid project data.')
    }
}

function resizeSidebar(event: PointerEvent) {
    const maximum = Math.max(500, window.innerWidth * 0.8)
    const width = Math.max(500, Math.min(maximum, window.innerWidth - event.clientX))
    scheduleUpdate('sidebarWidth', () => {
        appUI.sidebarWidth = width
    })
}

function stopResizing() {
    flushScheduledUpdates()
    document.body.classList.remove('sidebar-resizing')
    document.removeEventListener('pointermove', resizeSidebar)
    document.removeEventListener('pointerup', stopResizing)
}

function startResizing(event: PointerEvent) {
    event.preventDefault()
    document.body.classList.add('sidebar-resizing')
    document.addEventListener('pointermove', resizeSidebar)
    document.addEventListener('pointerup', stopResizing, { once: true })
}

onBeforeUnmount(() => {
    stopResizing()
    flushScheduledUpdates()
})
</script>

<template>
    <aside
        v-if="appUI.sidebarOpen"
        class="sidebar"
        aria-label="Graph settings"
        :style="{ width: `${appUI.sidebarWidth}px` }"
    >
        <div class="sidebar-resize-handle" @pointerdown="startResizing" />
        <button class="icon-button sidebar-close" title="Close sidebar" @click="appUI.closeSidebar">
            <IconX :size="20" />
        </button>

        <nav class="sidebar-tabs" aria-label="Settings sections">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                :class="{ active: appUI.activeTab === tab.id }"
                :title="tab.label"
                @click="appUI.activeTab = tab.id"
            >
                <component :is="tab.icon" :size="19" />
            </button>
        </nav>

        <div v-if="appUI.activeTab === 'styles'" class="sidebar-content style-settings">
            <div class="option-container">
                <fieldset
                    v-for="kind in connectionKinds"
                    :key="kind"
                    class="settings-card connection-settings-card"
                    :style="{
                        borderColor: appUI.connectionStyles[kind].color,
                        boxShadow: `inset 3px 0 ${appUI.connectionStyles[kind].color}`,
                    }"
                >
                    <legend>{{ connectionLabels[kind] }}</legend>
                    <label class="icon-field" title="Color">
                        <IconColorPicker :size="17" />
                        <input
                            :value="appUI.connectionStyles[kind].color"
                            type="color"
                            @input="updateConnectionColor(kind, $event)"
                        />
                    </label>
                    <div class="option-group" role="group" aria-label="Line style">
                        <button
                            class="option-button"
                            :class="{ selected: appUI.connectionStyles[kind].line === 'solid' }"
                            title="Solid"
                            @click="appUI.connectionStyles[kind].line = 'solid'"
                        >
                            <IconLine :size="20" />
                        </button>
                        <button
                            class="option-button"
                            :class="{ selected: appUI.connectionStyles[kind].line === 'dashed' }"
                            title="Dashed"
                            @click="appUI.connectionStyles[kind].line = 'dashed'"
                        >
                            <IconLineDashed :size="20" />
                        </button>
                        <button
                            class="option-button"
                            :class="{ selected: appUI.connectionStyles[kind].line === 'dotted' }"
                            title="Dotted"
                            @click="appUI.connectionStyles[kind].line = 'dotted'"
                        >
                            <IconLineDotted :size="20" />
                        </button>
                    </div>
                    <div class="option-group" role="group" aria-label="Curve style">
                        <button
                            class="option-button"
                            :class="{ selected: appUI.connectionStyles[kind].curve === 'straight' }"
                            title="Straight"
                            @click="appUI.connectionStyles[kind].curve = 'straight'"
                        >
                            <IconSlash :size="19" />
                        </button>
                        <button
                            class="option-button"
                            :class="{ selected: appUI.connectionStyles[kind].curve === 'step' }"
                            title="Step"
                            @click="appUI.connectionStyles[kind].curve = 'step'"
                        >
                            <IconRouteSquare :size="19" />
                        </button>
                        <button
                            class="option-button"
                            :class="{
                                selected: appUI.connectionStyles[kind].curve === 'smoothstep',
                            }"
                            title="Smooth step"
                            @click="appUI.connectionStyles[kind].curve = 'smoothstep'"
                        >
                            <IconActivity :size="19" />
                        </button>
                        <button
                            class="option-button"
                            :class="{ selected: appUI.connectionStyles[kind].curve === 'bezier' }"
                            title="Bezier"
                            @click="appUI.connectionStyles[kind].curve = 'bezier'"
                        >
                            <IconVectorSpline :size="19" />
                        </button>
                    </div>
                    <div class="option-group animation-options" role="group" aria-label="Animation">
                        <button
                            class="option-button animation-control"
                            :class="{ selected: !appUI.connectionStyles[kind].animated }"
                            title="Static"
                            :aria-pressed="!appUI.connectionStyles[kind].animated"
                            @click="appUI.connectionStyles[kind].animated = false"
                        >
                            <IconPlayerPause :size="19" />
                        </button>
                        <button
                            class="option-button animation-control moving"
                            :class="{ selected: appUI.connectionStyles[kind].animated }"
                            title="Moving"
                            :aria-pressed="appUI.connectionStyles[kind].animated"
                            @click="appUI.connectionStyles[kind].animated = true"
                        >
                            <IconPlayerPlay :size="19" />
                        </button>
                    </div>
                </fieldset>
                <fieldset
                    v-for="kind in nodeKinds"
                    :key="kind"
                    class="settings-card node-settings-card"
                    :style="{
                        borderColor: appUI.nodeStyles[kind].color,
                        backgroundColor: appUI.nodeStyles[kind].backgroundColor,
                    }"
                >
                    <legend>{{ nodeLabels[kind] }}</legend>
                    <div class="color-controls">
                        <label class="icon-field" title="Color">
                            <IconColorPicker :size="17" />
                            <input
                                :value="appUI.nodeStyles[kind].color"
                                type="color"
                                @input="updateNodeColor(kind, 'color', $event)"
                            />
                        </label>
                        <label class="icon-field" title="Background">
                            <IconBackground :size="17" />
                            <input
                                :value="appUI.nodeStyles[kind].backgroundColor"
                                type="color"
                                @input="updateNodeColor(kind, 'backgroundColor', $event)"
                            />
                        </label>
                    </div>
                    <label class="icon-field range-field" title="Font size">
                        <IconTypography :size="17" />
                        <input
                            :value="appUI.nodeStyles[kind].fontSize"
                            type="range"
                            min="10"
                            max="24"
                            @input="updateNodeFontSize(kind, $event)"
                        />
                        <output>{{ appUI.nodeStyles[kind].fontSize }}</output>
                    </label>
                </fieldset>
            </div>

            <div class="style-toolbar">
                <button class="icon-button" title="Reset all styles" @click="appUI.resetStyles">
                    <IconRestore :size="18" />
                </button>
            </div>
        </div>

        <div v-else-if="appUI.activeTab === 'raw'" class="sidebar-content raw-content">
            <RawJsonEditor
                v-model:font-size="appUI.jsonFontSize"
                :model-value="rawJson"
                @save="saveRawData"
            />
        </div>
    </aside>
</template>
