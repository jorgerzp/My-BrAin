import './load-env.js'

let tokenCache = {
  accessToken: null,
  expiresAt: null,
}

/**
 * Obtiene el token de acceso de Tink usando Client ID y Client Secret con flujo client_credentials.
 * Almacena en caché el token obtenido según su fecha de expiración. Admite scope dinámico.
 */
async function getAccessToken(scope = 'link-session:write') {
  const clientId = process.env.TINK_CLIENT_ID?.trim()
  const clientSecret = process.env.TINK_CLIENT_SECRET?.trim()

  if (!clientId || clientId === 'tu_client_id_aqui' || !clientSecret || clientSecret === 'tu_client_secret_aqui') {
    throw new Error(
      'La API de Tink no está configurada. Por favor, añada TINK_CLIENT_ID y TINK_CLIENT_SECRET en el archivo .env del backend.'
    )
  }

  // Comprobar si el token almacenado sigue siendo válido
  if (tokenCache.accessToken && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken
  }

  console.log(`[Tink] Solicitando nuevo token de acceso con scope "${scope}"...`)
  
  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('client_secret', clientSecret)
  params.append('grant_type', 'client_credentials')
  params.append('scope', scope)

  const response = await fetch('https://api.tink.com/api/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.errorMessage || data.error_description || `Error HTTP ${response.status} al solicitar token de Tink`)
  }

  tokenCache.accessToken = data.access_token
  const expiresIn = Number(data.expires_in || 1800)
  tokenCache.expiresAt = Date.now() + (expiresIn - 60) * 1000

  return data.access_token
}

/**
 * Crea una sesión de Tink Link (Hosted Flow) en España y retorna la URL de redirección.
 * Realiza un fallback automático a /link/v1/session si el endpoint principal retorna 404.
 */
export async function createLinkSession() {
  const clientId = process.env.TINK_CLIENT_ID?.trim()
  const redirectUri = 'http://localhost:5275/finanzas'

  // 1. Obtener token con scope 'link-session:write'
  const token = await getAccessToken('link-session:write')

  const payloadUser = {
    market: 'ES',
    locale: 'es_ES',
    redirect_uri: redirectUri,
    products: ['ACCOUNT_INFORMATION']
  }

  // 2. Intentar POST al endpoint solicitado por el usuario
  const urlUser = 'https://api.tink.com/api/v1/link/sessions'
  console.log(`[Tink] Creando sesión de enlace en Tink: POST a ${urlUser}...`)
  
  let response = await fetch(urlUser, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payloadUser),
  })

  let resData = await response.json().catch(() => ({}))
  console.log(`[Tink] Respuesta de ${urlUser} - Estatus HTTP: ${response.status}`)

  if (response.ok && resData.session_url) {
    console.log(`[Tink] Sesión creada con éxito vía ${urlUser}: ${resData.session_url}`)
    return resData.session_url
  }

  // 3. Fallback al endpoint oficial /link/v1/session si da 404 o no devuelve session_url
  if (response.status === 404 || !resData.session_url) {
    const urlOfficial = 'https://api.tink.com/link/v1/session'
    console.log(`[Tink] Fallback: Creando sesión en Tink Link mediante POST a ${urlOfficial}...`)

    const payloadOfficial = {
      externalReference: `ref-${Date.now()}`
    }

    response = await fetch(urlOfficial, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payloadOfficial),
    })

    resData = await response.json().catch(() => ({}))
    console.log(`[Tink] Respuesta de ${urlOfficial} - Estatus HTTP: ${response.status}`)

    if (!response.ok) {
      throw new Error(resData.message || resData.errorMessage || `Error HTTP ${response.status} al iniciar sesión de Tink Link`)
    }

    const sessionId = resData.sessionId
    if (!sessionId) {
      throw new Error('No se recibió el sessionId del servidor de Tink')
    }

    // Construir la URL de redirección final de Tink Link
    const tinkLinkUrl = `https://link.tink.com/1.0/transactions/connect-accounts?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&market=ES&locale=es_ES&session_id=${sessionId}`
    console.log(`[Tink] Sesión creada con éxito vía ${urlOfficial} (Fallback). URL generada: ${tinkLinkUrl}`)
    return tinkLinkUrl
  }

  throw new Error('No se pudo generar la sesión de conexión con Tink.')
}

/**
 * --- STUBS DE COMPATIBILIDAD ---
 * Funciones heredadas de GoCardless mapeadas para evitar errores de compilación
 * y permitir una futura integración de Tink Link para sincronizar movimientos.
 */

export async function getInstitutionDetails(institutionId) {
  return { id: institutionId, name: 'Banco' }
}

export async function createRequisition() {
  throw new Error('La conexión de cuentas mediante Tink no está implementada en este stub.')
}

export async function getRequisitionDetails() {
  return { accounts: [] }
}

export async function getAccountTransactions() {
  return { transactions: { booked: [], pending: [] } }
}
