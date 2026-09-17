<script setup lang="ts">
import { IconArrowBackUp, IconDeviceFloppy, IconTypography } from '@tabler/icons-vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { monaco } from '../monaco/setupMonaco.ts'

const props = defineProps<{ modelValue: string }>()
const fontSize = defineModel<number>('fontSize', { default: 12 })
const emit = defineEmits<{
    save: [value: unknown]
}>()

const host = ref<HTMLElement | null>(null)
const parseError = ref('')
let editor: monaco.editor.IStandaloneCodeEditor | undefined

function reset() {
    parseError.value = ''
    editor?.setValue(props.modelValue)
}

function save() {
    try {
        const value: unknown = JSON.parse(editor?.getValue() ?? props.modelValue)
        parseError.value = ''
        emit('save', value)
    } catch (cause) {
        parseError.value = cause instanceof Error ? cause.message : 'Invalid JSON.'
    }
}

onMounted(() => {
    if (!host.value) return
    editor = monaco.editor.create(host.value, {
        value: props.modelValue,
        language: 'json',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: fontSize.value,
        minimap: { enabled: false },
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
    })
})

watch(
    () => props.modelValue,
    (value) => {
        if (editor && editor.getValue() !== value) editor.setValue(value)
    },
)
watch(fontSize, (value) => editor?.updateOptions({ fontSize: value }))

onBeforeUnmount(() => editor?.dispose())
</script>

<template>
    <div class="raw-editor">
        <div ref="host" class="raw-editor__host" />
        <p v-if="parseError" class="form-error" role="alert">{{ parseError }}</p>
        <div class="sidebar-actions">
            <label class="raw-font-size" title="Editor font size">
                <IconTypography :size="18" />
                <input v-model.number="fontSize" type="range" min="8" max="24" step="1" />
                <output>{{ fontSize }}</output>
            </label>
            <button type="button" class="raw-action" title="Discard JSON changes" @click="reset">
                <IconArrowBackUp :size="19" />
            </button>
            <button
                type="button"
                class="raw-action raw-action--primary"
                title="Apply JSON"
                @click="save"
            >
                <IconDeviceFloppy :size="19" />
            </button>
        </div>
    </div>
</template>
