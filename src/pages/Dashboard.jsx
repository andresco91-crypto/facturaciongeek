import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductosCtx } from '../hooks/useProductosContext'
import { useTurno } from '../hooks/useTurno'

const DIAS_HISTORIAL = 30
const DIAS_ALERTA = 3 // si te quedan menos de 3 días de cobertura, es urgente

function inicioDeHoy() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function Dashboard() {
  const { productos } = useProductosCtx()
  const { turno } = useTurno()
  const [cargando, setCargando] = useState(true)
  const [ventasHoy, setVentasHoy] = useState({ cantidad: 0, total: 0 })
  const [alertas, setAlertas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos.length])

  async function cargarDatos() {
    if (productos.length === 0) return
    setCargando(true)
    setError('')
    try {
      const desde = new Date()
      desde.setDate(desde.getDate() - DIAS_HISTORIAL)
      const fechaDesde = Timestamp.fromDate(desde)

      // Una sola consulta cubre los últimos 30 días; de ahí calculamos
      // tanto las ventas de hoy como la velocidad de venta de cada producto.
      const q = query(collection(db, 'ventas'), where('fecha', '>=', fechaDesde))
      const snapshot = await getDocs(q)
      const ventas = snapshot.docs
        .map((d) => d.data())
        .filter((v) => v.anulada !== true)

      const hoy = inicioDeHoy()
      let cantidadHoy = 0
      let totalHoy = 0
      const vendidoPorCodigo = {}

      for (const venta of ventas) {
        const fechaVenta = venta.fecha?.toDate ? venta.fecha.toDate() : new Date(venta.fecha)

        if (fechaVenta >= hoy) {
          cantidadHoy += 1
          totalHoy += Number(venta.total) || 0
        }

        for (const item of venta.items || []) {
          vendidoPorCodigo[item.codigo] =
            (vendidoPorCodigo[item.codigo] || 0) + (Number(item.cantidad) || 0)
        }
      }

      setVentasHoy({ cantidad: cantidadHoy, total: totalHoy })

      const filasAlerta = productos
        .map((p) => {
          const vendido30 = vendidoPorCodigo[p.codigo] || 0
          const promedioDiario = vendido30 / DIAS_HISTORIAL
          const stock = Number(p.stock) || 0
          const diasCobertura = promedioDiario > 0 ? stock / promedioDiario : null

          return { ...p, vendido30, promedioDiario, diasCobertura }
        })
        .filter((p) => p.promedioDiario > 0 && (p.diasCobertura === null || p.diasCobertura <= DIAS_ALERTA))
        .sort((a, b) => b.vendido30 - a.vendido30)
        .slice(0, 8)

      setAlertas(filasAlerta)
    } catch (err) {
      setError('Error al calcular el panel: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Panel de inicio</h1>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-line rounded-xl p-5">
          <p className="text-muted text-sm mb-1">Ventas de hoy</p>
          <p className="text-3xl font-display font-bold">
            ${ventasHoy.total.toLocaleString()}
          </p>
          <p className="text-muted text-sm mt-1">{ventasHoy.cantidad} factura(s)</p>
        </div>

        <div className="bg-card border border-line rounded-xl p-5">
          <p className="text-muted text-sm mb-1">Turno de caja</p>
          {turno ? (
            <>
              <p className="text-xl font-display font-bold text-emerald-400">Abierto</p>
              <p className="text-muted text-sm mt-1">
                Base: ${Number(turno.montoInicial).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-xl font-display font-bold text-amber-400">Sin turno abierto</p>
          )}
        </div>
      </div>

      <h2 className="text-lg font-display font-semibold mb-1">
        Stock bajo en productos que más se venden
      </h2>
      <p className="text-muted text-sm mb-4">
        Calculado con las ventas de los últimos {DIAS_HISTORIAL} días. Solo se muestran
        productos con menos de {DIAS_ALERTA} días de cobertura estimada.
      </p>

      {cargando ? (
        <p className="text-muted">Calculando...</p>
      ) : alertas.length === 0 ? (
        <p className="text-emerald-400 text-sm">
          No hay productos de alta rotación con stock crítico ahora mismo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-line bg-card">
            <thead className="bg-panel">
              <tr>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-right">Vendido (30d)</th>
                <th className="p-2 text-right">Stock actual</th>
                <th className="p-2 text-right">Días de cobertura</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((p) => (
                <tr key={p.codigo} className="border-t border-line">
                  <td className="p-2">{p.nombre}</td>
                  <td className="p-2 text-right text-muted">{p.vendido30}</td>
                  <td className="p-2 text-right">
                    <span className={p.stock <= 0 ? 'text-red-400 font-semibold' : ''}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="p-2 text-right text-amber-400 font-medium">
                    {p.diasCobertura === null ? '—' : p.diasCobertura.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
