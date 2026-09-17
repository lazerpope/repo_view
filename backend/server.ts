import { createServer } from 'node:http'
import type { Structure } from '../shared/types.ts'

const port = Number(process.env.PORT || 3000)

createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/data') {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify(data))
        return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Not found' }))
}).listen(port, '127.0.0.1', () => {
    console.log(`Backend running on http://127.0.0.1:${port}`)
})

const data: Structure = [
    {
        type: 'folder',
        label: 'src',
        contains: [
            {
                type: 'folder',
                label: 'components',
                contains: [
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'Button',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'clsx', type: 'lib-external' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'Modal',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'react-dom', type: 'lib-external' },
                            { label: 'src/components/Button', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'SearchInput',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'src/hooks/useDebounce', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'UserAvatar',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'src/types/user', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'ProjectCard',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'src/types/project', type: 'file' },
                            { label: 'src/utils/formatDate', type: 'file' },
                            { label: 'src/components/UserAvatar', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'pages',
                contains: [
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'Dashboard',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'src/components/ProjectCard', type: 'file' },
                            { label: 'src/services/projectService', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'tsx',
                        label: 'Login',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                            { label: 'react-hook-form', type: 'lib' },
                            { label: 'src/components/Button', type: 'file' },
                            { label: 'src/services/authService', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'hooks',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'useDebounce',
                        imports: [
                            { label: 'react', type: 'lib-external' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'services',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'apiClient',
                        imports: [
                            { label: 'axios', type: 'lib-external' },
                            { label: 'src/config/environment', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'authService',
                        imports: [
                            { label: 'src/services/apiClient', type: 'file' },
                            { label: 'src/types/user', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'projectService',
                        imports: [
                            { label: 'src/services/apiClient', type: 'file' },
                            { label: 'src/types/project', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'analyticsService',
                        imports: [
                            { label: 'src/services/apiClient', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'types',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'user',
                        imports: [],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'project',
                        imports: [
                            { label: 'src/types/user', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'utils',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'formatDate',
                        imports: [
                            { label: 'date-fns', type: 'lib' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'generateId',
                        imports: [
                            { label: 'node:crypto', type: 'lib-builtin' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'sortProjects',
                        imports: [
                            { label: 'src/types/project', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'config',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'environment',
                        imports: [
                            { label: 'node:process', type: 'lib-builtin' },
                        ],
                    },
                ],
            },

            {
                type: 'file',
                extension: 'tsx',
                label: 'App',
                imports: [
                    { label: 'react', type: 'lib-external' },
                    { label: 'react-router-dom', type: 'lib-external' },
                    { label: 'src/pages/Dashboard', type: 'file' },
                    { label: 'src/pages/Login', type: 'file' },
                ],
            },

            {
                type: 'file',
                extension: 'tsx',
                label: 'main',
                imports: [
                    { label: 'react', type: 'lib-external' },
                    { label: 'react-dom/client', type: 'lib-external' },
                    { label: 'src/App', type: 'file' },
                ],
            },
        ],
    },

    {
        type: 'folder',
        label: 'server',
        contains: [
            {
                type: 'folder',
                label: 'routes',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'authRoutes',
                        imports: [
                            { label: 'express', type: 'lib-external' },
                            { label: 'server/middleware/authenticate', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'projectRoutes',
                        imports: [
                            { label: 'express', type: 'lib-external' },
                            { label: 'server/database/projectRepository', type: 'file' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'healthRoutes',
                        imports: [
                            { label: 'express', type: 'lib-external' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'middleware',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'authenticate',
                        imports: [
                            { label: 'jsonwebtoken', type: 'lib-external' },
                            { label: 'server/config', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'folder',
                label: 'database',
                contains: [
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'client',
                        imports: [
                            { label: '@prisma/client', type: 'lib-external' },
                        ],
                    },
                    {
                        type: 'file',
                        extension: 'ts',
                        label: 'projectRepository',
                        imports: [
                            { label: 'server/database/client', type: 'file' },
                        ],
                    },
                ],
            },

            {
                type: 'file',
                extension: 'ts',
                label: 'config',
                imports: [
                    { label: 'dotenv', type: 'lib' },
                    { label: 'node:process', type: 'lib-builtin' },
                ],
            },

            {
                type: 'file',
                extension: 'ts',
                label: 'index',
                imports: [
                    { label: 'express', type: 'lib-external' },
                    { label: 'node:http', type: 'lib-builtin' },
                    { label: 'server/routes/authRoutes', type: 'file' },
                    { label: 'server/routes/projectRoutes', type: 'file' },
                    { label: 'server/routes/healthRoutes', type: 'file' },
                ],
            },
        ],
    },

    {
        type: 'folder',
        label: 'scripts',
        contains: [
            {
                type: 'file',
                extension: 'mjs',
                label: 'build',
                imports: [
                    { label: 'esbuild', type: 'lib' },
                    { label: 'node:path', type: 'lib-builtin' },
                    { label: 'node:fs/promises', type: 'lib-builtin' },
                ],
            },
        ],
    },

    {
        type: 'file',
        extension: 'ts',
        label: 'vite.config',
        imports: [
            { label: 'vite', type: 'lib' },
            { label: '@vitejs/plugin-react', type: 'lib-external' },
            { label: 'node:path', type: 'lib-builtin' },
        ],
    },

    {
        type: 'file',
        extension: 'json',
        label: 'tsconfig',
        imports: [],
    },

    {
        type: 'file',
        extension: 'json',
        label: 'package',
        imports: [],
    },
]