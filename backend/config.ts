import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)))

export const port = Number(process.env.PORT || 3000)

function expandHome(value: string): string {
    if (value === '~') return homedir()
    if (!value.startsWith('~')) return resolve(value)

    return resolve(homedir(), value.slice(1).replace(/^[/\\]+/, ''))
}

export const workDirectory = expandHome(process.env.WORK_DIR || '~/.repograph')
