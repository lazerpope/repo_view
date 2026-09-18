# Project graph viewer

A small Vue app that fetches a nested project structure from `GET /data/graph` and renders folders, files, containment, and import relationships with Vue Flow.

## Run locally

```sh
pnpm install
pnpm dev
```

Open <http://127.0.0.1:5173>. The command starts both the mock backend on port 3000 and the Vite frontend on port 5173.

Use `pnpm build` to type-check the project and create a production build.
