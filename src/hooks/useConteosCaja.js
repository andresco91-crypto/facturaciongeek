import {
  collection,
  addDoc,
  query,
  where,
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
    // Sin orderBy en la consulta para no requerir un índice compuesto en
    // Firestore; con pocos documentos por turno, se ordena en el cliente.
    const q = query(collection(db, 'conteosCaja'), where('turnoId', '==', turnoId))
    const snapshot = await getDocs(q)
    const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    lista.sort((a, b) => {
      const fa = a.fecha?.toMillis ? a.fecha.toMillis() : 0
      const fb = b.fecha?.toMillis ? b.fecha.toMillis() : 0
      return fa - fb
    })
    return lista
  }

  return { registrarConteo, obtenerConteosDelTurno }
}
