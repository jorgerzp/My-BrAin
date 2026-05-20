/**
 * Parsea fecha de ticket a YYYY-MM-DD (ISO o DD/MM/YYYY, DD-MM-YYYY).
 * @param {unknown} s
 * @returns {string | null}
 */
export function parseTicketFechaFromString(s) {
  const t = typeof s === 'string' ? s.trim() : ''
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.slice(0, 10)
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const d = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    const y = parseInt(m[3], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100) {
      const test = new Date(y, mo - 1, d)
      if (test.getFullYear() === y && test.getMonth() === mo - 1 && test.getDate() === d) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }
  return null
}

/** Si no hay fecha reconocible, usa la fecha local de hoy (YYYY-MM-DD). */
export function parseTicketFechaOrToday(s) {
  return parseTicketFechaFromString(s) ?? new Date().toISOString().slice(0, 10)
}
