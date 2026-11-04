// Conexión de este POS (Geek Store Venecia) con la página geekstore.com.co.
//
// La página se alimenta del POS de Kennedy, que expone una API para Venecia.
// Este POS sigue siendo el dueño del producto, el precio y el stock; aquí
// solo se hace esto:
//   1. Publicar un coleccionable (crea su ficha web en Kennedy y abre el editor).
//   2. Avisar cada cambio de stock o precio de un producto publicado.
//   3. Consultar el estado web de los productos.
//
// Los avisos NUNCA deben frenar ni hacer fallar una venta: primero se guardan
// en una cola en localStorage ('colaWeb') y después se envían. Si el envío
// falla (sin internet, Kennedy caído), la cola se reintenta al abrir el POS,
// cada 5 minutos y cuando vuelve la conexión.

import {
  collection,
  doc,
  documentId,
  getDocs,
  getDocsFromCache,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env.VITE_GEEK_API_URL || 'https://geekstore-pos.netlify.app').replace(
  /\/+$/,
  ''
)
// La clave viene del build (secreto de GitHub o .env.local). Nunca se imprime.
const API_KEY = import.meta.env.VITE_GEEK_API_KEY || ''

export const CATEGORIA_COLECCIONABLES = 'Coleccionables'
export const webConfigurada = Boolean(API_KEY)

const CLAVE_COLA = 'colaWeb'
const CLAVE_SYNC_DIARIA = 'colaWebSyncDiaria'
const EVENTO_COLA = 'colaweb-cambio'
const INTERVALO_REINTENTO_MS = 5 * 60 * 1000
const TAMANO_CONSULTA = 30 // máximo de valores por consulta 'in' en Firestore

// ---------------------------------------------------------------------------
// Llamadas a la API de Kennedy
// ---------------------------------------------------------------------------

// Error de la API. Kennedy responde { ok:false, codigo, paso, error }, donde
// codigo es 'clave' (401), 'datos' (400), 'lento' (504) o 'error' (500).
export class ErrorWeb extends Error {
  constructor(mensaje, status, codigo = null, paso = null) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.paso = paso
  }
}

const ESPERA_REINTENTO_MS = 3000

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function llamarApi(ruta, { method = 'GET', body } = {}) {
  if (!API_KEY) {
    throw new ErrorWeb('Falta configurar la clave de la web (VITE_GEEK_API_KEY).', 0)
  }

  // Si Kennedy está lento (504) o falla (5xx), se reintenta UNA vez a los 3 s.
  for (let intento = 1; ; intento++) {
    let respuesta
    try {
      respuesta = await fetch(API_URL + ruta, {
        method,
        headers: {
          'x-sede-clave': API_KEY,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new ErrorWeb('No hay conexión con la página web.', 0)
    }

    let datos = null
    try {
      datos = await respuesta.json()
    } catch {
      datos = null
    }

    if (respuesta.ok && datos && datos.ok !== false) {
      return datos
    }

    if (respuesta.status >= 500 && intento === 1) {
      await esperar(ESPERA_REINTENTO_MS)
      continue
    }

    // Sin JSON: la falla fue de Netlify, antes de llegar al código de Kennedy.
    if (!datos) {
      throw new ErrorWeb(`Kennedy no respondió (código ${respuesta.status}).`, respuesta.status)
    }

    // Con JSON: se muestra el mensaje de Kennedy tal cual.
    throw new ErrorWeb(
      datos.error || `Kennedy respondió con un error (código ${respuesta.status}).`,
      respuesta.status,
      datos.codigo || null,
      datos.paso || null
    )
  }
}

// Convierte un producto del POS al formato que espera la web.
function itemWeb(producto) {
  return {
    codigo: producto.codigo,
    stock: Math.max(0, Math.trunc(Number(producto.stock) || 0)),
    precio: Number(producto.precioPublico) || 0,
  }
}

// 1) Publicar / abrir el editor. Crea la ficha en Kennedy si no existe (sin
// publicarla) o actualiza precio y stock si ya existe. Guarda el vínculo en
// el documento del producto. El enlace del editor vale 15 minutos: no se guarda.
export async function publicarProducto(producto) {
  const datos = await llamarApi('/api/publico/sedes/publicar', {
    method: 'POST',
    body: {
      codigo: producto.codigo,
      nombre: producto.nombre,
      precio: Number(producto.precioPublico) || 0,
      stock: Math.max(0, Math.trunc(Number(producto.stock) || 0)),
    },
  })

  const p = datos.producto || {}
  const web = {
    enKennedy: true,
    idGeek: p.id ?? null,
    referencia: p.referencia || null,
    actualizadoEn: p.sincronizado || new Date().toISOString(),
  }

  try {
    await updateDoc(doc(db, 'productos', producto.codigo), { web })
  } catch (err) {
    console.error('No se pudo guardar el vínculo web del producto:', err.message)
  }

  return { producto: p, enlace: datos.enlace, web }
}

// Diagnóstico de la conexión con Kennedy (botón "Probar conexión").
// Responde { ok, baseDeDatosMs, productos, origenPermitido, whatsapp, ia, quitarFondo }.
export async function probarConexion() {
  return llamarApi('/api/publico/sedes/estado')
}

// 3) Estado web de los productos de Venecia, indexado por código.
export async function obtenerEstadoWeb() {
  const datos = await llamarApi('/api/publico/sedes/productos')
  const porCodigo = {}
  for (const p of datos.productos || []) {
    if (p && p.codigo) porCodigo[p.codigo] = p
  }
  return porCodigo
}

// ---------------------------------------------------------------------------
// Cola de avisos pendientes (localStorage)
// ---------------------------------------------------------------------------

let ultimoError = null
let procesando = false

function leerCola() {
  try {
    const raw = localStorage.getItem(CLAVE_COLA)
    const cola = raw ? JSON.parse(raw) : {}
    return cola && typeof cola === 'object' ? cola : {}
  } catch {
    return {}
  }
}

function guardarCola(cola) {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola))
  } catch {
    // Sin localStorage la cola solo vive en esta sesión; no se rompe nada.
  }
  emitirCambio()
}

