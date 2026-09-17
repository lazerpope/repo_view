import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import './style.css'
import App from './App.vue'
import { createLocalStorageProvider, preferencesProviderKey } from './providers/preferences.ts'

const app = createApp(App)
app.use(createPinia())
app.provide(preferencesProviderKey, createLocalStorageProvider(window.localStorage))
app.mount('#app')
