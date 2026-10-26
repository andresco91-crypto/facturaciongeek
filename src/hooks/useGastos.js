import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
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

  // Deja los gastos de un turno ya cerrado iguales a los valores corregidos,
  // para que Reportes (que lee de esta colección) refleje la corrección.
  // - Si el valor nuevo es 0, se borran los registros de ese tipo.
  // - Si ya había registro, se actualiza su monto (conserva su fecha y nota).
  // - Si no había, se crea uno con la fecha de cierre del turno, para que
  //   caiga en el día correcto del reporte.
  async function sincronizarGastosDelTurno(turnoId, jornalNuevo, otrosNuevo, fechaCierre) {
    const lista = await obtenerGastosDelTurno(turnoId)
    const docsOtros = lista.filter((g) => g.concepto === 'Otros gastos')
    const docsJornal = lista.filter((g) => g.concepto !== 'Otros gastos')

    async function sincronizarTipo(docs, valorNuevo, concepto, notaPorDefecto) {
      const valor = Number(valorNuevo) || 0

      if (valor <= 0) {
        for (const g of docs) await deleteDoc(doc(db, 'gastos', g.id))
        return
      }

      if (docs.length > 0) {
        await updateDoc(doc(db, 'gastos', docs[0].id), { monto: valor })
        for (const extra of docs.slice(1)) await deleteDoc(doc(db, 'gastos', extra.id))
      } else {
        await addDoc(collection(db, 'gastos'), {
          turnoId,
          concepto,
          monto: valor,
          nota: notaPorDefecto,
          fecha: fechaCierre || serverTimestamp(),
        })
      }
    }

    await sincronizarTipo(docsJornal, jornalNuevo, 'Cobro de jornal', 'Cobro de jornal (corregido)')
    await sincronizarTipo(docsOtros, otrosNuevo, 'Otros gastos', 'Otros gastos (corregido)')
  }

  return { registrarGasto, obtenerGastosDelTurno, sincronizarGastosDelTurno }
}
