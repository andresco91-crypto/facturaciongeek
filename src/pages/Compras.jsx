import { useState } from 'react'
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductos } from '../hooks/useProductos'

export default function Compras() {
  const { productos, buscar, recargar } = useProductos()
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [items, setItems] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const resultados = buscar(textoBusqueda)

  function agregarProductoExistente(producto) {
    if (items.some((i) => i.codigo === producto.codigo)) {
      setTextoBusqueda('')
      return
    }
    setItems([
      ...items,
      {
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad: 1,
        costoUnitario: producto.costoPromedio || 0,
        esNuevo: false,
        stockActual: producto.stock || 0,
        costoActual: producto.costoPromedio || 0,
      },
    ])
    setTextoBusqueda('')
  }

  function agregarProductoNuevo() {
    const nombre = textoBusqueda.trim()
    if (!nombre) return
    const codigoNuevo = generarCodigoTemporal()
    setItems([
      ...items,
      {
        codigo: codigoNuevo,
        nombre,
        cantidad: 1,
        costoUnitario: 0,
        esNuevo: true,
        stockActual: 0,
        costoActual: 0,
      },
    ])
    setTextoBusqueda('')
  }

  function generarCodigoTemporal() {
    return 'NUEVO-' + Date.now().toString().slice(-8)
  }

  function actualizarItem(index, campo, valor) {
    const copia = [...items]
    copia[index][campo] = valor
    setItems(copia)
  }

  function quitarItem(index) {
    setItems(items.filter((_, i) => i !== index))
  }

  const total = items.reduce(
    (acc, i) => acc + Number(i.cantidad || 0) * Number(i.costoUnitario || 0),
    0
  )

  async function guardarCompra() {
    if (items.length === 0) return
    setGuardando(true)
    setMensaje(null)

    try {
      const batch = writeBatch(db)

      for (const item of items) {
        const cantidad = Number(item.cantidad) || 0
        const costoNuevo = Number(item.costoUnitario) || 0
        const stockActual = Number(item.stockActual) || 0
        const costoActual = Number(item.costoActual) || 0

        const nuevoStock = stockActual + cantidad

        // Costo promedio ponderado
        let nuevoCosto
        if (nuevoStock <= 0) {
          nuevoCosto = costoNuevo
        } else {
          nuevoCosto =
            (stockActual * costoActual + cantidad * costoNuevo) / nuevoStock
        }

        const productoRef = doc(db, 'productos', item.codigo)

        if (item.esNuevo) {
          batch.set(productoRef, {
            codigo: item.codigo,
            nombre: item.nombre,
            costoPromedio: costoNuevo,
            precioPublico: 0,
            precioMayorista: 0,
            stock: cantidad,
            garantia: '',
          })
        } else {
          batch.set(
            productoRef,
            { stock: nuevoStock, costoPromedio: nuevoCosto },
            { merge: true }
          )
        }
      }

      // Registro de la factura de compra
      const compraRef = doc(collection(db, 'compras'))
      batch.set(compraRef, {
        fecha: serverTimestamp(),
        items: items.map((i) => ({
          codigo: i.codigo,
          nombre: i.nombre,
          cantidad: Number(i.cantidad) || 0,
          costoUnitario: Number(i.costoUnitario) || 0,
        })),
        total,
      })

      await batch.commit()

      setMensaje({ tipo: 'exito', texto: `Compra registrada: ${items.length} producto(s) actualizados.` })
      setItems([])
      recargar()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar la compra: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Registrar factura de compra</h1>

      <div className="relative mb-4">
        <input
          type="text"
          value={textoBusqueda}
          onChange={(e) => setTextoBusqueda(e.target.value)}
          placeholder="Buscar producto por nombre..."
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
        {textoBusqueda && (
          <div className="absolute z-10 bg-white border border-gray-200 rounded shadow-md w-full mt-1 max-h-64 overflow-y-auto">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => agregarProductoExistente(p)}
                className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              >
                <span className="font-medium">{p.nombre}</span>{' '}
                <span className="text-gray-400">({p.codigo})</span> — stock actual: {p.stock}
              </button>
            ))}
            <button
              onClick={agregarProductoNuevo}
              className="block w-full text-left px-3 py-2 hover:bg-yellow-50 text-sm text-yellow-700 border-t"
            >
              + Crear producto nuevo: "{textoBusqueda}"
            </button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-right">Cantidad</th>
                <th className="p-2 text-right">Costo unitario</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.codigo} className="border-t">
                  <td className="p-2">
                    {item.nombre}
                    {item.esNuevo && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1 rounded">
                        nuevo
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarItem(idx, 'cantidad', e.target.value)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.costoUnitario}
                      onChange={(e) => actualizarItem(idx, 'costoUnitario', e.target.value)}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right">
                    {(Number(item.cantidad || 0) * Number(item.costoUnitario || 0)).toLocaleString()}
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

          <p className="text-right font-semibold mt-2">
            Total: ${total.toLocaleString()}
          </p>
        </div>
      )}

      {mensaje && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            mensaje.tipo === 'exito'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <button
        onClick={guardarCompra}
        disabled={items.length === 0 || guardando}
        className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {guardando ? 'Guardando...' : 'Guardar compra'}
      </button>
    </div>
  )
}
