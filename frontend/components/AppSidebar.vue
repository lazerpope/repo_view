<script setup lang="ts">
import { IconBraces, IconFolders, IconPalette, IconRestore, IconX } from '@tabler/icons-vue'
import { computed, defineAsyncComponent } from 'vue'
import { useAppData } from '../stores/appData.ts'
import { connectionKinds, nodeKinds, useAppUI, type SidebarTab } from '../stores/appUI.ts'

const appData = useAppData()
const appUI = useAppUI()
const RawJsonEditor = defineAsyncComponent(() => import('./RawJsonEditor.vue'))
const rawJson = computed(() => JSON.stringify(appData.rawData, null, 4))

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
    { id: 'raw', label: 'Raw JSON', icon: IconBraces },
   
]

function saveRawData(value: unknown) {
    try {
        appData.setData(value)
    } catch (cause) {
        window.alert(cause instanceof Error ? cause.message : 'Invalid project data.')
    }
}
</script>

<template>
    <aside v-if="appUI.sidebarOpen" class="sidebar" aria-label="Graph settings">
        <header class="sidebar-header">
            <strong>Graph settings</strong>
            <button class="icon-button" title="Close sidebar" @click="appUI.closeSidebar">
                <IconX :size="20" />
            </button>
        </header>

        <nav class="sidebar-tabs" aria-label="Settings sections">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                :class="{ active: appUI.activeTab === tab.id }"
                :title="tab.label"
                @click="appUI.activeTab = tab.id"
            >
                <component :is="tab.icon" :size="18" />
                <span>{{ tab.label }}</span>
            </button>
        </nav>

        <div v-if="appUI.activeTab === 'styles'" class="sidebar-content style-settings">
            <div class="section-heading">
                <h2>Node styles</h2>
                <button class="icon-button" title="Reset all styles" @click="appUI.resetStyles">
                    <IconRestore :size="18" />
                </button>
            </div>

            <fieldset v-for="kind in nodeKinds" :key="kind" class="settings-card">
                <legend>{{ nodeLabels[kind] }}</legend>
                <label>
                    <span>Color</span>
                    <input v-model="appUI.nodeStyles[kind].color" type="color" />
                </label>
                <label>
                    <span>Background</span>
                    <input v-model="appUI.nodeStyles[kind].backgroundColor" type="color" />
                </label>
                <label class="range-field">
                    <span>Font</span>
                    <input
                        v-model.number="appUI.nodeStyles[kind].fontSize"
                        type="range"
                        min="10"
                        max="24"
                    />
                    <output>{{ appUI.nodeStyles[kind].fontSize }}px</output>
                </label>
            </fieldset>

            <h2>Connection styles</h2>
            <fieldset v-for="kind in connectionKinds" :key="kind" class="settings-card">
                <legend>{{ connectionLabels[kind] }}</legend>
                <label>
                    <span>Color</span>
                    <input v-model="appUI.connectionStyles[kind].color" type="color" />
                </label>
                <label>
                    <span>Line</span>
                    <select v-model="appUI.connectionStyles[kind].line">
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                    </select>
                </label>
                <label>
                    <span>Curve</span>
                    <select v-model="appUI.connectionStyles[kind].curve">
                        <option value="smoothstep">Smooth step</option>
                        <option value="step">Step</option>
                        <option value="straight">Straight</option>
                        <option value="bezier">Bezier</option>
                    </select>
                </label>
                <label class="checkbox-field">
                    <input v-model="appUI.connectionStyles[kind].animated" type="checkbox" />
                    <span>Animated</span>
                </label>
            </fieldset>
        </div>

        <div v-else-if="appUI.activeTab === 'raw'" class="sidebar-content raw-content">
          
            <RawJsonEditor :model-value="rawJson" @save="saveRawData" />
        </div>

    </aside>
</template>
