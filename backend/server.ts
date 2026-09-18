import express from 'express'
import { port } from './config.ts'
import routeGraph from './routes/graph/serve.ts'
import routeUser from './routes/user/serve.ts'

const app = express()

app.use(express.json())

app.use('/data', routeGraph)
app.use('/user', routeUser)

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`)
})
