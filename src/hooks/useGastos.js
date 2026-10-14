import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Gastos que se registran al cerrar el turno de caja. Dos tipos:
//  - 'Cobro de jornal'  → lo que se cobra el trabajador ese día
//  - 'Otros gastos'     → cualquier otro gasto pagado con el efectivo de la caja
// Ambos se descuentan del efectivo esperado al cuadrar.
export function useGastos() {
  async function registrarGasto(turnoId, monto, nota, concepto = 'Cobro de jornal') {
    await addDoc(collection(db, 'gastos'), {
      turnoId,
      concepto,
      monto: Number(monto) || 0,
      nota: nota || '',
      fecha: serverTimestamp(),
    })
  }

  async function obtenerGastosDelTurno(turnoId) {
    const q = query(collection(db, 'gastos'), where('turnoId', '==', turnoId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  return { registrarGasto, obtenerGastosDelTurno }
}
