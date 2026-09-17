import type { InjectionKey } from 'vue'

export interface PreferencesProvider {
    store<T>(key: string, value: T): void
    load<T>(key: string): T | null
}

export const preferencesProviderKey: InjectionKey<PreferencesProvider> = Symbol('preferences')

export function createLocalStorageProvider(storage: Storage): PreferencesProvider {
    return {
        store<T>(key: string, value: T) {
            storage.setItem(key, JSON.stringify(value))
        },
        load<T>(key: string) {
            const value = storage.getItem(key)
            if (value === null) return null

            try {
                return JSON.parse(value) as T
            } catch {
                return null
            }
        },
    }
}

export const memoryPreferencesProvider: PreferencesProvider = {
    store() {},
    load() {
        return null
    },
}
