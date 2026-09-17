<script setup lang="ts">
import { IconArrowBackUp, IconDeviceFloppy } from '@tabler/icons-vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { monaco } from '../monaco/setupMonaco.ts'

const props = defineProps<{ modelValue: string }>()
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
        fontSize: 13,
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

onBeforeUnmount(() => editor?.dispose())
</script>

<template>
    <div class="raw-editor">
        <div ref="host" class="raw-editor__host" />
        <p v-if="parseError" class="form-error" role="alert">{{ parseError }}</p>
        <div class="sidebar-actions">
            <button type="button" title="Discard JSON changes" @click="reset">
                <IconArrowBackUp :size="17" />
                Cancel
            </button>
            <button type="button" class="primary-button" title="Apply JSON" @click="save">
                <IconDeviceFloppy :size="17" />
                Save
            </button>
        </div>
    </div>
</template>
