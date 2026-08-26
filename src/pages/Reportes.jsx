import { useState } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Reportes() {
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  async function generarReporte() {
    setCargando(true)
    setError('')
    setResultado(null)

    try {
      const fechaDesde = Timestamp.fromDate(new Date(desde + 'T00:00:00'))
      const fechaHasta = Timestamp.fromDate(new Date(hasta + 'T23:59:59'))

      // Ventas en el rango
      const qVentas = query(
        collection(db, 'ventas'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta)
      )
      const snapVentas = await getDocs(qVentas)
      const ventas = snapVentas.docs.map((d) => d.data())

      // Compras en el rango
      const qCompras = query(
        collection(db, 'compras'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta)
      )
      const snapCompras = await getDocs(qCompras)
      const compras = snapCompras.docs.map((d) => d.data())

      // Traemos el catálogo actual de productos para conocer el costo promedio de hoy
      const snapProductos = await getDocs(collection(db, 'productos'))
      const costoPorCodigo = {}
      snapProductos.docs.forEach((d) => {
        costoPorCodigo[d.id] = Number(d.data().costoPromedio) || 0
      })

      let totalVentas = 0
      let totalCompras = 0
      let gananciaEstimada = 0
      const conteoPorProducto = {} // codigo -> { nombre, cantidad, totalVendido }

      for (const venta of ventas) {
        totalVentas += Number(venta.total) || 0
        for (const item of venta.items || []) {
          const cantidad = Number(item.cantidad) || 0
          const precioUnitario = Number(item.precioUnitario) || 0
          const costoUnitario = costoPorCodigo[item.codigo] ?? 0

          gananciaEstimada += (precioUnitario - costoUnitario) * cantidad

          if (!conteoPorProducto[item.codigo]) {
            conteoPorProducto[item.codigo] = {
              nombre: item.nombre,
              cantidad: 0,
              totalVendido: 0,
            }
          }
          conteoPorProducto[item.codigo].cantidad += cantidad
          conteoPorProducto[item.codigo].totalVendido += cantidad * precioUnitario
        }
      }

      for (const compra of compras) {
        totalCompras += Number(compra.total) || 0
      }

      const topProductos = Object.entries(conteoPorProducto)
        .map(([codigo, datos]) => ({ codigo, ...datos }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10)

      setResultado({
        cantidadVentas: ventas.length,
        cantidadCompras: compras.length,
        totalVentas,
        totalCompras,
        gananciaEstimada,
        topProductos,
      })
    } catch (err) {
      setError('Error al generar el reporte: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Reportes</h1>

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
          onClick={generarReporte}
          disabled={cargando}
          className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {cargando ? 'Calculando...' : 'Generar reporte'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {resultado && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded p-4">
              <p className="text-gray-500 text-sm">Ventas</p>
              <p className="text-xl font-bold">${resultado.totalVentas.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{resultado.cantidadVentas} facturas</p>
            </div>
            <div className="bg-white border border-gray-200 rounded p-4">
              <p className="text-gray-500 text-sm">Compras</p>
              <p className="text-xl font-bold">${resultado.totalCompras.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{resultado.cantidadCompras} facturas</p>
            </div>
            <div className="bg-white border border-gray-200 rounded p-4 col-span-2 md:col-span-2">
              <p className="text-gray-500 text-sm">Ganancia estimada</p>
              <p className="text-xl font-bold text-green-700">
                ${resultado.gananciaEstimada.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">
                Calculada con el costo promedio actual de cada producto (aproximado)
              </p>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-2">Productos más vendidos</h2>
          {resultado.topProductos.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay ventas en este rango de fechas.</p>
          ) : (
            <table className="w-full text-sm border border-gray-200 bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-right">Unidades vendidas</th>
                  <th className="p-2 text-right">Total vendido</th>
                </tr>
              </thead>
              <tbody>
                {resultado.topProductos.map((p, idx) => (
                  <tr key={p.codigo} className="border-t">
                    <td className="p-2 text-gray-400">{idx + 1}</td>
                    <td className="p-2">{p.nombre}</td>
                    <td className="p-2 text-right">{p.cantidad}</td>
                    <td className="p-2 text-right">${p.totalVendido.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
