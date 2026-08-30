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

function haceUnMesISO() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return fechaLocalISO(d)
}

function formatearFecha(fecha) {
  if (!fecha) return '—'
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO')
}

export default function VentasCredito() {
  const [desde, setDesde] = useState(haceUnMesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [filas, setFilas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function buscar() {
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
      const ventas = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((v) => v.anulada !== true)

      const resultado = []
      for (const venta of ventas) {
        for (const pago of venta.pagos || []) {
          if (pago.metodo === 'addi' || pago.metodo === 'sistecredito') {
            resultado.push({
              ventaId: venta.id,
              fecha: venta.fecha,
              metodo: pago.metodo,
              monto: pago.monto,
              totalVenta: venta.total,
            })
          }
        }
      }

      setFilas(resultado)
    } catch (err) {
      setError('Error al buscar: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  const totalAddi = (filas || [])
    .filter((f) => f.metodo === 'addi')
    .reduce((acc, f) => acc + f.monto, 0)
  const totalSistecredito = (filas || [])
    .filter((f) => f.metodo === 'sistecredito')
    .reduce((acc, f) => acc + f.monto, 0)

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Ventas con Addi / Sistecrédito</h1>

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

      {filas && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-card border border-line rounded-xl p-4">
              <p className="text-muted text-sm">Total Addi</p>
              <p className="text-xl font-bold">${totalAddi.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-line rounded-xl p-4">
              <p className="text-muted text-sm">Total Sistecrédito</p>
              <p className="text-xl font-bold">${totalSistecredito.toLocaleString()}</p>
            </div>
          </div>

          <table className="w-full text-sm border border-line bg-card">
            <thead className="bg-panel">
              <tr>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Método</th>
                <th className="p-2 text-right">Monto pagado</th>
                <th className="p-2 text-right">Total de la venta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{formatearFecha(f.fecha)}</td>
                  <td className="p-2 capitalize">{f.metodo}</td>
                  <td className="p-2 text-right">${f.monto.toLocaleString()}</td>
                  <td className="p-2 text-right text-muted">
                    ${Number(f.totalVenta).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filas.length === 0 && (
            <p className="text-muted mt-4">
              No hay ventas con Addi o Sistecrédito en este rango de fechas.
            </p>
          )}
        </>
      )}
    </div>
  )
}
