import { useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const DIAS_PLAZO_PAGO = 60

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

// Días completos transcurridos entre la fecha de venta y hoy, contando
// por día calendario local (no por horas exactas).
function diasTranscurridos(fechaVenta) {
  const inicioDia = (f) => {
    const d = f.toDate ? f.toDate() : new Date(f)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const hoy = inicioDia(new Date())
  const venta = inicioDia(fechaVenta)
  return Math.round((hoy - venta) / (1000 * 60 * 60 * 24))
}

export default function VentasCredito() {
  const [desde, setDesde] = useState(haceUnMesISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [filas, setFilas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [procesandoId, setProcesandoId] = useState(null)
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
              numeroFactura: venta.numeroFactura || null,
              fecha: venta.fecha,
              metodo: pago.metodo,
              monto: pago.monto,
              totalVenta: venta.total,
              pagado: venta[`${pago.metodo}Pagado`] === true,
              fechaPago: venta[`${pago.metodo}FechaPago`] || null,
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

  async function marcarComoPagado(fila) {
    const idProceso = fila.ventaId + fila.metodo
    setProcesandoId(idProceso)
    try {
      await updateDoc(doc(db, 'ventas', fila.ventaId), {
        [`${fila.metodo}Pagado`]: true,
        [`${fila.metodo}FechaPago`]: serverTimestamp(),
      })
      setFilas((prev) =>
        prev.map((f) =>
          f.ventaId === fila.ventaId && f.metodo === fila.metodo
            ? { ...f, pagado: true, fechaPago: new Date() }
            : f
        )
      )
    } catch (err) {
      setError('Error al marcar como pagado: ' + err.message)
    } finally {
      setProcesandoId(null)
    }
  }

  async function desmarcarPago(fila) {
    const idProceso = fila.ventaId + fila.metodo
    setProcesandoId(idProceso)
    try {
      await updateDoc(doc(db, 'ventas', fila.ventaId), {
        [`${fila.metodo}Pagado`]: false,
        [`${fila.metodo}FechaPago`]: null,
      })
      setFilas((prev) =>
        prev.map((f) =>
          f.ventaId === fila.ventaId && f.metodo === fila.metodo
            ? { ...f, pagado: false, fechaPago: null }
            : f
        )
      )
    } catch (err) {
      setError('Error al desmarcar: ' + err.message)
    } finally {
      setProcesandoId(null)
    }
  }

  const totalAddi = (filas || []).filter((f) => f.metodo === 'addi').reduce((a, f) => a + f.monto, 0)
  const totalSistecredito = (filas || [])
    .filter((f) => f.metodo === 'sistecredito')
    .reduce((a, f) => a + f.monto, 0)

  const pendientes = (filas || []).filter((f) => !f.pagado)
  const totalPendiente = pendientes.reduce((a, f) => a + f.monto, 0)
  const totalCobrado = (filas || []).filter((f) => f.pagado).reduce((a, f) => a + f.monto, 0)
  const vencidasSinConfirmar = pendientes.filter(
    (f) => diasTranscurridos(f.fecha) >= DIAS_PLAZO_PAGO
  )

  return (
    <div className="p-6 max-w-4xl">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-card border border-line rounded-xl p-4">
              <p className="text-muted text-sm">Total Addi</p>
              <p className="text-xl font-bold">${totalAddi.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-line rounded-xl p-4">
              <p className="text-muted text-sm">Total Sistecrédito</p>
              <p className="text-xl font-bold">${totalSistecredito.toLocaleString()}</p>
            </div>
            <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-4">
              <p className="text-amber-400 text-sm">Pendiente por cobrar</p>
              <p className="text-xl font-bold text-amber-400">${totalPendiente.toLocaleString()}</p>
              <p className="text-xs text-amber-400/70">{pendientes.length} factura(s)</p>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
              <p className="text-emerald-400 text-sm">Ya pagado</p>
              <p className="text-xl font-bold text-emerald-400">${totalCobrado.toLocaleString()}</p>
            </div>
          </div>

          {vencidasSinConfirmar.length > 0 && (
            <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 mb-4 text-sm">
              <p className="text-red-300 font-medium">
                {vencidasSinConfirmar.length} factura(s) ya pasaron los {DIAS_PLAZO_PAGO} días de
                plazo y siguen sin marcarse como pagadas. Vale la pena confirmar con{' '}
                {vencidasSinConfirmar.some((f) => f.metodo === 'sistecredito') && 'Sistecrédito'}
                {vencidasSinConfirmar.some((f) => f.metodo === 'sistecredito') &&
                  vencidasSinConfirmar.some((f) => f.metodo === 'addi') &&
                  ' / '}
                {vencidasSinConfirmar.some((f) => f.metodo === 'addi') && 'Addi'} si ya
                consignaron.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-line bg-card">
              <thead className="bg-panel">
                <tr>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Factura</th>
                  <th className="p-2 text-left">Método</th>
                  <th className="p-2 text-right">Monto</th>
                  <th className="p-2 text-left">Estado del pago</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, idx) => {
                  const dias = diasTranscurridos(f.fecha)
                  const diasRestantes = DIAS_PLAZO_PAGO - dias
                  const idProceso = f.ventaId + f.metodo

                  return (
                    <tr key={idx} className="border-t border-line">
                      <td className="p-2">{formatearFecha(f.fecha)}</td>
                      <td className="p-2 text-muted font-mono text-xs">
                        {f.numeroFactura || '—'}
                      </td>
                      <td className="p-2 capitalize">{f.metodo}</td>
                      <td className="p-2 text-right">${f.monto.toLocaleString()}</td>
                      <td className="p-2">
                        {f.pagado ? (
                          <span className="text-emerald-400 text-xs font-medium">
                            ✓ Pagado {f.fechaPago && `(${formatearFecha(f.fechaPago)})`}
                          </span>
                        ) : diasRestantes > 0 ? (
                          <span className="text-amber-400 text-xs font-medium">
                            Faltan {diasRestantes} día(s)
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs font-medium">
                            Vencida hace {Math.abs(diasRestantes)} día(s)
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {f.pagado ? (
                          <button
                            onClick={() => desmarcarPago(f)}
                            disabled={procesandoId === idProceso}
                            className="text-muted text-xs hover:underline disabled:opacity-50"
                          >
                            Desmarcar
                          </button>
                        ) : (
                          <button
                            onClick={() => marcarComoPagado(f)}
                            disabled={procesandoId === idProceso}
                            className="text-brand-light text-xs font-medium hover:underline disabled:opacity-50"
                          >
                            {procesandoId === idProceso ? '...' : 'Marcar pagado'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
