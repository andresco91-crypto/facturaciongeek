import { useState } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const DIAS_HISTORIAL = 30
const DIAS_COBERTURA = 15

export default function SugerenciaCompra() {
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [soloConSugerencia, setSoloConSugerencia] = useState(true)
  const [error, setError] = useState('')

  async function calcular() {
    setCargando(true)
    setError('')
    setResultado(null)

    try {
      const desde = new Date()
      desde.setDate(desde.getDate() - DIAS_HISTORIAL)
      const fechaDesde = Timestamp.fromDate(desde)

      const qVentas = query(collection(db, 'ventas'), where('fecha', '>=', fechaDesde))
      const snapVentas = await getDocs(qVentas)
      const ventas = snapVentas.docs.map((d) => d.data()).filter((v) => v.anulada !== true)

      const vendidoPorCodigo = {} // codigo -> { nombre, cantidad }
      for (const venta of ventas) {
        for (const item of venta.items || []) {
          if (!vendidoPorCodigo[item.codigo]) {
            vendidoPorCodigo[item.codigo] = { nombre: item.nombre, cantidad: 0 }
          }
          vendidoPorCodigo[item.codigo].cantidad += Number(item.cantidad) || 0
        }
      }

      const snapProductos = await getDocs(collection(db, 'productos'))
      const productos = snapProductos.docs.map((d) => ({ codigo: d.id, ...d.data() }))

      const filas = productos.map((p) => {
        const vendido = vendidoPorCodigo[p.codigo]?.cantidad || 0
        const promedioDiario = vendido / DIAS_HISTORIAL
        const stockObjetivo = Math.ceil(promedioDiario * DIAS_COBERTURA)
        const stockActual = Number(p.stock) || 0
        const sugerido = Math.max(0, stockObjetivo - stockActual)

        return {
          codigo: p.codigo,
          nombre: p.nombre,
          vendido30: vendido,
          promedioDiario,
          stockActual,
          stockObjetivo,
          sugerido,
        }
      })

      filas.sort((a, b) => b.sugerido - a.sugerido)

      setResultado(filas)
    } catch (err) {
      setError('Error al calcular: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  const filasVisibles = resultado
    ? soloConSugerencia
      ? resultado.filter((f) => f.sugerido > 0)
      : resultado
    : []

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Sugerencia de compra</h1>
      <p className="text-muted text-sm mb-6">
        Calculado con las ventas de los últimos {DIAS_HISTORIAL} días, sugiriendo cuánto
        comprar para cubrir los próximos {DIAS_COBERTURA} días sin quedarte sin stock.
      </p>

      <button
        onClick={calcular}
        disabled={cargando}
        className="bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-dark font-medium disabled:opacity-50 mb-6"
      >
        {cargando ? 'Calculando...' : 'Calcular sugerencia'}
      </button>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {resultado && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-300">
              {filasVisibles.length} producto(s){' '}
              {soloConSugerencia ? 'necesitan reposición' : 'en el catálogo'}
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={soloConSugerencia}
                onChange={(e) => setSoloConSugerencia(e.target.checked)}
              />
              Mostrar solo lo que necesito comprar
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-line bg-card">
              <thead className="bg-panel">
                <tr>
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-right">Vendido (30d)</th>
                  <th className="p-2 text-right">Promedio diario</th>
                  <th className="p-2 text-right">Stock actual</th>
                  <th className="p-2 text-right">Stock objetivo (15d)</th>
                  <th className="p-2 text-right">Comprar</th>
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((f) => (
                  <tr key={f.codigo} className="border-t">
                    <td className="p-2">{f.nombre}</td>
                    <td className="p-2 text-right text-muted">{f.vendido30}</td>
                    <td className="p-2 text-right text-muted">
                      {f.promedioDiario.toFixed(2)}
                    </td>
                    <td className="p-2 text-right">{f.stockActual}</td>
                    <td className="p-2 text-right text-muted">{f.stockObjetivo}</td>
                    <td className="p-2 text-right">
                      {f.sugerido > 0 ? (
                        <span className="text-amber-400 font-semibold">{f.sugerido}</span>
                      ) : (
                        <span className="text-emerald-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filasVisibles.length === 0 && (
              <p className="text-muted mt-4">
                No hay productos que necesiten reposición según este cálculo.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
