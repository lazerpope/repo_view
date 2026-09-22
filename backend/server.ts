import express from 'express'
import { port } from './config.ts'
import routeGraph from './routes/graph/serve.ts'
import routeUser from './routes/user/serve.ts'

const DEBUG = true

const app = express()

app.use(express.json())
app.use('/', (req, res, next) => {
    if (!DEBUG) next()


    console.log(
        `[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}] ${req.method} at ${req.path} ${JSON.stringify(req.query) || 'no_query'} ${req.body || 'no_body'} `,
    )
    // console.log(req);
    next()
})

app.use('/data', routeGraph)
app.use('/user', routeUser)

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`)
})
