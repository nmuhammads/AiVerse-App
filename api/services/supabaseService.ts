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
    try {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
        const r = await fetch(url, { headers: { ...supaHeaders(), 'Content-Type': 'application/json', 'Prefer': 'count=exact' } })
        const data = await r.json().catch(() => null)
        return { ok: r.ok, data, headers: Object.fromEntries(r.headers.entries()) }
    } catch (e) {
        console.error(`[SupaBase] Select error (${table}):`, e)
        return { ok: false, data: null, headers: {} }
    }
}

export async function supaPost(table: string, body: unknown, params = '') {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${table}${params}`
        const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) })
        const data = await r.json().catch(() => null)
        return { ok: r.ok, data }
    } catch (e) {
        console.error(`[SupaBase] Post error (${table}):`, e)
        return { ok: false, data: null }
    }
}

export async function supaPatch(table: string, filter: string, body: unknown) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
        const r = await fetch(url, { method: 'PATCH', headers: { ...supaHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const data = await r.json().catch(() => null)
        return { ok: r.ok, data }
    } catch (e) {
        console.error(`[SupaBase] Patch error (${table}):`, e)
        return { ok: false, data: null }
    }
}

export async function supaStorageUpload(pathname: string, buf: Buffer, contentType = 'image/jpeg') {
    try {
        const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${pathname}`

        const r = await fetch(url, {
            method: 'POST',
            headers: { ...supaHeaders(), 'Content-Type': contentType, 'x-upsert': 'true' },
            body: buf as any
        })

        const data = await r.json().catch(() => null)
        return { ok: r.ok, data }
    } catch (e) {
        console.error(`[SupaBase] Upload error (${pathname}):`, e)
        return { ok: false, data: null }
    }
}

export async function supaDelete(table: string, filter: string) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
        const r = await fetch(url, { method: 'DELETE', headers: { ...supaHeaders(), 'Content-Type': 'application/json' } })
        return { ok: r.ok }
    } catch (e) {
        console.error(`[SupaBase] Delete error (${table}):`, e)
        return { ok: false }
    }
}

// ============ App Config Functions ============

/**
 * Get a config value from app_config table
 */
export async function getAppConfig(key: string): Promise<string | null> {
    const result = await supaSelect('app_config', `?key=eq.${encodeURIComponent(key)}&select=value`)
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
        return result.data[0].value
    }
    return null
}

/**
 * Set a config value in app_config table
 */
export async function setAppConfig(key: string, value: string): Promise<boolean> {
    const result = await supaPatch('app_config', `?key=eq.${encodeURIComponent(key)}`, {
        value,
        updated_at: new Date().toISOString()
    })
    return result.ok
}

export { SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET }

