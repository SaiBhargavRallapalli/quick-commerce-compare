import { NextRequest } from 'next/server'
import { searchAllPlatforms } from '@/scrapers/index'
import { resolveLocation } from '@/lib/pincode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()
  const pincode = searchParams.get('pincode')?.trim() || '560001'

  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ error: 'Query too short' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const location = await resolveLocation(pincode)

  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    async start(c) {
      controller = c

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // stream closed
        }
      }

      // Send location info first
      send({ type: 'location', location })

      try {
        for await (const result of searchAllPlatforms(query, location)) {
          send({ type: 'platform_result', data: result })
        }
      } catch (err) {
        send({ type: 'error', message: String(err) })
      } finally {
        send({ type: 'done' })
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {
      // Client disconnected — let the generator finish naturally
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  })
}
