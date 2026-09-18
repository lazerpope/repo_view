import type { InjectionKey } from 'vue'

export interface PreferencesProvider {
    store<T>(key: string, value: T): void
    load<T>(key: string): T | null
}

export const preferencesProviderKey: InjectionKey<PreferencesProvider> = Symbol('preferences')

// export function createLocalStorageProvider(storage: Storage): PreferencesProvider {
//     return {
//         store<T>(key: string, value: T) {
//             storage.setItem(key, JSON.stringify(value))
//         },
//         load<T>(key: string) {
//             const value = storage.getItem(key)
//             if (value === null) return null

//             try {
//                 return JSON.parse(value) as T
//             } catch {
//                 return null
//             }
//         },
//     }
// }

export async function createApiPreferencesProvider(
    endpoint = '/user',
): Promise<PreferencesProvider> {
    let preferences: Record<string, unknown> = {}
    let pendingSnapshot: string | null = null
    let storing = false

    try {
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`)

        const value: unknown = await response.json()
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            preferences = value as Record<string, unknown>
        }
    } catch (error) {
        preferences = {} as Record<string, unknown>
        // console.error('Failed to load user preferences:', error)
    }

    async function storePendingPreferences() {
        if (storing) return
        storing = true

        try {
            while (pendingSnapshot !== null) {
                const snapshot = pendingSnapshot
                pendingSnapshot = null

                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: snapshot,
                        signal: AbortSignal.timeout(10_000),
                    })
                    if (!response.ok) {
                        throw new Error(`Server returned HTTP ${response.status}.`)
                    }
                } catch (error) {
                    console.error('Failed to save user preferences:', error)
                }
            }
        } finally {
            storing = false
            if (pendingSnapshot !== null) void storePendingPreferences()
        }
    }

    return {
        store<T>(key: string, value: T) {
            const snapshot = JSON.stringify({ ...preferences, [key]: value })
            preferences = JSON.parse(snapshot) as Record<string, unknown>
            pendingSnapshot = snapshot
            void storePendingPreferences()
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
