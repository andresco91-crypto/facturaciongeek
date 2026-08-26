import { useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
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

export default function HistorialCompras() {
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [compras, setCompras] = useState([])
  const [expandida, setExpandida] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [buscado, setBuscado] = useState(false)

  async function buscarCompras() {
    setCargando(true)
    setError('')
    try {
      const fechaDesde = Timestamp.fromDate(new Date(desde + 'T00:00:00'))
      const fechaHasta = Timestamp.fromDate(new Date(hasta + 'T23:59:59'))

      const q = query(
        collection(db, 'compras'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta),
        orderBy('fecha', 'desc')
      )
      const snapshot = await getDocs(q)
      setCompras(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setBuscado(true)
    } catch (err) {
      setError('Error al buscar compras: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function toggleExpandir(id) {
    setExpandida(expandida === id ? null : id)
  }

  const totalGeneral = compras.reduce((acc, c) => acc + Number(c.total || 0), 0)

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Historial de compras</h1>

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
          onClick={buscarCompras}
          disabled={cargando}
          className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar compras'}
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
            {compras.length} compra(s) encontrada(s) — total: $
            {totalGeneral.toLocaleString()}
          </p>

          <div className="space-y-2">
            {compras.map((compra) => (
              <div key={compra.id} className="bg-white border border-gray-200 rounded">
                <button
                  onClick={() => toggleExpandir(compra.id)}
                  className="w-full text-left p-3 flex justify-between items-center hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{formatearFecha(compra.fecha)}</span>
                    <span className="text-gray-400 ml-2 text-sm">
                      {compra.items?.length || 0} producto(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ${Number(compra.total || 0).toLocaleString()}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {expandida === compra.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {expandida === compra.id && (
                  <div className="border-t p-3 text-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left font-normal">Producto</th>
                          <th className="text-right font-normal">Cant.</th>
                          <th className="text-right font-normal">Costo unitario</th>
                          <th className="text-right font-normal">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compra.items?.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="py-1">{item.nombre}</td>
                            <td className="py-1 text-right">{item.cantidad}</td>
                            <td className="py-1 text-right">
                              ${Number(item.costoUnitario).toLocaleString()}
                            </td>
                            <td className="py-1 text-right">
                              ${(item.cantidad * item.costoUnitario).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {compras.length === 0 && (
              <p className="text-gray-400">No hay compras en este rango de fechas.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
