import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function jiraProxyPlugin() {
  async function readJsonBody(req: any) {
    const chunks: Uint8Array[] = []
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
    }

    const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
    const bytes = new Uint8Array(byteLength)
    let offset = 0
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    })

    return JSON.parse(new TextDecoder().decode(bytes))
  }

  function writeJson(res: any, statusCode: number, body: unknown) {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }

  return {
    name: 'jira-api-proxy',
    configureServer(server: any) {
      const methodGuard = (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return false
        }

        if (req.method !== 'POST') {
          writeJson(res, 405, { errorMessages: ['Method not allowed'] })
          return false
        }

        return true
      }

      server.middlewares.use('/api/jira/search', async (req: any, res: any) => {
        if (!methodGuard(req, res)) return

        try {
          const body = await readJsonBody(req)

          if (!body.jiraHost || !body.authorization || !body.jql) {
            writeJson(res, 400, { errorMessages: ['jiraHost, authorization, and jql are required'] })
            return
          }

          const jiraUrl = new URL('/rest/api/3/search/jql', body.jiraHost)
          const response = await fetch(jiraUrl.toString(), {
            method: 'POST',
            headers: {
              Authorization: body.authorization,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jql: body.jql,
              fields: body.fields || ['summary', 'status', 'components', 'fixVersions', 'issuetype'],
              maxResults: body.maxResults || 100,
              nextPageToken: body.nextPageToken,
            }),
          })

          res.statusCode = response.status
          res.statusMessage = response.statusText
          res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json')
          res.end(await response.text())
        } catch (error) {
          writeJson(res, 500, {
            errorMessages: [error instanceof Error ? error.message : 'Jira proxy failed'],
          })
        }
      })

      server.middlewares.use('/api/jira/project-versions', async (req: any, res: any) => {
        if (!methodGuard(req, res)) return

        try {
          const body = await readJsonBody(req)

          if (!body.jiraHost || !body.authorization || !body.projectKey) {
            writeJson(res, 400, { errorMessages: ['jiraHost, authorization, and projectKey are required'] })
            return
          }

          const jiraUrl = new URL(`/rest/api/3/project/${encodeURIComponent(body.projectKey)}/versions`, body.jiraHost)
          const response = await fetch(jiraUrl.toString(), {
            headers: {
              Authorization: body.authorization,
              Accept: 'application/json',
            },
          })

          res.statusCode = response.status
          res.statusMessage = response.statusText
          res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json')
          res.end(await response.text())
        } catch (error) {
          writeJson(res, 500, {
            errorMessages: [error instanceof Error ? error.message : 'Jira proxy failed'],
          })
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), jiraProxyPlugin()],
})
