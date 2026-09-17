import { createServer } from 'node:http'

const port = Number(process.env.PORT || 3000)
const data = [
  {
    type: 'folder', label: 'folder1', contains: [
      {
        type: 'folder', label: 'folder2', contains: [
          { type: 'file', label: 'file2', imports: ['import3', 'import2', 'file1'] },
        ],
      },
      { type: 'file', label: 'file1', imports: ['import1', 'import2'] },
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
