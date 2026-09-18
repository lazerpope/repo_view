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

export async function createApiPreferencesProvider(
    endpoint = '/user',
): Promise<PreferencesProvider> {
    let preferences: Record<string, unknown> = {}
    let pendingStore = Promise.resolve()

    try {
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`)

        const value: unknown = await response.json()
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            preferences = value as Record<string, unknown>
        }
    } catch (error) {
        console.error('Failed to load user preferences:', error)
    }

    return {
        store<T>(key: string, value: T) {
            const snapshot = JSON.stringify({ ...preferences, [key]: value })
            preferences = JSON.parse(snapshot) as Record<string, unknown>

            pendingStore = pendingStore
                .then(async () => {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: snapshot,
                        signal: AbortSignal.timeout(10_000),
                    })
                    if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`)
                })
                .catch((error: unknown) => {
                    console.error('Failed to save user preferences:', error)
                })
        },
        load<T>(key: string) {
            return (preferences[key] as T | undefined) ?? null
        },
    }
}

export const memoryPreferencesProvider: PreferencesProvider = {
    store() {},
    load() {
        return null
    },
}