function emitirCambio() {
  try {
    window.dispatchEvent(new Event(EVENTO_COLA))
  } catch {
    // Entorno sin window: nada que avisar.
  }
}

function fijarError(mensaje) {
  if (ultimoError !== mensaje) {
    ultimoError = mensaje
    emitirCambio()
  }
}

// Quita de la cola los códigos enviados, salvo los que se volvieron a
// encolar mientras se enviaban (esos se envían en el siguiente intento).
function quitarDeCola(codigos, desde) {
  const cola = leerCola()
  for (const c of codigos) {
    if (cola[c] !== undefined && cola[c] <= desde) delete cola[c]
  }
  guardarCola(cola)
}

export function estadoColaWeb() {
  return { pendientes: Object.keys(leerCola()).length, error: ultimoError }
}

// Avisa a quien escuche (indicador de pendientes) cada vez que cambia la cola.
export function suscribirColaWeb(callback) {
  const manejar = () => callback(estadoColaWeb())
  window.addEventListener(EVENTO_COLA, manejar)
  window.addEventListener('storage', manejar) // cambios desde otra pestaña
  return () => {
    window.removeEventListener(EVENTO_COLA, manejar)
    window.removeEventListener('storage', manejar)
  }
}

// Guarda códigos en la cola sin enviar nada todavía. Es instantáneo y no
// depende de internet, por eso es lo primero que se hace en una venta.
export function encolarWeb(codigos) {
  if (!API_KEY) return
  const lista = [...new Set((codigos || []).map((c) => String(c || '').trim()).filter(Boolean))]
  if (lista.length === 0) return
  const cola = leerCola()
  const ahora = Date.now()
  for (const c of lista) cola[c] = ahora
  guardarCola(cola)
}

// Lee el stock y el precio actuales de esos productos en Firestore. Si no
// hay servidor, usa la copia local (que ya incluye los cambios recién hechos).
async function leerProductos(codigos) {
  const productos = []
  for (let i = 0; i < codigos.length; i += TAMANO_CONSULTA) {
    const lote = codigos.slice(i, i + TAMANO_CONSULTA)
    const q = query(collection(db, 'productos'), where(documentId(), 'in', lote))
    let snapshot
    try {
      snapshot = await getDocs(q)
    } catch {
      snapshot = await getDocsFromCache(q)
    }
    snapshot.docs.forEach((d) => productos.push({ ...d.data(), codigo: d.id }))
  }
  return productos
}

