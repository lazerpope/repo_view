import { createServer } from 'node:http'
import type { Structure } from '../shared/types.ts'

const port = Number(process.env.PORT || 3000)
const data: Structure = [
    {
        type: 'folder',
        label: 'folder1',
        contains: [
            {
                type: 'folder',
                label: 'folder2',
                contains: [
                    {
                        type: 'file',
                        label: 'file2',
                        imports: [
                            { label: 'import3', type: 'lib-builtin' },
                            { label: 'import2', type: 'lib' },
                            { label: 'file1', type: 'file' },
                        ],
                    },
                ],
            },
            {
                type: 'file',
                label: 'file1',
                imports: [
                    { label: 'import1', type: 'lib-external' },
                    { label: 'import1', type: 'lib' },
                    { label: 'import2', type: 'lib' },
                ],
            },
        ],
    },
]

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
