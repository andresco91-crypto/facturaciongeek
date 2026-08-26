import { useState, useEffect, useRef } from 'react'
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductos } from '../hooks/useProductos'
import { useTurno } from '../hooks/useTurno'
import TicketVenta from '../components/TicketVenta'

const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
]

export default function Ventas() {
  const { productos, buscar, recargar } = useProductos()
  const { turno, cargando: cargandoTurno } = useTurno()
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [items, setItems] = useState([])
  const [pagos, setPagos] = useState([{ metodo: 'efectivo', monto: '' }])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [ultimaVenta, setUltimaVenta] = useState(null)
  const ventaParaImprimirRef = useRef(null)

  const resultados = buscar(textoBusqueda)

  // Imprime automáticamente en cuanto el ticket de la nueva venta ya está
  // renderizado en el DOM (ultimaVenta cambia después de guardar).
  useEffect(() => {
    if (ultimaVenta && ultimaVenta !== ventaParaImprimirRef.current) {
      ventaParaImprimirRef.current = ultimaVenta
      const timer = setTimeout(() => window.print(), 150)
      return () => clearTimeout(timer)
    }
  }, [ultimaVenta])

  function agregarProducto(producto) {
    setItems((prev) => {
      if (prev.some((i) => i.codigo === producto.codigo)) {
        return prev
      }
      return [
        ...prev,
        {
          codigo: producto.codigo,
          nombre: producto.nombre,
          cantidad: 1,
          tipoPrecio: 'publico',
          precioUnitario: producto.precioPublico || 0,
          precioPublico: producto.precioPublico || 0,
          precioMayorista: producto.precioMayorista || 0,
        },
      ]
    })
    setTextoBusqueda('')
  }

  // Al presionar Enter: si el texto coincide exactamente con un código
  // (ideal para lectores de código de barras o escritura manual del código),
  // o si la búsqueda deja un único resultado, se agrega automáticamente.
  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const texto = textoBusqueda.trim().toLowerCase()
    if (!texto) return

    const coincidenciaExacta = productos.find(
      (p) => p.codigo?.toLowerCase() === texto
    )

    if (coincidenciaExacta) {
      agregarProducto(coincidenciaExacta)
      return
    }

    if (resultados.length === 1) {
      agregarProducto(resultados[0])
    }
  }

  function actualizarItem(index, campo, valor) {
    const copia = [...items]
    copia[index][campo] = valor

    if (campo === 'tipoPrecio') {
      copia[index].precioUnitario =
        valor === 'publico' ? copia[index].precioPublico : copia[index].precioMayorista
    }

    setItems(copia)
  }

  function quitarItem(index) {
    setItems(items.filter((_, i) => i !== index))
  }

  const total = items.reduce(
    (acc, i) => acc + Number(i.cantidad || 0) * Number(i.precioUnitario || 0),
    0
  )

  const pagoUnico = pagos.length === 1

  const totalPagos = pagoUnico
    ? total
    : pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0)
  const diferenciaPago = total - totalPagos

  function agregarMetodoPago() {
    setPagos([...pagos, { metodo: 'efectivo', monto: '' }])
  }

  function actualizarPago(index, campo, valor) {
    const copia = [...pagos]
    copia[index][campo] = valor
    setPagos(copia)
  }

  function quitarPago(index) {
    if (pagos.length === 1) return
    setPagos(pagos.filter((_, i) => i !== index))
  }

  async function guardarVenta() {
    if (items.length === 0) return
    if (!turno) {
      setMensaje({
        tipo: 'error',
        texto: 'No hay un turno de caja abierto. Ve a Caja y abre un turno antes de vender.',
      })
      return
    }
    if (Math.abs(diferenciaPago) > 0.5) {
      setMensaje({
        tipo: 'error',
        texto: `Los pagos (${totalPagos.toLocaleString()}) no cuadran con el total (${total.toLocaleString()}).`,
      })
      return
    }

    setGuardando(true)
    setMensaje(null)

    try {
      const batch = writeBatch(db)

      for (const item of items) {
        const productoRef = doc(db, 'productos', item.codigo)
        batch.update(productoRef, {
          stock: increment(-Number(item.cantidad || 0)),
        })
      }

      const pagosFinales = pagoUnico
        ? [{ metodo: pagos[0].metodo, monto: total }]
        : pagos
            .filter((p) => Number(p.monto) > 0)
            .map((p) => ({ metodo: p.metodo, monto: Number(p.monto) }))

      const itemsFinales = items.map((i) => ({
        codigo: i.codigo,
        nombre: i.nombre,
        cantidad: Number(i.cantidad) || 0,
        precioUnitario: Number(i.precioUnitario) || 0,
        tipoPrecio: i.tipoPrecio,
      }))

      const ventaRef = doc(collection(db, 'ventas'))
      batch.set(ventaRef, {
        fecha: serverTimestamp(),
        items: itemsFinales,
        pagos: pagosFinales,
        total,
        turnoId: turno.id,
      })

      await batch.commit()

      setUltimaVenta({
        fecha: new Date(),
        items: itemsFinales,
        pagos: pagosFinales,
        total,
      })

      setMensaje({ tipo: 'exito', texto: `Venta registrada por $${total.toLocaleString()}.` })
      setItems([])
      setPagos([{ metodo: 'efectivo', monto: '' }])
      recargar()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar la venta: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  function imprimirTicket() {
    window.print()
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Punto de venta</h1>

      {!cargandoTurno && !turno && (
        <div className="bg-amber-950/40 border border-amber-800 text-amber-300 rounded p-4 mb-4">
          <p className="font-medium">No hay un turno de caja abierto.</p>
          <p className="text-sm mt-1">
            Ve al módulo <strong>Caja</strong> y abre un turno antes de registrar ventas.
          </p>
        </div>
      )}

      <div className="relative mb-4">
        <input
          type="text"
          value={textoBusqueda}
          onChange={(e) => setTextoBusqueda(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nombre o escribir/escanear código + Enter..."
          className="w-full border border-line rounded-lg px-3 py-2"
          autoFocus
          disabled={!turno}
        />
        {textoBusqueda && (
          <div className="absolute z-10 bg-card border border-line rounded shadow-md w-full mt-1 max-h-64 overflow-y-auto">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => agregarProducto(p)}
                className="block w-full text-left px-3 py-2 hover:bg-panel text-sm"
              >
                <span className="font-medium">{p.nombre}</span>{' '}
                <span className="text-muted">
                  (stock: {p.stock} · público ${Number(p.precioPublico).toLocaleString()})
                </span>
              </button>
            ))}
            {resultados.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">Sin resultados.</p>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-line">
            <thead className="bg-panel">
              <tr>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-right">Cant.</th>
                <th className="p-2 text-left">Precio</th>
                <th className="p-2 text-right">Unitario</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.codigo} className="border-t">
                  <td className="p-2">{item.nombre}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarItem(idx, 'cantidad', e.target.value)}
                      className="w-16 border border-line rounded-lg px-2 py-1 text-right"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={item.tipoPrecio}
                      onChange={(e) => actualizarItem(idx, 'tipoPrecio', e.target.value)}
                      className="border border-line rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="publico">Público</option>
                      <option value="mayorista">Mayorista</option>
                    </select>
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.precioUnitario}
                      onChange={(e) => actualizarItem(idx, 'precioUnitario', e.target.value)}
                      className="w-24 border border-line rounded-lg px-2 py-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right">
                    ${(Number(item.cantidad || 0) * Number(item.precioUnitario || 0)).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => quitarItem(idx)}
                      className="text-red-500 text-xs hover:underline"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-right font-semibold mt-2 text-lg">
            Total: ${total.toLocaleString()}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 bg-card border border-line rounded p-4">
          <p className="font-medium mb-2">Pago</p>

          {pagoUnico ? (
            <div className="flex gap-2 mb-2 items-center">
              <select
                value={pagos[0].metodo}
                onChange={(e) => actualizarPago(0, 'metodo', e.target.value)}
                className="border border-line rounded-lg px-2 py-1 text-sm"
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-sm text-slate-300">
                Monto: <strong>${total.toLocaleString()}</strong> (total de la venta)
              </span>
            </div>
          ) : (
            pagos.map((pago, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select
                  value={pago.metodo}
                  onChange={(e) => actualizarPago(idx, 'metodo', e.target.value)}
                  className="border border-line rounded-lg px-2 py-1 text-sm"
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder="Monto"
                  value={pago.monto}
                  onChange={(e) => actualizarPago(idx, 'monto', e.target.value)}
                  className="border border-line rounded-lg px-2 py-1 text-sm w-32"
                />
                <button
                  onClick={() => quitarPago(idx)}
                  className="text-red-500 text-xs hover:underline"
                >
                  Quitar
                </button>
              </div>
            ))
          )}

          <button
            onClick={agregarMetodoPago}
            className="text-sm text-slate-300 hover:underline"
          >
            + Dividir pago en otro método
          </button>

          {!pagoUnico && (
            <p
              className={`mt-2 text-sm font-medium ${
                Math.abs(diferenciaPago) < 0.5 ? 'text-green-600' : 'text-red-400'
              }`}
            >
              {Math.abs(diferenciaPago) < 0.5
                ? 'Pagos completos ✓'
                : diferenciaPago > 0
                ? `Falta $${diferenciaPago.toLocaleString()} por pagar`
                : `Sobran $${Math.abs(diferenciaPago).toLocaleString()} en pagos`}
            </p>
          )}
        </div>
      )}

      {mensaje && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900'
              : 'bg-red-950/40 text-red-300 border border-red-900'
          }`}
        >
          {mensaje.texto}
          {mensaje.tipo === 'exito' && ultimaVenta && (
            <button
              onClick={imprimirTicket}
              className="ml-3 underline font-medium hover:text-green-900"
            >
              Reimprimir ticket
            </button>
          )}
        </div>
      )}

      <button
        onClick={guardarVenta}
        disabled={items.length === 0 || guardando || !turno}
        className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
      >
        {guardando ? 'Guardando...' : 'Registrar venta'}
      </button>

      <TicketVenta venta={ultimaVenta} />
    </div>
  )
}
