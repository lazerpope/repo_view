

const PORT = Number(process.env.PORT || 3000)

import express from "express";

import route_graph from "./routes/graph/serve.ts";
import route_user from "./routes/user/serve.ts";

const app = express();

app.use(express.json());

app.use("/data", route_graph);
app.use("/user", route_user);

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});

