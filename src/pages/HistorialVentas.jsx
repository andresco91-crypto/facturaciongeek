import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useTurno } from '../hooks/useTurno'
import { useDevoluciones } from '../hooks/useDevoluciones'

function hoyISO() {
  // Fecha local del navegador, no UTC (toISOString desplaza el día en
  // zonas horarias como Colombia, UTC-5).
  const d = new Date()
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function formatearFecha(fecha) {
  if (!fecha) return '—'
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO')
}

export default function HistorialVentas() {
  const { turno, obtenerVentasDelTurno } = useTurno()
  const { obtenerDevolucionesDelTurno } = useDevoluciones()
  const [efectivoDisponible, setEfectivoDisponible] = useState(null)
  const [cargandoEfectivo, setCargandoEfectivo] = useState(false)

  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [ventas, setVentas] = useState([])
  const [expandida, setExpandida] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [anulando, setAnulando] = useState(null)
  const [error, setError] = useState('')
  const [buscado, setBuscado] = useState(false)

  useEffect(() => {
    if (turno) {
      calcularEfectivoDisponible()
    } else {
      setEfectivoDisponible(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno?.id])

  async function calcularEfectivoDisponible() {
    setCargandoEfectivo(true)
    try {
      const [ventasTurno, devoluciones] = await Promise.all([
        obtenerVentasDelTurno(turno.id),
        obtenerDevolucionesDelTurno(turno.id),
      ])

      let efectivoVentas = 0
      for (const v of ventasTurno) {
        for (const pago of v.pagos || []) {
          if (pago.metodo === 'efectivo') efectivoVentas += pago.monto
        }
      }

      let efectivoDevoluciones = 0
      for (const dev of devoluciones) {
        if (dev.metodoDiferencia === 'efectivo' && dev.diferencia) {
          efectivoDevoluciones += dev.diferencia
        }
      }

      const total = Number(turno.montoInicial) + efectivoVentas + efectivoDevoluciones
      setEfectivoDisponible(total)
    } finally {
      setCargandoEfectivo(false)
    }
  }

  async function buscarVentas() {
    setCargando(true)
    setError('')
    try {
      const fechaDesde = Timestamp.fromDate(new Date(desde + 'T00:00:00'))
      const fechaHasta = Timestamp.fromDate(new Date(hasta + 'T23:59:59'))

      const q = query(
        collection(db, 'ventas'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta),
        orderBy('fecha', 'desc')
      )
      const snapshot = await getDocs(q)
      setVentas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setBuscado(true)
    } catch (err) {
      setError('Error al buscar ventas: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function toggleExpandir(id) {
    setExpandida(expandida === id ? null : id)
  }

  async function anularVenta(venta) {
    const confirmado = confirm(
      `¿Anular esta venta por $${Number(venta.total).toLocaleString()} del ${formatearFecha(
        venta.fecha
      )}?\n\nEsto devolverá el stock de los productos vendidos. Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setAnulando(venta.id)
    setError('')
    try {
      const batch = writeBatch(db)

      // Devuelve el stock de cada producto vendido
      for (const item of venta.items || []) {
        const productoRef = doc(db, 'productos', item.codigo)
        batch.update(productoRef, {
          stock: increment(Number(item.cantidad) || 0),
        })
      }

      const ventaRef = doc(db, 'ventas', venta.id)
      batch.update(ventaRef, {
        anulada: true,
        fechaAnulacion: serverTimestamp(),
      })

      await batch.commit()

      setVentas((prev) =>
        prev.map((v) => (v.id === venta.id ? { ...v, anulada: true } : v))
      )

      if (turno && venta.turnoId === turno.id) {
        calcularEfectivoDisponible()
      }
    } catch (err) {
      setError('Error al anular la venta: ' + err.message)
    } finally {
      setAnulando(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Historial de ventas</h1>

      {turno && (
        <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-emerald-400 text-sm font-medium">Efectivo disponible en caja</p>
            <p className="text-xs text-muted">Base + ventas en efectivo del turno actual</p>
          </div>
          <p className="text-2xl font-display font-bold text-emerald-400">
            {cargandoEfectivo || efectivoDisponible === null
              ? '...'
              : `$${efectivoDisponible.toLocaleString()}`}
          </p>
        </div>
      )}

      {!turno && (
        <div className="bg-amber-950/40 border border-amber-800 text-amber-300 rounded-xl p-3 mb-6 text-sm">
          No hay un turno de caja abierto ahora mismo.
        </div>
      )}

      <div className="bg-card border border-line rounded p-4 mb-6 flex flex-wrap gap-4 items-end">
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
          onClick={buscarVentas}
          disabled={cargando}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar ventas'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 rounded p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {buscado && (
        <>
          <p className="text-sm text-muted mb-2">
            {ventas.length} venta(s) encontrada(s)
          </p>

          {(() => {
            const totalEfectivo = ventas
              .filter((v) => v.anulada !== true)
              .reduce((acc, v) => {
                const efectivoVenta = (v.pagos || [])
                  .filter((p) => p.metodo === 'efectivo')
                  .reduce((a, p) => a + (Number(p.monto) || 0), 0)
                return acc + efectivoVenta
              }, 0)

            return (
              <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4 mb-4">
                <p className="text-amber-300 font-medium text-sm mb-1">
                  💰 Efectivo esperado en caja (solo por estas ventas)
                </p>
                <p className="text-2xl font-display font-bold text-amber-200">
                  ${totalEfectivo.toLocaleString()}
                </p>
                <p className="text-amber-300/80 text-xs mt-1">
                  Compara este valor con el dinero físico que hay en caja antes de cerrar el
                  turno. No incluye tarjeta, transferencia, Addi ni Sistecrédito.
                </p>
              </div>
            )
          })()}

          <div className="space-y-2">
            {ventas.map((venta) => (
              <div
                key={venta.id}
                className={`bg-card border rounded ${
                  venta.anulada ? 'border-red-900 opacity-60' : 'border-line'
                }`}
              >
                <button
                  onClick={() => toggleExpandir(venta.id)}
                  className="w-full text-left p-3 flex justify-between items-center hover:bg-panel"
                >
                  <div>
                    <span className="font-medium">{formatearFecha(venta.fecha)}</span>
                    {venta.numeroFactura && (
                      <span className="text-brand-light ml-2 text-sm font-mono">
                        {venta.numeroFactura}
                      </span>
                    )}
                    <span className="text-muted ml-2 text-sm">
                      {venta.items?.length || 0} producto(s)
                    </span>
                    {venta.anulada && (
                      <span className="ml-2 text-xs bg-red-950/60 text-red-300 px-2 py-0.5 rounded">
                        ANULADA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ${Number(venta.total || 0).toLocaleString()}
                    </span>
                    <span className="text-muted text-xs">
                      {expandida === venta.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {expandida === venta.id && (
                  <div className="border-t p-3 text-sm">
                    <table className="w-full mb-3">
                      <thead>
                        <tr className="text-muted">
                          <th className="text-left font-normal">Producto</th>
                          <th className="text-right font-normal">Cant.</th>
                          <th className="text-right font-normal">Unitario</th>
                          <th className="text-right font-normal">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venta.items?.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="py-1">
                              {item.nombre}{' '}
                              <span className="text-muted text-xs">
                                ({item.tipoPrecio === 'mayorista' ? 'mayorista' : 'público'})
                              </span>
                            </td>
                            <td className="py-1 text-right">{item.cantidad}</td>
                            <td className="py-1 text-right">
                              ${Number(item.precioUnitario).toLocaleString()}
                            </td>
                            <td className="py-1 text-right">
                              ${(item.cantidad * item.precioUnitario).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <p className="text-slate-300 mb-3">
                      <span className="font-medium">Pago:</span>{' '}
                      {venta.pagos?.map((p, idx) => (
                        <span key={idx}>
                          {idx > 0 && ' + '}
                          {p.metodo} (${Number(p.monto).toLocaleString()})
                        </span>
                      ))}
                    </p>

                    {venta.anulada ? (
                      <p className="text-red-400 text-xs font-medium">
                        Esta venta fue anulada el {formatearFecha(venta.fechaAnulacion)}.
                        El stock ya fue devuelto.
                      </p>
                    ) : (
                      <button
                        onClick={() => anularVenta(venta)}
                        disabled={anulando === venta.id}
                        className="text-red-400 text-xs font-medium hover:underline disabled:opacity-50"
                      >
                        {anulando === venta.id ? 'Anulando...' : 'Anular esta factura'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {ventas.length === 0 && (
              <p className="text-muted">No hay ventas en este rango de fechas.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
