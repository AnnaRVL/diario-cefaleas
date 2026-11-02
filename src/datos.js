// Conexión con Supabase: mismo proyecto y misma cuenta que Kakebo.
// La clave publicable puede estar en el código: la protección la dan las reglas de la tabla.
const SUPABASE_URL = 'https://xcqhdqiwjbznogyknbzq.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Qq2wKi6JOS2olbgCubqxlQ_lGVcXBZf'
const TABLA = 'diario'
const STORE = 'diario_sesion'

let sesion = null
try { sesion = JSON.parse(localStorage.getItem(STORE)) } catch { sesion = null }

function guardarSesion(s) {
  sesion = s
  try {
    if (s) localStorage.setItem(STORE, JSON.stringify(s))
    else localStorage.removeItem(STORE)
  } catch { /* la sesión sigue en memoria */ }
}

async function pedirToken(grant, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error_description || json.msg || 'Error de acceso'), { status: res.status })
  guardarSesion({ access_token: json.access_token, refresh_token: json.refresh_token, user_id: json.user.id })
}

export const entrar = (email, password) => pedirToken('password', { email, password })
export const salir = () => guardarSesion(null)
export const haySesion = async () => !!sesion

async function renovar() {
  if (!sesion) return false
  try {
    await pedirToken('refresh_token', { refresh_token: sesion.refresh_token })
    return true
  } catch (e) {
    if (e.status === 400 || e.status === 401) guardarSesion(null)
    return false
  }
}

async function api(ruta, opciones = {}, reintento = true) {
  if (!sesion) throw Object.assign(new Error('Sin sesión'), { status: 401 })
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${sesion.access_token}`, ...(opciones.headers || {}) },
  })
  if (res.status === 401 && reintento && (await renovar())) return api(ruta, opciones, false)
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status })
  return res
}

export async function leerTodo() {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const res = await api(`${TABLA}?select=coleccion,doc_id,data&order=updated_at.asc&limit=1000&offset=${desde}`)
    const pagina = await res.json()
    filas.push(...pagina)
    if (pagina.length < 1000) return filas
  }
}

export async function guardarDoc(coleccion, doc_id, data) {
  await api(`${TABLA}?on_conflict=user_id,coleccion,doc_id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: sesion.user_id, coleccion, doc_id, data, updated_at: new Date().toISOString() }),
  })
}

export async function borrarDoc(coleccion, doc_id) {
  await api(`${TABLA}?coleccion=eq.${encodeURIComponent(coleccion)}&doc_id=eq.${encodeURIComponent(doc_id)}`, { method: 'DELETE' })
}

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
