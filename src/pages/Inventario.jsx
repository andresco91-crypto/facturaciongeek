import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductos } from '../hooks/useProductos'

export default function Inventario() {
  const { productos, cargando, buscar, recargar } = useProductos()
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [editando, setEditando] = useState(null) // codigo del producto en edición
  const [valores, setValores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const listaFiltrada = textoBusqueda.trim()
    ? buscarTodos(textoBusqueda)
    : productos

  function buscarTodos(texto) {
    const t = texto.toLowerCase().trim()
    return productos.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(t) || p.codigo?.toLowerCase().includes(t)
    )
  }

  function empezarEdicion(producto) {
    setEditando(producto.codigo)
    setValores({
      precioPublico: producto.precioPublico ?? 0,
      precioMayorista: producto.precioMayorista ?? 0,
      garantia: producto.garantia ?? '',
      stock: producto.stock ?? 0,
    })
    setMensaje(null)
  }

  function cancelarEdicion() {
    setEditando(null)
    setValores({})
  }

  async function guardarEdicion(codigo) {
    setGuardando(true)
    setMensaje(null)
    try {
      await updateDoc(doc(db, 'productos', codigo), {
        precioPublico: Number(valores.precioPublico) || 0,
        precioMayorista: Number(valores.precioMayorista) || 0,
        garantia: String(valores.garantia || '').trim(),
        stock: Number(valores.stock) || 0,
      })
      setMensaje({ tipo: 'exito', texto: 'Producto actualizado.' })
      setEditando(null)
      recargar()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Inventario</h1>

      <input
        type="text"
        value={textoBusqueda}
        onChange={(e) => setTextoBusqueda(e.target.value)}
        placeholder="Buscar por nombre o código..."
        className="w-full max-w-md border border-gray-300 rounded px-3 py-2 mb-4"
      />

      {mensaje && (
        <div
          className={`p-3 rounded mb-4 text-sm max-w-md ${
            mensaje.tipo === 'exito'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {cargando ? (
        <p className="text-gray-400">Cargando productos...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-right">Costo prom.</th>
                <th className="p-2 text-right">P. público</th>
                <th className="p-2 text-right">P. mayorista</th>
                <th className="p-2 text-right">Stock</th>
                <th className="p-2 text-left">Garantía</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((p) => (
                <tr key={p.codigo} className="border-t">
                  <td className="p-2 text-gray-400">{p.codigo}</td>
                  <td className="p-2">{p.nombre}</td>
                  <td className="p-2 text-right text-gray-500">
                    ${Number(p.costoPromedio || 0).toLocaleString()}
                  </td>

                  {editando === p.codigo ? (
                    <>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={valores.precioPublico}
                          onChange={(e) =>
                            setValores({ ...valores, precioPublico: e.target.value })
                          }
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-right"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={valores.precioMayorista}
                          onChange={(e) =>
                            setValores({ ...valores, precioMayorista: e.target.value })
                          }
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-right"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={valores.stock}
                          onChange={(e) =>
                            setValores({ ...valores, stock: e.target.value })
                          }
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-right"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={valores.garantia}
                          onChange={(e) =>
                            setValores({ ...valores, garantia: e.target.value })
                          }
                          placeholder="ej: 3 meses"
                          className="w-28 border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <button
                          onClick={() => guardarEdicion(p.codigo)}
                          disabled={guardando}
                          className="text-green-700 text-xs font-medium hover:underline mr-2"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelarEdicion}
                          className="text-gray-500 text-xs hover:underline"
                        >
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 text-right">
                        ${Number(p.precioPublico || 0).toLocaleString()}
                      </td>
                      <td className="p-2 text-right">
                        ${Number(p.precioMayorista || 0).toLocaleString()}
                      </td>
                      <td className="p-2 text-right">{p.stock}</td>
                      <td className="p-2 text-gray-500">{p.garantia || '—'}</td>
                      <td className="p-2">
                        <button
                          onClick={() => empezarEdicion(p)}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          Editar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {listaFiltrada.length === 0 && (
            <p className="text-gray-400 mt-4">No se encontraron productos.</p>
          )}
        </div>
      )}
    </div>
  )
}
