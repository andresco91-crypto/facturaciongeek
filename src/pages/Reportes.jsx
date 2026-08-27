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

function claveDia(fecha) {
  const d = fecha?.toDate ? fecha.toDate() : new Date(fecha)
  return d.toISOString().slice(0, 10)
}

function formatearDia(claveISO) {
  const [anio, mes, dia] = claveISO.split('-')
  return new Date(Number(anio), Number(mes) - 1, Number(dia)).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

export default function Reportes() {
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [diaExpandido, setDiaExpandido] = useState(null)
  const [error, setError] = useState('')

  async function generarReporte() {
    setCargando(true)
    setError('')
    setResultado(null)
    setDiaExpandido(null)

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
      const porDia = {} // 'YYYY-MM-DD' -> { cantidadVentas, totalVendido, ganancia, productos: {codigo: {...}} }

      for (const venta of ventas) {
        const total = Number(venta.total) || 0
        totalVentas += total

        const dia = claveDia(venta.fecha)
        if (!porDia[dia]) {
          porDia[dia] = { cantidadVentas: 0, totalVendido: 0, ganancia: 0, productos: {} }
        }
        porDia[dia].cantidadVentas += 1
        porDia[dia].totalVendido += total

        for (const item of venta.items || []) {
          const cantidad = Number(item.cantidad) || 0
          const precioUnitario = Number(item.precioUnitario) || 0
          const costoUnitario = costoPorCodigo[item.codigo] ?? 0
          const valorVendido = cantidad * precioUnitario
          const gananciaItem = (precioUnitario - costoUnitario) * cantidad

          gananciaEstimada += gananciaItem
          porDia[dia].ganancia += gananciaItem

          if (!porDia[dia].productos[item.codigo]) {
            porDia[dia].productos[item.codigo] = {
              nombre: item.nombre,
              cantidad: 0,
              valorVendido: 0,
              ganancia: 0,
            }
          }
          porDia[dia].productos[item.codigo].cantidad += cantidad
          porDia[dia].productos[item.codigo].valorVendido += valorVendido
          porDia[dia].productos[item.codigo].ganancia += gananciaItem
        }
      }

      for (const compra of compras) {
        totalCompras += Number(compra.total) || 0
      }

      const totalesPorDia = Object.entries(porDia)
        .map(([dia, datos]) => ({
          dia,
          cantidadVentas: datos.cantidadVentas,
          totalVendido: datos.totalVendido,
          ganancia: datos.ganancia,
          productos: Object.entries(datos.productos)
            .map(([codigo, p]) => ({ codigo, ...p }))
            .sort((a, b) => b.cantidad - a.cantidad),
        }))
        .sort((a, b) => (a.dia < b.dia ? 1 : -1)) // más reciente primero

      setResultado({
        cantidadVentas: ventas.length,
        cantidadCompras: compras.length,
        totalVentas,
        totalCompras,
        gananciaEstimada,
        totalesPorDia,
      })
    } catch (err) {
      setError('Error al generar el reporte: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function toggleDia(dia) {
    setDiaExpandido(diaExpandido === dia ? null : dia)
  }

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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

          <h2 className="text-lg font-semibold mb-1">Totalidad de lo vendido por día</h2>
          <p className="text-muted text-sm mb-3">
            Haz clic en un día para ver qué productos se vendieron.
          </p>

          {resultado.totalesPorDia.length === 0 ? (
            <p className="text-muted text-sm">No hay ventas en este rango de fechas.</p>
          ) : (
            <div className="space-y-2">
              {resultado.totalesPorDia.map((f) => (
                <div key={f.dia} className="bg-card border border-line rounded overflow-hidden">
                  <button
                    onClick={() => toggleDia(f.dia)}
                    className="w-full text-left p-3 flex justify-between items-center hover:bg-panel"
                  >
                    <div>
                      <span className="font-medium capitalize">{formatearDia(f.dia)}</span>
                      <span className="text-muted ml-2 text-sm">
                        {f.cantidadVentas} factura(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-400 text-sm">
                        +${f.ganancia.toLocaleString()}
                      </span>
                      <span className="font-semibold">${f.totalVendido.toLocaleString()}</span>
                      <span className="text-muted text-xs">
                        {diaExpandido === f.dia ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {diaExpandido === f.dia && (
                    <div className="border-t border-line p-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted">
                            <th className="text-left font-normal">Producto</th>
                            <th className="text-right font-normal">Unidades</th>
                            <th className="text-right font-normal">Total vendido</th>
                            <th className="text-right font-normal">Ganancia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.productos.map((p) => (
                            <tr key={p.codigo} className="border-t border-line">
                              <td className="py-1">{p.nombre}</td>
                              <td className="py-1 text-right">{p.cantidad}</td>
                              <td className="py-1 text-right">
                                ${p.valorVendido.toLocaleString()}
                              </td>
                              <td className="py-1 text-right text-emerald-400">
                                ${p.ganancia.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              <div className="bg-panel border border-line rounded p-3 flex justify-between font-semibold text-sm">
                <span>Total del rango</span>
                <span>
                  ${resultado.totalVentas.toLocaleString()} · ganancia $
                  {resultado.gananciaEstimada.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
