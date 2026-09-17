import { useState } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Fecha local del navegador, no UTC (toISOString desplaza el día en
// zonas horarias como Colombia, UTC-5).
function fechaLocalISO(d) {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function hoyISO() {
  return fechaLocalISO(new Date())
}

function formatearFechaISO(claveISO) {
  const [anio, mes, dia] = claveISO.split('-')
  return new Date(Number(anio), Number(mes) - 1, Number(dia)).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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

      const qVentas = query(
        collection(db, 'ventas'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta)
      )
      const snapVentas = await getDocs(qVentas)
      const ventas = snapVentas.docs.map((d) => d.data()).filter((v) => v.anulada !== true)

      const qCompras = query(
        collection(db, 'compras'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta)
      )
      const snapCompras = await getDocs(qCompras)
      const compras = snapCompras.docs.map((d) => d.data()).filter((c) => c.anulada !== true)

      // Catálogo actual, para conocer el costo promedio de hoy de cada producto
      const snapProductos = await getDocs(collection(db, 'productos'))
      const costoPorCodigo = {}
      snapProductos.docs.forEach((d) => {
        costoPorCodigo[d.id] = Number(d.data().costoPromedio) || 0
      })

      let totalVentas = 0
      let totalCompras = 0
      let gananciaEstimada = 0
      // Un solo acumulado por producto, sumando TODOS los días del rango juntos
      // (no se separa por día).
      const conteoPorProducto = {}

      for (const venta of ventas) {
        totalVentas += Number(venta.total) || 0

        for (const item of venta.items || []) {
          const cantidad = Number(item.cantidad) || 0
          const precioUnitario = Number(item.precioUnitario) || 0
          const costoUnitario = costoPorCodigo[item.codigo] ?? 0
          const valorVendido = cantidad * precioUnitario
          const valorCosto = cantidad * costoUnitario
          const gananciaItem = valorVendido - valorCosto

          gananciaEstimada += gananciaItem

          if (!conteoPorProducto[item.codigo]) {
            conteoPorProducto[item.codigo] = {
              nombre: item.nombre,
              cantidad: 0,
              valorVendido: 0,
              valorCosto: 0,
              ganancia: 0,
            }
          }
          conteoPorProducto[item.codigo].cantidad += cantidad
          conteoPorProducto[item.codigo].valorVendido += valorVendido
          conteoPorProducto[item.codigo].valorCosto += valorCosto
          conteoPorProducto[item.codigo].ganancia += gananciaItem
        }
      }

      for (const compra of compras) {
        totalCompras += Number(compra.total) || 0
      }

      const productos = Object.entries(conteoPorProducto)
        .map(([codigo, datos]) => ({ codigo, ...datos }))
        .sort((a, b) => b.cantidad - a.cantidad)

      setResultado({
        cantidadVentas: ventas.length,
        cantidadCompras: compras.length,
        totalVentas,
        totalCompras,
        gananciaEstimada,
        productos,
      })
    } catch (err) {
      setError('Error al generar el reporte: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  const esUnSoloDia = desde === hasta

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Reportes</h1>

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
          onClick={generarReporte}
          disabled={cargando}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
        >
          {cargando ? 'Calculando...' : 'Generar reporte'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 rounded p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {resultado && (
        <>
          <h2 className="text-lg font-semibold mb-2">
            {esUnSoloDia
              ? `Resumen del ${formatearFechaISO(desde)}`
              : `Resumen total del ${formatearFechaISO(desde)} al ${formatearFechaISO(hasta)}`}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="bg-card border border-line rounded p-4">
              <p className="text-muted text-sm">Ventas</p>
              <p className="text-xl font-bold">${resultado.totalVentas.toLocaleString()}</p>
              <p className="text-xs text-muted">{resultado.cantidadVentas} facturas</p>
            </div>
            <div className="bg-card border border-line rounded p-4">
              <p className="text-muted text-sm">Compras</p>
              <p className="text-xl font-bold">${resultado.totalCompras.toLocaleString()}</p>
              <p className="text-xs text-muted">{resultado.cantidadCompras} facturas</p>
            </div>
            <div className="bg-card border border-line rounded p-4 col-span-2 md:col-span-2">
              <p className="text-muted text-sm">Ganancia estimada</p>
              <p className="text-xl font-bold text-emerald-400">
                ${resultado.gananciaEstimada.toLocaleString()}
              </p>
              <p className="text-xs text-muted">
                Calculada con el costo promedio actual de cada producto (aproximado)
              </p>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-1">
            Artículos vendidos {esUnSoloDia ? 'ese día' : 'en todo el rango'}
          </h2>
          <p className="text-muted text-sm mb-3">
            {resultado.productos.length} producto(s) distinto(s) vendidos.
          </p>

          {resultado.productos.length === 0 ? (
            <p className="text-muted text-sm">No hay ventas en este rango de fechas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-line bg-card">
                <thead className="bg-panel">
                  <tr>
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-right">Unidades</th>
                    <th className="p-2 text-right">Valor a costo</th>
                    <th className="p-2 text-right">Valor vendido</th>
                    <th className="p-2 text-right">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.productos.map((p) => (
                    <tr key={p.codigo} className="border-t border-line">
                      <td className="p-2">{p.nombre}</td>
                      <td className="p-2 text-right">{p.cantidad}</td>
                      <td className="p-2 text-right text-muted">
                        ${p.valorCosto.toLocaleString()}
                      </td>
                      <td className="p-2 text-right">${p.valorVendido.toLocaleString()}</td>
                      <td className="p-2 text-right text-emerald-400 font-medium">
                        ${p.ganancia.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-panel font-semibold">
                    <td className="p-2">Total</td>
                    <td className="p-2 text-right">
                      {resultado.productos.reduce((a, p) => a + p.cantidad, 0)}
                    </td>
                    <td className="p-2 text-right">
                      ${resultado.productos.reduce((a, p) => a + p.valorCosto, 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-right">${resultado.totalVentas.toLocaleString()}</td>
                    <td className="p-2 text-right text-emerald-400">
                      ${resultado.gananciaEstimada.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
