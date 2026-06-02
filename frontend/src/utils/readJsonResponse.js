/**
 * Lee el cuerpo de una Response como JSON con mensajes claros si viene vacío o no es JSON
 * (p. ej. proxy sin backend, HTML de SPA, 502 sin cuerpo).
 */
export async function readJsonResponse(res) {
  const raw = await res.text()
  const trimmed = raw.trim()

  if (!trimmed) {
    const hint =
      res.status === 502 || res.status === 503 || res.status === 504
        ? ' ¿Está el backend arrancado en el puerto 3001 (carpeta backend/server, npm run dev)?'
        : ''
    throw new Error(`Respuesta vacía del servidor (HTTP ${res.status}).${hint}`)
  }

  const ct = res.headers.get('content-type') || ''
  if (!/json/i.test(ct) && trimmed.startsWith('<')) {
    throw new Error(
      'El servidor devolvió HTML en lugar de JSON. Comprueba que las rutas /api reenvíen al backend (Vite proxy) y no uses solo «npm run preview» sin API.'
    )
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`Respuesta no válida como JSON (HTTP ${res.status}): ${trimmed.slice(0, 180)}…`)
  }
}
