import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Devoluciones y cambios: registra el movimiento y su efecto en efectivo,
// ligado al turno activo para que Caja pueda mostrarlo con claridad.
export function useDevoluciones() {
  async function registrarDevolucion(datos) {
    await addDoc(collection(db, 'devoluciones'), {
      ...datos,
      fecha: serverTimestamp(),
    })
  }

  async function obtenerDevolucionesDelTurno(turnoId) {
    const q = query(collection(db, 'devoluciones'), where('turnoId', '==', turnoId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  return { registrarDevolucion, obtenerDevolucionesDelTurno }
}
