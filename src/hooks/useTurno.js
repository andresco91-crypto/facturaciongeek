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

  // Permite corregir un turno YA CERRADO si hubo un error al contar el
  // efectivo, la base, o el jornal. Recalcula la diferencia y deja registrado
  // el valor anterior de cada campo, quién/cuándo se hizo la corrección.
  async function editarCierre(turnoId, valoresNuevos, valoresAnteriores) {
    const nuevaDiferencia =
      Number(valoresNuevos.montoFinalEfectivo) -
      (Number(valoresNuevos.montoInicial) +
        Number(valoresAnteriores.totalVentasEfectivo || 0) -
        Number(valoresNuevos.totalGastos))

    await updateDoc(doc(db, 'turnos', turnoId), {
      montoInicial: Number(valoresNuevos.montoInicial) || 0,
      montoFinalEfectivo: Number(valoresNuevos.montoFinalEfectivo) || 0,
      totalGastos: Number(valoresNuevos.totalGastos) || 0,
      diferencia: nuevaDiferencia,
      edicionesCierre: arrayUnion({
        montoInicialAnterior: Number(valoresAnteriores.montoInicial) || 0,
        montoFinalAnterior: Number(valoresAnteriores.montoFinalEfectivo) || 0,
        totalGastosAnterior: Number(valoresAnteriores.totalGastos) || 0,
        diferenciaAnterior: Number(valoresAnteriores.diferencia) || 0,
        montoInicialNuevo: Number(valoresNuevos.montoInicial) || 0,
        montoFinalNuevo: Number(valoresNuevos.montoFinalEfectivo) || 0,
        totalGastosNuevo: Number(valoresNuevos.totalGastos) || 0,
        diferenciaNueva: nuevaDiferencia,
        fecha: Timestamp.now(),
      }),
    })

    return nuevaDiferencia
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

  return { turno, cargando, abrirTurno, editarMontoInicial, editarCierre, cerrarTurno, obtenerVentasDelTurno }
}
