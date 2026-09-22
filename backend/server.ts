import express from 'express'
import { port } from './config.ts'
import routeGraph from './routes/graph/serve.ts'
import routeUser from './routes/user/serve.ts'

const DEBUG = true

const app = express()

app.use(express.json())

if (DEBUG) {
    app.use('/', (req, res, next) => {

        let msg = `[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}] `
        msg += `${req.method} at ${req.path} `
        msg += `${JSON.stringify(req.query) || 'no_query'} `
        msg += `${JSON.stringify(req.body) || 'no_body'} `
        console.log(msg)
        
        next()
    })

}
app.use('/data', routeGraph)
app.use('/user', routeUser)

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`)
})
