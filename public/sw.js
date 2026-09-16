// Service worker escrito a mano (sin librerías externas) para que la app
// pueda seguir cargando sin internet, una vez se haya abierto al menos
// una vez con conexión. Estrategia: intenta la red primero; si no hay
// respuesta (sin internet), sirve la última copia guardada.
// Los datos (Firestore) se manejan aparte, ya tienen su propia caché offline.

const CACHE_NAME = 'facturaciongeek-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // No interceptar solicitudes a otros dominios (Firebase, fuentes, etc.):
  // esas ya se manejan solas y no deben pasar por esta caché.
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        const copia = respuesta.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copia))
        return respuesta
      })
      .catch(() =>
        caches.match(request).then((coincidencia) => {
          if (coincidencia) return coincidencia
          if (request.mode === 'navigate') {
            return caches.match('/index.html')
          }
        })
      )
  )
})
