import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Los gastos por ahora son solo una categoría fija: cobro de jornal del trabajador.
// Se descuentan del efectivo esperado al cerrar el turno de caja.
export function useGastos() {
  async function registrarGasto(turnoId, monto, nota) {
    await addDoc(collection(db, 'gastos'), {
      turnoId,
      concepto: 'Cobro de jornal',
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
