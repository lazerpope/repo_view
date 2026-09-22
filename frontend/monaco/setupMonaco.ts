import * as monaco from 'monaco-editor/editor'
import 'monaco-editor/features/register.all'
import 'monaco-editor/languages/features/json/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/languages/features/json/json.worker?worker'

interface MonacoWorkerHost {
    MonacoEnvironment: {
        getWorker(moduleId: string, label: string): Worker
    }
}

;(self as unknown as MonacoWorkerHost).MonacoEnvironment = {
    getWorker(_moduleId, label) {
        return label === 'json' ? new JsonWorker() : new EditorWorker()
    },
}

export { monaco }
