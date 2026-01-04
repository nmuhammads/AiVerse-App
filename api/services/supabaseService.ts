import dotenv from 'dotenv'

dotenv.config()

function stripQuotes(s: string) { return s.trim().replace(/^['"`]+|['"`]+$/g, '') }

const SUPABASE_URL = stripQuotes(process.env.SUPABASE_URL || '')
const SUPABASE_KEY = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '')
const SUPABASE_BUCKET = stripQuotes(process.env.SUPABASE_USER_AVATARS_BUCKET || 'avatars')

export function supaHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
    } as Record<string, string>
}

export async function supaSelect(table: string, query: string) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
    const r = await fetch(url, { headers: { ...supaHeaders(), 'Content-Type': 'application/json', 'Prefer': 'count=exact' } })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data, headers: Object.fromEntries(r.headers.entries()) }
}

export async function supaPost(table: string, body: unknown, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`
    const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

export async function supaPatch(table: string, filter: string, body: unknown) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
    const r = await fetch(url, { method: 'PATCH', headers: { ...supaHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

export async function supaStorageUpload(pathname: string, buf: Buffer, contentType = 'image/jpeg') {
    const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${pathname}`

    const r = await fetch(url, {
        method: 'POST',
        headers: { ...supaHeaders(), 'Content-Type': contentType, 'x-upsert': 'true' },
        body: buf as any
    })

    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

export async function supaDelete(table: string, filter: string) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
    const r = await fetch(url, { method: 'DELETE', headers: { ...supaHeaders(), 'Content-Type': 'application/json' } })
    return { ok: r.ok }
}

export { SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET }
