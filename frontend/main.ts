import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import './style.css'
import App from './App.vue'
import { createApiPreferencesProvider, preferencesProviderKey } from './providers/preferences.ts'

const app = createApp(App)
app.use(createPinia())
app.provide(preferencesProviderKey, await createApiPreferencesProvider())
app.mount('#app')
