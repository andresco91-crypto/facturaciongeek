import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Escucha en tiempo real si hay un turno de caja abierto (fechaCierre == null).
// Como solo puede haber uno abierto a la vez en toda la tienda, esto sirve
// tanto para el módulo de Caja como para bloquear Ventas si no hay turno activo.
export function useTurno() {
  const [turno, setTurno] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'turnos'), where('fechaCierre', '==', null))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setTurno(null)
      } else {
        const d = snapshot.docs[0]
        setTurno({ id: d.id, ...d.data() })
      }
      setCargando(false)
    })
    return unsubscribe
  }, [])

  async function abrirTurno(montoInicial) {
    await addDoc(collection(db, 'turnos'), {
      fechaApertura: serverTimestamp(),
      fechaCierre: null,
      montoInicial: Number(montoInicial) || 0,
      montoFinalEfectivo: null,
    })
  }

  // Permite corregir la base de caja si hubo un error al contar,
  // dejando registrado quién/cuándo/qué valor tenía antes en el propio turno.
  async function editarMontoInicial(turnoId, nuevoMonto, montoAnterior) {
    await updateDoc(doc(db, 'turnos', turnoId), {
      montoInicial: Number(nuevoMonto) || 0,
      edicionesBase: arrayUnion({
        anterior: Number(montoAnterior) || 0,
        nuevo: Number(nuevoMonto) || 0,
        fecha: Timestamp.now(),
      }),
    })
  }

  async function cerrarTurno(turnoId, montoFinalEfectivo, resumenVentas) {
    await updateDoc(doc(db, 'turnos', turnoId), {
      fechaCierre: serverTimestamp(),
      montoFinalEfectivo: Number(montoFinalEfectivo) || 0,
      totalVentasEfectivo: resumenVentas.efectivo,
      totalVentasTarjeta: resumenVentas.tarjeta,
      totalVentasTransferencia: resumenVentas.transferencia,
      totalVentasSistecredito: resumenVentas.sistecredito || 0,
      totalVentasAddi: resumenVentas.addi || 0,
      totalGastos: resumenVentas.totalGastos || 0,
      diferencia: resumenVentas.diferencia,
    })
  }

  // Trae las ventas del turno para calcular el resumen al cerrar,
  // excluyendo las que fueron anuladas (ya no deben contar en el cuadre).
  async function obtenerVentasDelTurno(turnoId) {
    const q = query(collection(db, 'ventas'), where('turnoId', '==', turnoId))
    const snapshot = await getDocs(q)
    return snapshot.docs
      .map((d) => d.data())
      .filter((v) => v.anulada !== true)
  }

  return { turno, cargando, abrirTurno, editarMontoInicial, cerrarTurno, obtenerVentasDelTurno }
}
