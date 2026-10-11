import { createRemoteJWKSet, jwtVerify } from 'jose'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
])
const EXTENSIONS = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
}
const jwksCache = new Map()

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, 'cache-control': 'no-store', ...extraHeaders },
  })
}
function error(message, status = 400) {
  return json({ error: message }, status)
}
function slugify(value) {
  return String(value || '').normalize('NFKD').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
}
function cleanFilename(value) {
  const leaf = String(value || 'audio').split(/[\\/]/).pop()
  return leaf.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'audio'
}
function maxUploadBytes(env) {
  const parsed = Number(env.MAX_UPLOAD_BYTES || 104857600)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 524288000) : 104857600
}
async function requireAdmin(request, env) {
  const domain = String(env.AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const audience = String(env.AUTH0_AUDIENCE || '')
  if (!domain || !audience || domain.includes('REPLACE_') || audience.includes('REPLACE_')) {
    throw new Response(JSON.stringify({ error: 'Auth0 API verification is not configured.' }), {
      status: 503, headers: JSON_HEADERS,
    })
  }
  const match = String(request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  if (!match) throw new Response(JSON.stringify({ error: 'Auth0 bearer token required.' }), {
    status: 401, headers: JSON_HEADERS,
  })
  const issuer = `https://${domain}/`
  let jwks = jwksCache.get(issuer)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`))
    jwksCache.set(issuer, jwks)
  }
  let payload
  try {
    ({ payload } = await jwtVerify(match[1], jwks, { issuer, audience }))
  } catch {
    throw new Response(JSON.stringify({ error: 'Invalid Auth0 access token.' }), {
      status: 403, headers: JSON_HEADERS,
    })
  }
  const permissions = Array.isArray(payload.permissions) ? payload.permissions : []
  if (!permissions.includes('manage:podcasts')) {
    throw new Response(JSON.stringify({ error: 'This account does not have the required podcast admin permission.' }), {
      status: 403, headers: JSON_HEADERS,
    })
  }
  const email = String(payload.email || payload['https://sorasukt.com/email'] || 'auth0-admin').toLowerCase()
  return { email }
}
async function audit(env, actor, action, entityType, entityId = null) {
  await env.DB.prepare(
    'INSERT INTO audit_log (id, actor_email, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), actor, action, entityType, entityId).run()
}
function episodeSelect(where = '') {
  return `SELECT e.id, e.show_id, s.title AS show_title, s.slug AS show_slug,
    e.title, e.slug, e.description, e.audio_key, e.artwork_key, e.duration_seconds,
    e.published_at, e.status, e.explicit, e.episode_number, e.season_number,
    e.created_at, e.updated_at
    FROM episodes e JOIN shows s ON s.id = e.show_id ${where}`
}
async function handle(request, env) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-file-name',
    'access-control-max-age': '86400',
  } })

  if (path === '/api/health' && request.method === 'GET') {
    return json({ ok: true, service: 'stnet-podcast-api', phase: 4 })
  }

  if (path === '/api/episodes' && request.method === 'GET') {
    const result = await env.DB.prepare(
      `${episodeSelect("WHERE e.status = 'published' AND e.published_at IS NOT NULL AND datetime(e.published_at) <= datetime('now')")} ORDER BY e.published_at DESC LIMIT 100`,
    ).all()
    return json({ episodes: result.results || [] }, 200, { 'cache-control': 'public, max-age=60, s-maxage=300' })
  }

  if (path === '/api/media' && request.method === 'GET') {
    const key = url.searchParams.get('key') || ''
    if (!key.startsWith('audio/') && !key.startsWith('artwork/')) return error('Invalid media key.', 400)
    const object = await env.AUDIO.get(key)
    if (!object) return error('Media not found.', 404)
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('cache-control', 'public, max-age=31536000, immutable')
    headers.set('x-content-type-options', 'nosniff')
    return new Response(object.body, { headers })
  }

  const feedMatch = path.match(/^\/api\/feeds\/([a-z0-9-]+)\.xml$/i)
  if (feedMatch && request.method === 'GET') {
    const slug = feedMatch[1]
    const show = await env.DB.prepare('SELECT * FROM shows WHERE slug = ?').bind(slug).first()
    if (!show) return error('Podcast feed not found.', 404)
    const result = await env.DB.prepare(`
      SELECT e.id, e.title, e.slug, e.description, e.audio_key, e.artwork_key,
        e.duration_seconds, e.published_at, e.explicit, e.episode_number, e.season_number,
        m.size_bytes, m.content_type, s.title AS show_title
      FROM episodes e JOIN shows s ON s.id = e.show_id
      LEFT JOIN media_assets m ON m.object_key = e.audio_key
      WHERE e.show_id = ? AND e.status = 'published'
        AND e.published_at IS NOT NULL AND datetime(e.published_at) <= datetime('now')
        AND e.audio_key IS NOT NULL AND e.audio_key != ''
      ORDER BY e.published_at DESC LIMIT 200
    `).bind(show.id).all()
    const xmlEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    })[char])
    const origin = (env.PUBLIC_MEDIA_BASE_URL || url.origin).replace(/\/$/, '')
    const items = (result.results || []).map(episode => {
      const audioUrl = `${origin}/api/media?key=${encodeURIComponent(episode.audio_key)}`
      const published = new Date(episode.published_at).toUTCString()
      const duration = Number.isInteger(episode.duration_seconds) && episode.duration_seconds >= 0
        ? episode.duration_seconds : 0
      return `<item>
        <title>${xmlEscape(episode.title)}</title>
        <description>${xmlEscape(episode.description)}</description>
        <guid isPermaLink="false">${xmlEscape(episode.id)}</guid>
        <pubDate>${published}</pubDate>
        <enclosure url="${xmlEscape(audioUrl)}" length="${Number.isInteger(episode.size_bytes) ? episode.size_bytes : 0}" type="${xmlEscape(episode.content_type || "audio/mpeg")}" />
        <itunes:duration>${duration}</itunes:duration>
        <itunes:explicit>${episode.explicit ? 'true' : 'false'}</itunes:explicit>
        ${episode.episode_number == null ? '' : `<itunes:episode>${episode.episode_number}</itunes:episode>`}
        ${episode.season_number == null ? '' : `<itunes:season>${episode.season_number}</itunes:season>`}
      </item>`
    }).join('')
    const feedUrl = `${origin}/api/feeds/${encodeURIComponent(show.slug)}.xml`
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>${xmlEscape(show.title)}</title>
          <link>${xmlEscape(origin)}</link>
          <description>${xmlEscape(show.description || show.title)}</description>
          <language>en</language>
          <itunes:author>STNET Radio</itunes:author>
          <itunes:owner><itunes:name>STNET Radio</itunes:name><itunes:email>hello@sorasukt.com</itunes:email></itunes:owner>
          <itunes:category text="Society &amp; Culture" />
          <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
          ${items}
        </channel>
      </rss>`
    return new Response(xml, { headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300',
      'x-content-type-options': 'nosniff',
    } })
  }

  if (path.startsWith('/api/admin/')) {
    const identity = await requireAdmin(request, env)

    if (path === '/api/admin/shows' && request.method === 'GET') {
      const result = await env.DB.prepare('SELECT * FROM shows ORDER BY title').all()
      return json({ shows: result.results || [] })
    }

    if (path === '/api/admin/shows' && request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body.title !== 'string' || !body.title.trim()) return error('A show title is required.')
      const id = crypto.randomUUID()
      const title = body.title.trim().slice(0, 200)
      const slug = slugify(body.slug || title) || id
      try {
        await env.DB.prepare('INSERT INTO shows (id, title, slug, description) VALUES (?, ?, ?, ?)')
          .bind(id, title, slug, String(body.description || '').slice(0, 5000)).run()
      } catch (e) {
        return error('Could not create show. Check that the slug is unique.', 409)
      }
      await audit(env, identity.email, 'create', 'show', id)
      return json({ id, title, slug }, 201)
    }

    if (path === '/api/admin/episodes' && request.method === 'GET') {
      const result = await env.DB.prepare(`${episodeSelect()} ORDER BY e.created_at DESC LIMIT 250`).all()
      return json({ episodes: result.results || [] })
    }

    if (path === '/api/admin/episodes' && request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body.title !== 'string' || !body.title.trim() || typeof body.show_id !== 'string') {
        return error('Title and show_id are required.')
      }
      const show = await env.DB.prepare('SELECT id FROM shows WHERE id = ?').bind(body.show_id).first()
      if (!show) return error('The selected show does not exist.', 422)
      const id = crypto.randomUUID()
      const title = body.title.trim().slice(0, 200)
      const slug = slugify(body.slug || title) || id
      const status = ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft'
      const publishedAt = status === 'published' ? (body.published_at || new Date().toISOString()) : null
      try {
        await env.DB.prepare(`INSERT INTO episodes
          (id, show_id, title, slug, description, audio_key, artwork_key, duration_seconds, published_at, status, explicit, episode_number, season_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, body.show_id, title, slug, String(body.description || '').slice(0, 10000),
            body.audio_key || null, body.artwork_key || null,
            Number.isInteger(body.duration_seconds) && body.duration_seconds >= 0 ? body.duration_seconds : null,
            publishedAt, status, body.explicit ? 1 : 0,
            Number.isInteger(body.episode_number) ? body.episode_number : null,
            Number.isInteger(body.season_number) ? body.season_number : null).run()
      } catch {
        return error('Could not create episode. Check show_id and ensure the slug is unique.', 409)
      }
      await audit(env, identity.email, 'create', 'episode', id)
      return json({ id, title, slug, status }, 201)
    }

    const match = path.match(/^\/api\/admin\/episodes\/([a-f0-9-]+)$/i)
    if (match && request.method === 'PATCH') {
      const id = match[1]
      const current = await env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(id).first()
      if (!current) return error('Episode not found.', 404)
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return error('A JSON object is required.')
      const allowed = ['title', 'description', 'slug', 'audio_key', 'artwork_key', 'duration_seconds', 'published_at', 'status', 'explicit', 'episode_number', 'season_number']
      const values = []
      const sets = []
      for (const key of allowed) {
        if (!(key in body)) continue
        let value = body[key]
        if (key === 'title') {
          if (typeof value !== 'string' || !value.trim()) return error('Title cannot be empty.')
          value = value.trim().slice(0, 200)
        }
        if (key === 'description') value = String(value || '').slice(0, 10000)
        if (key === 'slug') value = slugify(value)
        if (key === 'status' && !['draft', 'published', 'archived'].includes(value)) return error('Invalid episode status.')
        if (key === 'explicit') value = value ? 1 : 0
        if (key === 'duration_seconds' && value !== null && (!Number.isInteger(value) || value < 0)) return error('duration_seconds must be a non-negative integer or null.')
        if (['episode_number', 'season_number'].includes(key) && value !== null && !Number.isInteger(value)) return error(`${key} must be an integer or null.`)
        sets.push(`${key} = ?`)
        values.push(value)
      }
      if (!sets.length) return error('No editable fields supplied.')
      sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
      if (body.status === 'published' && !('published_at' in body)) {
        sets.push("published_at = COALESCE(published_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
      }
      values.push(id)
      try {
        await env.DB.prepare(`UPDATE episodes SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()
      } catch {
        return error('Could not update episode. Check the supplied values and slug uniqueness.', 409)
      }
      await audit(env, identity.email, 'update', 'episode', id)
      return json({ ok: true, id })
    }

    if (path.startsWith('/api/admin/uploads/') && request.method === 'DELETE') {
      const key = decodeURIComponent(path.slice('/api/admin/uploads/'.length))
      if (!key.startsWith('audio/') && !key.startsWith('artwork/')) return error('Invalid media key.')
      await env.AUDIO.delete(key)
      await env.DB.prepare('DELETE FROM media_assets WHERE object_key = ?').bind(key).run()
      await audit(env, identity.email, 'delete', 'media', key)
      return json({ ok: true })
    }

    if (path === '/api/admin/uploads' && request.method === 'POST') {
      const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (!AUDIO_TYPES.has(contentType)) return error('Unsupported audio content type.', 415)
      const declaredLengthHeader = request.headers.get('content-length')
      const declaredLength = declaredLengthHeader === null ? null : Number(declaredLengthHeader)
      const limit = maxUploadBytes(env)
      if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength <= 0)) {
        return error('Invalid Content-Length header.', 400)
      }
      if (declaredLength !== null && declaredLength > limit) {
        return error(`Upload exceeds the ${limit}-byte limit.`, 413)
      }
      if (!request.body) return error('An audio file body is required.', 400)
      const originalFilename = cleanFilename(request.headers.get('x-file-name') || 'audio')
      const ext = EXTENSIONS[contentType] || 'bin'
      const key = `audio/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
      let sizeBytes = 0
      const limitedBody = request.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          sizeBytes += chunk.byteLength
          if (sizeBytes > limit) throw new Error('UPLOAD_LIMIT_EXCEEDED')
          controller.enqueue(chunk)
        },
      }))
      try {
        await env.AUDIO.put(key, limitedBody, {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: { originalFilename, uploadedBy: identity.email },
        })
      } catch (uploadError) {
        if (uploadError?.message === 'UPLOAD_LIMIT_EXCEEDED') {
          await env.AUDIO.delete(key).catch(() => {})
          return error(`Upload exceeds the ${limit}-byte limit.`, 413)
        }
        throw uploadError
      }
      const id = crypto.randomUUID()
      await env.DB.prepare('INSERT INTO media_assets (id, object_key, original_filename, content_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, key, originalFilename, contentType, sizeBytes, identity.email).run()
      await audit(env, identity.email, 'upload', 'media', id)
      return json({ id, key, original_filename: originalFilename, content_type: contentType, size_bytes: sizeBytes, media_url: `${(env.PUBLIC_MEDIA_BASE_URL || new URL(request.url).origin).replace(/\/$/, '')}/api/media?key=${encodeURIComponent(key)}` }, 201)
    }

    return error('Admin endpoint not found.', 404)
  }

  return error('Not found.', 404)
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env)
    } catch (caught) {
      if (caught instanceof Response) return caught
      console.error('Podcast API error:', caught)
      return error('Internal server error.', 500)
    }
  },
}
