import { doc, runTransaction } from 'firebase/firestore'
import { db } from './firebase'

// Genera el siguiente número de factura de forma atómica, usando un documento
// contador en Firestore. Evita que dos ventas simultáneas obtengan el mismo número.
export async function obtenerSiguienteNumeroFactura() {
  const contadorRef = doc(db, 'contadores', 'ventas')

  const siguiente = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef)
    const actual = snap.exists() ? Number(snap.data().ultimo) || 0 : 0
    const nuevo = actual + 1
    transaction.set(contadorRef, { ultimo: nuevo }, { merge: true })
    return nuevo
  })

  return 'FAC-' + String(siguiente).padStart(6, '0')
}
