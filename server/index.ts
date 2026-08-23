import express from 'express'
import cors from 'cors'

export const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server]', err)
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' })
})

// Dev: run as a normal long-lived server. On Vercel this same file is imported
// as a serverless function (Vercel sets process.env.VERCEL), so we must NOT
// listen there — just export the app as the request handler.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Backend running on :${PORT}`))
}

export default app
