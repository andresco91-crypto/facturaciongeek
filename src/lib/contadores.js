import { doc, runTransaction } from 'firebase/firestore'
import { db } from './firebase'

// Genera el siguiente número de factura de forma atómica, usando un documento
// contador en Firestore. Evita que dos ventas simultáneas obtengan el mismo número.
//
// SIN INTERNET: la transacción necesita conexión para funcionar (no se puede
// "poner en cola" como una escritura normal). Si se detecta que no hay señal,
// o si la transacción falla, se genera un número provisional al instante para
// no bloquear la venta. Al reconectar, revisa el historial si necesitas
// renumerar manualmente esas facturas.
export async function obtenerSiguienteNumeroFactura() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'FAC-OFFLINE-' + Date.now().toString().slice(-8)
  }

  const contadorRef = doc(db, 'contadores', 'ventas')

  try {
    const siguiente = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(contadorRef)
      const actual = snap.exists() ? Number(snap.data().ultimo) || 0 : 0
      const nuevo = actual + 1
      transaction.set(contadorRef, { ultimo: nuevo }, { merge: true })
      return nuevo
    })
    return 'FAC-' + String(siguiente).padStart(6, '0')
  } catch (err) {
    return 'FAC-OFFLINE-' + Date.now().toString().slice(-8)
  }
}
