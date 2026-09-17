import * as monaco from '../../node_modules/monaco-editor/esm/vs/editor/editor.api.js'
import '../../node_modules/monaco-editor/esm/vs/language/json/monaco.contribution.js'
import EditorWorker from '../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'
import JsonWorker from '../../node_modules/monaco-editor/esm/vs/language/json/json.worker.js?worker'

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
