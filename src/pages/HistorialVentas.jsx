import { useState } from 'react'
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

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatearFecha(fecha) {
  if (!fecha) return '—'
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO')
}

export default function HistorialVentas() {
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [ventas, setVentas] = useState([])
  const [expandida, setExpandida] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [anulando, setAnulando] = useState(null)
  const [error, setError] = useState('')
  const [buscado, setBuscado] = useState(false)

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
    } catch (err) {
      setError('Error al anular la venta: ' + err.message)
    } finally {
      setAnulando(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Historial de ventas</h1>

      <div className="bg-white border border-gray-200 rounded p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <button
          onClick={buscarVentas}
          disabled={cargando}
          className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar ventas'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {buscado && (
        <>
          <p className="text-sm text-gray-500 mb-2">
            {ventas.length} venta(s) encontrada(s)
          </p>

          <div className="space-y-2">
            {ventas.map((venta) => (
              <div
                key={venta.id}
                className={`bg-white border rounded ${
                  venta.anulada ? 'border-red-200 opacity-60' : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => toggleExpandir(venta.id)}
                  className="w-full text-left p-3 flex justify-between items-center hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{formatearFecha(venta.fecha)}</span>
                    <span className="text-gray-400 ml-2 text-sm">
                      {venta.items?.length || 0} producto(s)
                    </span>
                    {venta.anulada && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        ANULADA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ${Number(venta.total || 0).toLocaleString()}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {expandida === venta.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {expandida === venta.id && (
                  <div className="border-t p-3 text-sm">
                    <table className="w-full mb-3">
                      <thead>
                        <tr className="text-gray-500">
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
                              <span className="text-gray-400 text-xs">
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

                    <p className="text-gray-600 mb-3">
                      <span className="font-medium">Pago:</span>{' '}
                      {venta.pagos?.map((p, idx) => (
                        <span key={idx}>
                          {idx > 0 && ' + '}
                          {p.metodo} (${Number(p.monto).toLocaleString()})
                        </span>
                      ))}
                    </p>

                    {venta.anulada ? (
                      <p className="text-red-600 text-xs font-medium">
                        Esta venta fue anulada el {formatearFecha(venta.fechaAnulacion)}.
                        El stock ya fue devuelto.
                      </p>
                    ) : (
                      <button
                        onClick={() => anularVenta(venta)}
                        disabled={anulando === venta.id}
                        className="text-red-600 text-xs font-medium hover:underline disabled:opacity-50"
                      >
                        {anulando === venta.id ? 'Anulando...' : 'Anular esta factura'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {ventas.length === 0 && (
              <p className="text-gray-400">No hay ventas en este rango de fechas.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
