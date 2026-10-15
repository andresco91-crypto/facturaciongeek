import { useState } from 'react'
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductosCtx } from '../hooks/useProductosContext'
import { useCompraDraft } from '../hooks/useCompraDraft'
import { generarSiguienteCodigo } from '../lib/codigos'

export default function Compras() {
  const { productos, buscar, aplicarAjustesLocales, agregarProductoLocal } = useProductosCtx()
  const { items, setItems } = useCompraDraft() // persiste aunque navegues a otro módulo
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const resultados = buscar(textoBusqueda)

  // Cada clic agrega una línea NUEVA, aunque el producto ya esté en la compra:
  // así se puede comprar el mismo código varias veces con costos distintos.
  // Al guardar, el inventario promedia el costo de todas esas líneas.
  function agregarProductoExistente(producto) {
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

    // Se combina el catálogo guardado CON los productos nuevos que ya están
    // en este borrador de compra (aún sin guardar), para que cada uno reciba
    // un código distinto en vez de repetir el mismo "siguiente" número.
    const codigosConsiderados = [...productos, ...items]
    const codigoNuevo = generarSiguienteCodigo(codigosConsiderados)

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

  // Un mismo código puede repetirse en varias líneas SOLO si es un producto
  // que ya existe. Los productos nuevos deben tener código único.
  function validarCodigosUnicos() {
    const nuevosVistos = new Set()
    for (const item of items) {
      const codigo = String(item.codigo || '').trim()
      if (!codigo) return `Hay un producto sin código ("${item.nombre}").`
      if (item.esNuevo) {
        if (nuevosVistos.has(codigo)) {
          return `El código "${codigo}" está repetido entre los productos nuevos de esta compra.`
        }
        nuevosVistos.add(codigo)
        if (productos.some((p) => p.codigo === codigo)) {
          return `El código "${codigo}" ya existe en el catálogo. Cámbialo o agrega el producto existente.`
        }
      }
    }
    return null
  }

  async function guardarCompra() {
    if (items.length === 0) return

    const errorValidacion = validarCodigosUnicos()
    if (errorValidacion) {
      setMensaje({ tipo: 'error', texto: errorValidacion })
      return
    }

    setGuardando(true)
    setMensaje(null)

    try {
      // Se recorren las líneas en orden y se va acumulando, por código, el
      // stock y el costo promedio ponderado. Así, si un mismo código aparece
      // en varias líneas con costos distintos, el resultado final es el
      // promedio de todas (y no se pisan unas a otras).
      const estado = {} // codigo -> { nombre, esNuevo, stock, costo }

      for (const item of items) {
        const codigo = String(item.codigo).trim()
        const cantidad = Number(item.cantidad) || 0
        const costoNuevo = Number(item.costoUnitario) || 0

        if (!estado[codigo]) {
          estado[codigo] = {
            nombre: item.nombre,
            esNuevo: !!item.esNuevo,
            stock: Number(item.stockActual) || 0,
            costo: Number(item.costoActual) || 0,
          }
        }
        const e = estado[codigo]

        // Si el stock estaba en negativo, no se usa para ponderar el costo
        const stockBase = Math.max(e.stock, 0)
        const unidadesPromedio = stockBase + cantidad
        e.costo =
          unidadesPromedio > 0
            ? (stockBase * e.costo + cantidad * costoNuevo) / unidadesPromedio
            : costoNuevo
        e.stock = e.stock + cantidad
      }

      const batch = writeBatch(db)
      const ajustesExistentes = []
      const productosNuevos = []

      for (const [codigo, e] of Object.entries(estado)) {
        const productoRef = doc(db, 'productos', codigo)

        if (e.esNuevo) {
          const nuevoProducto = {
            codigo,
            nombre: e.nombre,
            costoPromedio: e.costo,
            precioPublico: 0,
            precioMayorista: 0,
            stock: e.stock,
            garantia: '',
          }
          batch.set(productoRef, nuevoProducto)
          productosNuevos.push({ id: codigo, ...nuevoProducto })
        } else {
          batch.set(
            productoRef,
            { stock: e.stock, costoPromedio: e.costo },
            { merge: true }
          )
          ajustesExistentes.push({
            codigo,
            nuevoStock: e.stock,
            nuevoCosto: e.costo,
          })
        }
      }

      const compraRef = doc(collection(db, 'compras'))
      batch.set(compraRef, {
        fecha: serverTimestamp(),
        items: items.map((i) => ({
          codigo: String(i.codigo).trim(),
          nombre: i.nombre,
          cantidad: Number(i.cantidad) || 0,
          costoUnitario: Number(i.costoUnitario) || 0,
        })),
        total,
      })

      await batch.commit()

      setMensaje({
        tipo: 'exito',
        texto: `Compra registrada: ${items.length} línea(s), ${Object.keys(estado).length} producto(s) actualizados.`,
      })
      setItems([]) // limpia el borrador solo cuando la compra se guarda con éxito
      aplicarAjustesLocales(ajustesExistentes)
      productosNuevos.forEach((p) => agregarProductoLocal(p))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar la compra: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Registrar factura de compra</h1>
      {items.length > 0 && (
        <p className="text-xs text-amber-400 mb-2">
          Tienes una compra en progreso con {items.length} línea(s). Puedes navegar a
          otros módulos sin perderla.
        </p>
      )}
      <p className="text-xs text-muted mb-3">
        Puedes agregar el mismo producto varias veces con costos distintos; al guardar, el
        inventario promedia el costo.
      </p>

      <div className="relative mb-4">
        <input
          type="text"
          value={textoBusqueda}
          onChange={(e) => setTextoBusqueda(e.target.value)}
          placeholder="Buscar producto por nombre..."
          className="w-full border border-line rounded-lg px-3 py-2"
        />
        {textoBusqueda && (
          <div className="absolute z-10 bg-card border border-line rounded-lg shadow-md w-full mt-1 max-h-64 overflow-y-auto">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => agregarProductoExistente(p)}
                className="block w-full text-left px-3 py-2 hover:bg-panel text-sm"
              >
                <span className="font-medium">{p.nombre}</span>{' '}
                <span className="text-muted">({p.codigo})</span> — stock actual: {p.stock}
              </button>
            ))}
            <button
              onClick={agregarProductoNuevo}
              className="block w-full text-left px-3 py-2 hover:bg-amber-950/40 text-sm text-amber-400 border-t border-line"
            >
              + Crear producto nuevo: "{textoBusqueda}"
            </button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-line">
            <thead className="bg-panel">
              <tr>
                <th className="p-2 text-left">Código (editable si es nuevo)</th>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-right">Cantidad</th>
                <th className="p-2 text-right">Costo unitario</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-t border-line">
                  <td className="p-2 text-muted">
                    {item.esNuevo ? (
                      <input
                        type="text"
                        value={item.codigo}
                        onChange={(e) => actualizarItem(idx, 'codigo', e.target.value)}
                        className="w-24 border border-line rounded-md px-2 py-1"
                      />
                    ) : (
                      item.codigo
                    )}
                  </td>
                  <td className="p-2">
                    {item.nombre}
                    {item.esNuevo && (
                      <span className="ml-2 text-xs bg-amber-950/60 text-amber-400 px-1 rounded">
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
                      className="w-20 border border-line rounded-md px-2 py-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.costoUnitario}
                      onChange={(e) => actualizarItem(idx, 'costoUnitario', e.target.value)}
                      className="w-28 border border-line rounded-md px-2 py-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right">
                    {(Number(item.cantidad || 0) * Number(item.costoUnitario || 0)).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => quitarItem(idx)}
                      className="text-red-400 text-xs hover:underline"
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
        onClick={guardarCompra}
        disabled={items.length === 0 || guardando}
        className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
      >
        {guardando ? 'Guardando...' : 'Guardar compra'}
      </button>
    </div>
  )
}
