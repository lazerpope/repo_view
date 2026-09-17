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
import { connectionKinds, nodeKinds, useAppUI, type SidebarTab } from '../stores/appUI.ts'

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

function saveRawData(value: unknown) {
    try {
        appData.setData(value)
    } catch (cause) {
        window.alert(cause instanceof Error ? cause.message : 'Invalid project data.')
    }
}

function resizeSidebar(event: PointerEvent) {
    const maximum = Math.max(500, window.innerWidth * 0.8)
    appUI.sidebarWidth = Math.max(500, Math.min(maximum, window.innerWidth - event.clientX))
}

function stopResizing() {
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

onBeforeUnmount(stopResizing)
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
                        <input v-model="appUI.connectionStyles[kind].color" type="color" />
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
                            <input v-model="appUI.nodeStyles[kind].color" type="color" />
                        </label>
                        <label class="icon-field" title="Background">
                            <IconBackground :size="17" />
                            <input v-model="appUI.nodeStyles[kind].backgroundColor" type="color" />
                        </label>
                    </div>
                    <label class="icon-field range-field" title="Font size">
                        <IconTypography :size="17" />
                        <input
                            v-model.number="appUI.nodeStyles[kind].fontSize"
                            type="range"
                            min="10"
                            max="24"
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
