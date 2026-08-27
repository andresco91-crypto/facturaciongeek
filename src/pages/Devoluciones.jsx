import { useState } from 'react'
import { doc, writeBatch, increment } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductosCtx } from '../hooks/useProductosContext'
import { useTurno } from '../hooks/useTurno'
import { useDevoluciones } from '../hooks/useDevoluciones'

const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'sistecredito', label: 'Sistecrédito' },
  { id: 'addi', label: 'Addi' },
]

export default function Devoluciones() {
  const { buscar, aplicarAjustesLocales } = useProductosCtx()
  const { turno } = useTurno()
  const { registrarDevolucion } = useDevoluciones()

  const [tipo, setTipo] = useState('devolucion') // devolucion | cambio
  const [numeroFactura, setNumeroFactura] = useState('')
  const [nota, setNota] = useState('')

  const [textoDevuelto, setTextoDevuelto] = useState('')
  const [productoDevuelto, setProductoDevuelto] = useState(null)
  const [cantidadDevuelto, setCantidadDevuelto] = useState(1)
  const [precioDevuelto, setPrecioDevuelto] = useState(0)

  const [textoNuevo, setTextoNuevo] = useState('')
  const [productoNuevo, setProductoNuevo] = useState(null)
  const [cantidadNuevo, setCantidadNuevo] = useState(1)
  const [precioNuevo, setPrecioNuevo] = useState(0)

  const [metodoDiferencia, setMetodoDiferencia] = useState('efectivo')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const resultadosDevuelto = buscar(textoDevuelto)
  const resultadosNuevo = buscar(textoNuevo)

  const totalDevuelto = (Number(cantidadDevuelto) || 0) * (Number(precioDevuelto) || 0)
  const totalNuevo = tipo === 'cambio' ? (Number(cantidadNuevo) || 0) * (Number(precioNuevo) || 0) : 0
  const diferencia = tipo === 'cambio' ? totalNuevo - totalDevuelto : -totalDevuelto

  function elegirDevuelto(p) {
    setProductoDevuelto(p)
    setPrecioDevuelto(p.precioPublico || 0)
    setTextoDevuelto('')
  }

  function elegirNuevo(p) {
    setProductoNuevo(p)
    setPrecioNuevo(p.precioPublico || 0)
    setTextoNuevo('')
  }

  function puedeGuardar() {
    if (!turno) return false
    if (!productoDevuelto) return false
    if (!nota.trim()) return false
    if (tipo === 'cambio' && !productoNuevo) return false
    return true
  }

  async function guardar() {
    if (!puedeGuardar()) return
    setGuardando(true)
    setMensaje(null)

    try {
      const batch = writeBatch(db)

      // El producto devuelto regresa al inventario
      const refDevuelto = doc(db, 'productos', productoDevuelto.codigo)
      batch.update(refDevuelto, { stock: increment(Number(cantidadDevuelto) || 0) })

      let ajustesLocales = [{ codigo: productoDevuelto.codigo, stockDelta: Number(cantidadDevuelto) || 0 }]

      if (tipo === 'cambio') {
        const refNuevo = doc(db, 'productos', productoNuevo.codigo)
        batch.update(refNuevo, { stock: increment(-(Number(cantidadNuevo) || 0)) })
        ajustesLocales.push({ codigo: productoNuevo.codigo, stockDelta: -(Number(cantidadNuevo) || 0) })
      }

      await batch.commit()

      await registrarDevolucion({
        tipo,
        turnoId: turno.id,
        numeroFactura: numeroFactura.trim() || null,
        nota: nota.trim(),
        itemDevuelto: {
          codigo: productoDevuelto.codigo,
          nombre: productoDevuelto.nombre,
          cantidad: Number(cantidadDevuelto) || 0,
          precioUnitario: Number(precioDevuelto) || 0,
        },
        itemNuevo:
          tipo === 'cambio'
            ? {
                codigo: productoNuevo.codigo,
                nombre: productoNuevo.nombre,
                cantidad: Number(cantidadNuevo) || 0,
                precioUnitario: Number(precioNuevo) || 0,
              }
            : null,
        diferencia,
        metodoDiferencia: diferencia !== 0 ? metodoDiferencia : null,
      })

      aplicarAjustesLocales(ajustesLocales)

      setMensaje({
        tipo: 'exito',
        texto:
          diferencia === 0
            ? 'Movimiento registrado. Sin diferencia de dinero.'
            : diferencia > 0
            ? `Movimiento registrado. El cliente pagó $${diferencia.toLocaleString()} de más.`
            : `Movimiento registrado. Se devolvieron $${Math.abs(diferencia).toLocaleString()} al cliente.`,
      })

      setTipo('devolucion')
      setNumeroFactura('')
      setNota('')
      setProductoDevuelto(null)
      setCantidadDevuelto(1)
      setPrecioDevuelto(0)
      setProductoNuevo(null)
      setCantidadNuevo(1)
      setPrecioNuevo(0)
      setMetodoDiferencia('efectivo')
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Devoluciones y cambios</h1>
      <p className="text-muted text-sm mb-6">
        Registra cuando un cliente devuelve un producto o lo cambia por otro. El stock se
        ajusta automáticamente y queda una nota clara en Caja explicando el movimiento.
      </p>

      {!turno && (
        <div className="bg-amber-950/40 border border-amber-800 text-amber-300 rounded-lg p-4 mb-4 text-sm">
          No hay un turno de caja abierto. Ve a <strong>Caja</strong> y abre un turno para
          poder registrar devoluciones o cambios.
        </div>
      )}

      <div className="bg-card border border-line rounded-xl p-5 mb-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTipo('devolucion')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              tipo === 'devolucion'
                ? 'bg-brand text-white border-brand'
                : 'border-line text-slate-300 hover:bg-panel'
            }`}
          >
            Devolución
          </button>
          <button
            onClick={() => setTipo('cambio')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              tipo === 'cambio'
                ? 'bg-brand text-white border-brand'
                : 'border-line text-slate-300 hover:bg-panel'
            }`}
          >
            Cambio por otro producto
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-200 mb-1">
          Número de factura relacionada (opcional)
        </label>
        <input
          type="text"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
          placeholder="ej: FAC-000123"
          className="w-full border border-line rounded-lg px-3 py-2 mb-4"
        />

        <p className="text-sm font-medium text-slate-200 mb-2">
          Producto que el cliente devuelve
        </p>
        {!productoDevuelto ? (
          <div className="relative mb-4">
            <input
              type="text"
              value={textoDevuelto}
              onChange={(e) => setTextoDevuelto(e.target.value)}
              placeholder="Buscar producto devuelto..."
              className="w-full border border-line rounded-lg px-3 py-2"
            />
            {textoDevuelto && (
              <div className="absolute z-10 bg-card border border-line rounded-lg shadow-md w-full mt-1 max-h-56 overflow-y-auto">
                {resultadosDevuelto.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => elegirDevuelto(p)}
                    className="block w-full text-left px-3 py-2 hover:bg-panel text-sm"
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-panel border border-line rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{productoDevuelto.nombre}</span>
              <button
                onClick={() => setProductoDevuelto(null)}
                className="text-red-400 text-xs hover:underline"
              >
                Quitar
              </button>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadDevuelto}
                  onChange={(e) => setCantidadDevuelto(e.target.value)}
                  className="w-20 border border-line rounded-lg px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Precio unitario</label>
                <input
                  type="number"
                  min="0"
                  value={precioDevuelto}
                  onChange={(e) => setPrecioDevuelto(e.target.value)}
                  className="w-28 border border-line rounded-lg px-2 py-1"
                />
              </div>
            </div>
          </div>
        )}

        {tipo === 'cambio' && (
          <>
            <p className="text-sm font-medium text-slate-200 mb-2">
              Producto nuevo que se lleva el cliente
            </p>
            {!productoNuevo ? (
              <div className="relative mb-4">
                <input
                  type="text"
                  value={textoNuevo}
                  onChange={(e) => setTextoNuevo(e.target.value)}
                  placeholder="Buscar producto nuevo..."
                  className="w-full border border-line rounded-lg px-3 py-2"
                />
                {textoNuevo && (
                  <div className="absolute z-10 bg-card border border-line rounded-lg shadow-md w-full mt-1 max-h-56 overflow-y-auto">
                    {resultadosNuevo.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => elegirNuevo(p)}
                        className="block w-full text-left px-3 py-2 hover:bg-panel text-sm"
                      >
                        {p.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-panel border border-line rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{productoNuevo.nombre}</span>
                  <button
                    onClick={() => setProductoNuevo(null)}
                    className="text-red-400 text-xs hover:underline"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={cantidadNuevo}
                      onChange={(e) => setCantidadNuevo(e.target.value)}
                      className="w-20 border border-line rounded-lg px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Precio unitario</label>
                    <input
                      type="number"
                      min="0"
                      value={precioNuevo}
                      onChange={(e) => setPrecioNuevo(e.target.value)}
                      className="w-28 border border-line rounded-lg px-2 py-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <label className="block text-sm font-medium text-slate-200 mb-1">
          Nota aclarando el motivo (obligatoria, se mostrará en Caja)
        </label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="ej: Cliente devolvió audífonos por falla, se cambió por otro modelo"
          className="w-full border border-line rounded-lg px-3 py-2 mb-4"
        />

        {productoDevuelto && (
          <div className="bg-panel border border-line rounded-lg p-3 mb-4 text-sm">
            <p>Valor devuelto: ${totalDevuelto.toLocaleString()}</p>
            {tipo === 'cambio' && <p>Valor producto nuevo: ${totalNuevo.toLocaleString()}</p>}
            <p className="font-semibold mt-1">
              {diferencia === 0
                ? 'Sin diferencia de dinero'
                : diferencia > 0
                ? `Cliente debe pagar: $${diferencia.toLocaleString()}`
                : `Se devuelve al cliente: $${Math.abs(diferencia).toLocaleString()}`}
            </p>

            {diferencia !== 0 && (
              <div className="mt-2">
                <label className="block text-xs text-muted mb-1">
                  Método de pago de la diferencia
                </label>
                <select
                  value={metodoDiferencia}
                  onChange={(e) => setMetodoDiferencia(e.target.value)}
                  className="border border-line rounded-lg px-2 py-1 text-sm"
                >
                  {METODOS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {mensaje && (
          <div
            className={`p-3 rounded-lg mb-4 text-sm ${
              mensaje.tipo === 'exito'
                ? 'bg-emerald-950/40 border border-emerald-900 text-emerald-300'
                : 'bg-red-950/40 border border-red-900 text-red-300'
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <button
          onClick={guardar}
          disabled={!puedeGuardar() || guardando}
          className="bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-dark font-medium disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Registrar movimiento'}
        </button>
      </div>
    </div>
  )
}
