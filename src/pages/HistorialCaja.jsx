import { useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useTurno } from '../hooks/useTurno'
import { useRole } from '../hooks/useRole'

// Fecha local del navegador, no UTC (toISOString desplaza el día en
// zonas horarias como Colombia, UTC-5).
function fechaLocalISO(d) {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function hace7DiasISO() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return fechaLocalISO(d)
}

function hoyISO() {
  return fechaLocalISO(new Date())
}

function formatearFecha(fecha) {
  if (!fecha) return '—'
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO')
}

export default function HistorialCaja() {
  const { editarCierre } = useTurno()
  const { rol } = useRole()
  const esAdmin = rol === 'admin'

  const [desde, setDesde] = useState(hace7DiasISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [turnos, setTurnos] = useState([])
  const [expandido, setExpandido] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [valoresEdicion, setValoresEdicion] = useState({})
  const [cargando, setCargando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [buscado, setBuscado] = useState(false)

  async function buscar() {
    setCargando(true)
    setError('')
    try {
      const fechaDesde = Timestamp.fromDate(new Date(desde + 'T00:00:00'))
      const fechaHasta = Timestamp.fromDate(new Date(hasta + 'T23:59:59'))

      const q = query(
        collection(db, 'turnos'),
        where('fechaApertura', '>=', fechaDesde),
        where('fechaApertura', '<=', fechaHasta),
        orderBy('fechaApertura', 'desc')
      )
      const snapshot = await getDocs(q)
      const lista = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => t.fechaCierre !== null && t.fechaCierre !== undefined)

      setTurnos(lista)
      setBuscado(true)
    } catch (err) {
      setError('Error al buscar: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function toggle(id) {
    setExpandido(expandido === id ? null : id)
    setEditandoId(null)
  }

  function empezarEdicion(t) {
    setEditandoId(t.id)
    setValoresEdicion({
      montoInicial: t.montoInicial ?? 0,
      montoFinalEfectivo: t.montoFinalEfectivo ?? 0,
      totalGastos: t.totalGastos ?? 0,
    })
    setError('')
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setValoresEdicion({})
  }

  async function guardarEdicion(t) {
    setProcesando(true)
    setError('')
    try {
      const nuevaDiferencia = await editarCierre(t.id, valoresEdicion, t)
      setTurnos((prev) =>
        prev.map((turno) =>
          turno.id === t.id
            ? {
                ...turno,
                montoInicial: Number(valoresEdicion.montoInicial) || 0,
                montoFinalEfectivo: Number(valoresEdicion.montoFinalEfectivo) || 0,
                totalGastos: Number(valoresEdicion.totalGastos) || 0,
                diferencia: nuevaDiferencia,
                edicionesCierre: [...(turno.edicionesCierre || []), { fecha: new Date() }],
              }
            : turno
        )
      )
      setEditandoId(null)
    } catch (err) {
      setError('Error al guardar la corrección: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Historial de caja</h1>

      <div className="bg-card border border-line rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-line rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-line rounded-lg px-3 py-2"
          />
        </div>
        <button
          onClick={buscar}
          disabled={cargando}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {buscado && (
        <>
          <p className="text-sm text-muted mb-2">{turnos.length} turno(s) cerrado(s)</p>

          <div className="space-y-2">
            {turnos.map((t) => {
              const diferencia = Number(t.diferencia) || 0
              return (
                <div key={t.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggle(t.id)}
                    className="w-full text-left p-3 flex justify-between items-center hover:bg-panel"
                  >
                    <div>
                      <span className="font-medium">{formatearFecha(t.fechaApertura)}</span>
                      <span className="text-muted ml-2 text-sm">
                        hasta {formatearFecha(t.fechaCierre)}
                      </span>
                      {t.edicionesCierre?.length > 0 && (
                        <span className="ml-2 text-xs bg-amber-950/60 text-amber-400 px-2 py-0.5 rounded">
                          CORREGIDO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-medium ${
                          diferencia === 0
                            ? 'text-emerald-400'
                            : diferencia > 0
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {diferencia === 0
                          ? 'Cuadrado'
                          : diferencia > 0
                          ? `Sobra $${diferencia.toLocaleString()}`
                          : `Falta $${Math.abs(diferencia).toLocaleString()}`}
                      </span>
                      <span className="text-muted text-xs">
                        {expandido === t.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {expandido === t.id && (
                    <div className="border-t border-line p-3 text-sm space-y-1">
                      {editandoId === t.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-muted mb-1">Base inicial</label>
                            <input
                              type="number"
                              value={valoresEdicion.montoInicial}
                              onChange={(e) =>
                                setValoresEdicion({ ...valoresEdicion, montoInicial: e.target.value })
                              }
                              className="w-40 border border-line rounded-lg px-2 py-1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              Efectivo contado al cierre
                            </label>
                            <input
                              type="number"
                              value={valoresEdicion.montoFinalEfectivo}
                              onChange={(e) =>
                                setValoresEdicion({
                                  ...valoresEdicion,
                                  montoFinalEfectivo: e.target.value,
                                })
                              }
                              className="w-40 border border-line rounded-lg px-2 py-1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              Gastos (jornal)
                            </label>
                            <input
                              type="number"
                              value={valoresEdicion.totalGastos}
                              onChange={(e) =>
                                setValoresEdicion({ ...valoresEdicion, totalGastos: e.target.value })
                              }
                              className="w-40 border border-line rounded-lg px-2 py-1"
                            />
                          </div>
                          <p className="text-xs text-amber-400">
                            Las ventas por método de pago no se pueden editar aquí (vienen de las
                            facturas reales). Solo se corrige base, efectivo contado y jornal.
                          </p>
                          <div className="flex gap-3 pt-1">
                            <button
                              onClick={() => guardarEdicion(t)}
                              disabled={procesando}
                              className="text-emerald-400 text-sm font-medium hover:underline disabled:opacity-50"
                            >
                              {procesando ? 'Guardando...' : 'Guardar corrección'}
                            </button>
                            <button
                              onClick={cancelarEdicion}
                              className="text-muted text-sm hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p>Base inicial: ${Number(t.montoInicial).toLocaleString()}</p>
                          {t.edicionesBase?.length > 0 && (
                            <p className="text-amber-400 text-xs">
                              (base editada {t.edicionesBase.length} vez/veces antes del cierre)
                            </p>
                          )}
                          <p>Ventas en efectivo: ${Number(t.totalVentasEfectivo || 0).toLocaleString()}</p>
                          <p>Ventas en tarjeta: ${Number(t.totalVentasTarjeta || 0).toLocaleString()}</p>
                          <p>
                            Ventas en transferencia: $
                            {Number(t.totalVentasTransferencia || 0).toLocaleString()}
                          </p>
                          {t.totalVentasSistecredito > 0 && (
                            <p>Ventas Sistecrédito: ${Number(t.totalVentasSistecredito).toLocaleString()}</p>
                          )}
                          {t.totalVentasAddi > 0 && (
                            <p>Ventas Addi: ${Number(t.totalVentasAddi).toLocaleString()}</p>
                          )}
                          {t.totalGastos > 0 && (
                            <p>Gastos (jornal): ${Number(t.totalGastos).toLocaleString()}</p>
                          )}
                          <p>Efectivo contado al cierre: ${Number(t.montoFinalEfectivo || 0).toLocaleString()}</p>
                          <p className="font-semibold pt-1 border-t border-line mt-1">
                            Diferencia:{' '}
                            <span
                              className={
                                diferencia === 0
                                  ? 'text-emerald-400'
                                  : diferencia > 0
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }
                            >
                              ${diferencia.toLocaleString()}
                            </span>
                          </p>

                          {t.edicionesCierre?.length > 0 && (
                            <p className="text-amber-400 text-xs pt-1">
                              Este cierre fue corregido {t.edicionesCierre.length} vez/veces
                              después de cerrado.
                            </p>
                          )}

                          {esAdmin && (
                            <button
                              onClick={() => empezarEdicion(t)}
                              className="text-brand-light text-xs font-medium hover:underline pt-1"
                            >
                              Corregir este cierre
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {turnos.length === 0 && (
              <p className="text-muted">No hay turnos cerrados en este rango de fechas.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