// 2) Envía a la web los cambios pendientes de la cola. Nunca lanza errores.
export async function procesarColaWeb() {
  if (!API_KEY || procesando) return
  const codigos = Object.keys(leerCola())
  if (codigos.length === 0) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  procesando = true
  const inicio = Date.now()
  try {
    const productos = await leerProductos(codigos)
    const items = productos.filter((p) => p.web && p.web.enKennedy).map(itemWeb)
    if (items.length > 0) {
      await llamarApi('/api/publico/sedes/stock', { method: 'POST', body: { items } })
    }
    // Los códigos sin ficha web (o que ya no existen) no necesitan aviso.
    quitarDeCola(codigos, inicio)
    fijarError(null)
  } catch (err) {
    fijarError(err.message)
  } finally {
    procesando = false
  }
}

// Punto único que llaman ventas, compras, devoluciones, etc. después de
// guardar. Encola y luego intenta enviar. Nunca lanza errores ni bloquea.
export function avisarWeb(codigos) {
  try {
    encolarWeb(codigos)
    procesarColaWeb()
  } catch (err) {
    console.error('Aviso a la web pendiente:', err.message)
  }
}

// ---------------------------------------------------------------------------
// Sincronización completa (diaria y botón "Sincronizar web")
// ---------------------------------------------------------------------------

function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Envía la lista COMPLETA de productos con ficha web. Los que no vengan en
// la lista quedan en stock 0 en la web, por eso solo se usa una lectura del
// servidor: si no se puede leer completa, no se envía nada.
export async function sincronizarWebCompleto() {
  const inicio = Date.now()
  const q = query(collection(db, 'productos'), where('web.enKennedy', '==', true))
  const snapshot = await getDocs(q)
  const items = snapshot.docs.map((d) => itemWeb({ ...d.data(), codigo: d.id }))

  if (items.length === 0) {
    return { enviados: 0, actualizados: 0 }
  }

  const datos = await llamarApi('/api/publico/sedes/stock', {
    method: 'POST',
    body: { items, completo: true },
  })

  try {
    localStorage.setItem(CLAVE_SYNC_DIARIA, hoyLocal())
  } catch {
    // sin localStorage se repetirá la próxima vez que se abra el POS
  }
  quitarDeCola(Object.keys(leerCola()), inicio)
  fijarError(null)

  return {
    enviados: items.length,
    actualizados: Number(datos.actualizados) || 0,
    enCero: Number(datos.enCero) || 0,
  }
}

function yaSeSincronizoHoy() {
  try {
    return localStorage.getItem(CLAVE_SYNC_DIARIA) === hoyLocal()
  } catch {
    return false
  }
}

async function sincronizacionDiaria() {
  if (!API_KEY || yaSeSincronizoHoy()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  try {
    await sincronizarWebCompleto()
  } catch (err) {
    fijarError(err.message)
  }
}

// Se llama una vez al entrar al POS (después del login). Envía lo pendiente,
// hace la sincronización del día y deja los reintentos programados.
export function iniciarSincronizacionWeb() {
  if (!API_KEY) return () => {}

  procesarColaWeb()
  sincronizacionDiaria()

  const intervalo = setInterval(() => {
    procesarColaWeb()
    sincronizacionDiaria() // por si el POS queda abierto de un día para otro
  }, INTERVALO_REINTENTO_MS)

  const alVolverInternet = () => procesarColaWeb()
  window.addEventListener('online', alVolverInternet)

  return () => {
    clearInterval(intervalo)
    window.removeEventListener('online', alVolverInternet)
  }
}

// ---------------------------------------------------------------------------
// Fase 1 (pendiente): pedidos web pagados con Wompi.
// Aquí irá consultarPedidosWeb() y lo relacionado con reservar unidades,
// preparar pedidos y traslados entre sedes, usando llamarApi() igual que arriba.
// ---------------------------------------------------------------------------
