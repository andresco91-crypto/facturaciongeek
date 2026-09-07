import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Cada vez que se confirma una alerta de conteo (3:30pm, 5:30pm, 7:30pm),
// se guarda cuánto efectivo había en ese momento, ligado al turno activo.
export function useConteosCaja() {
  async function registrarConteo(turnoId, hora, monto) {
    await addDoc(collection(db, 'conteosCaja'), {
      turnoId: turnoId || null,
      hora,
      monto: Number(monto) || 0,
      fecha: serverTimestamp(),
    })
  }

  async function obtenerConteosDelTurno(turnoId) {
    if (!turnoId) return []
    const q = query(
      collection(db, 'conteosCaja'),
      where('turnoId', '==', turnoId),
      orderBy('fecha', 'asc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  return { registrarConteo, obtenerConteosDelTurno }
}
