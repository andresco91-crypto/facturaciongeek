import { useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatearFecha(fecha) {
  if (!fecha) return '—'
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO')
}

export default function HistorialCompras() {
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(hoyISO())
  const [compras, setCompras] = useState([])
  const [expandida, setExpandida] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [itemsEdicion, setItemsEdicion] = useState([])
  const [cargando, setCargando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [buscado, setBuscado] = useState(false)

  async function buscarCompras() {
    setCargando(true)
    setError('')
    try {
      const fechaDesde = Timestamp.fromDate(new Date(desde + 'T00:00:00'))
      const fechaHasta = Timestamp.fromDate(new Date(hasta + 'T23:59:59'))

      const q = query(
        collection(db, 'compras'),
        where('fecha', '>=', fechaDesde),
        where('fecha', '<=', fechaHasta),
        orderBy('fecha', 'desc')
      )
      const snapshot = await getDocs(q)
      setCompras(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setBuscado(true)
    } catch (err) {
      setError('Error al buscar compras: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function toggleExpandir(id) {
    setExpandida(expandida === id ? null : id)
    setEditandoId(null)
  }

  function empezarEdicion(compra) {
    setEditandoId(compra.id)
    setItemsEdicion(compra.items.map((i) => ({ ...i })))
    setError('')
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setItemsEdicion([])
  }

  function actualizarItemEdicion(idx, campo, valor) {
    const copia = [...itemsEdicion]
    copia[idx][campo] = valor
    setItemsEdicion(copia)
  }

  async function guardarEdicion(compra) {
    setProcesando(true)
    setError('')
    try {
      const batch = writeBatch(db)
      let nuevoTotal = 0

      for (let i = 0; i < itemsEdicion.length; i++) {
        const original = compra.items[i]
        const editado = itemsEdicion[i]
        const cantidadNueva = Number(editado.cantidad) || 0
        const costoNuevo = Number(editado.costoUnitario) || 0
        const delta = cantidadNueva - (Number(original.cantidad) || 0)

        nuevoTotal += cantidadNueva * costoNuevo

        if (delta !== 0) {
          const productoRef = doc(db, 'productos', editado.codigo)
          batch.update(productoRef, { stock: increment(delta) })
        }
      }

      const compraRef = doc(db, 'compras', compra.id)
      batch.update(compraRef, {
        items: itemsEdicion.map((i) => ({
          codigo: i.codigo,
          nombre: i.nombre,
          cantidad: Number(i.cantidad) || 0,
          costoUnitario: Number(i.costoUnitario) || 0,
        })),
        total: nuevoTotal,
        fechaEdicion: serverTimestamp(),
      })

      await batch.commit()

      setCompras((prev) =>
        prev.map((c) =>
          c.id === compra.id
            ? { ...c, items: itemsEdicion, total: nuevoTotal, fechaEdicion: new Date() }
            : c
        )
      )
      setEditandoId(null)
      setItemsEdicion([])
    } catch (err) {
      setError('Error al guardar los cambios: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  async function anularCompra(compra) {
    const confirmado = confirm(
      `¿Anular esta compra por $${Number(compra.total).toLocaleString()} del ${formatearFecha(
        compra.fecha
      )}?\n\nEsto restará del stock las cantidades que esta compra había agregado. Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setProcesando(true)
    setError('')
    try {
      const batch = writeBatch(db)

      for (const item of compra.items || []) {
        const productoRef = doc(db, 'productos', item.codigo)
        batch.update(productoRef, {
          stock: increment(-(Number(item.cantidad) || 0)),
        })
      }

      const compraRef = doc(db, 'compras', compra.id)
      batch.update(compraRef, {
        anulada: true,
        fechaAnulacion: serverTimestamp(),
      })

      await batch.commit()

      setCompras((prev) =>
        prev.map((c) => (c.id === compra.id ? { ...c, anulada: true } : c))
      )
    } catch (err) {
      setError('Error al anular: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  const totalGeneral = compras
    .filter((c) => c.anulada !== true)
    .reduce((acc, c) => acc + Number(c.total || 0), 0)

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Historial de compras</h1>

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
          onClick={buscarCompras}
          disabled={cargando}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar compras'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-300 rounded p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {buscado && (
        <>
          <p className="text-sm text-muted mb-2">
            {compras.length} compra(s) encontrada(s) — total: $
            {totalGeneral.toLocaleString()}
          </p>

          <div className="space-y-2">
            {compras.map((compra) => (
              <div
                key={compra.id}
                className={`bg-card border rounded ${
                  compra.anulada ? 'border-red-900 opacity-60' : 'border-line'
                }`}
              >
                <button
                  onClick={() => toggleExpandir(compra.id)}
                  className="w-full text-left p-3 flex justify-between items-center hover:bg-panel"
                >
                  <div>
                    <span className="font-medium">{formatearFecha(compra.fecha)}</span>
                    <span className="text-muted ml-2 text-sm">
                      {compra.items?.length || 0} producto(s)
                    </span>
                    {compra.anulada && (
                      <span className="ml-2 text-xs bg-red-950/60 text-red-300 px-2 py-0.5 rounded">
                        ANULADA
                      </span>
                    )}
                    {compra.fechaEdicion && !compra.anulada && (
                      <span className="ml-2 text-xs bg-amber-950/60 text-amber-400 px-2 py-0.5 rounded">
                        EDITADA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      ${Number(compra.total || 0).toLocaleString()}
                    </span>
                    <span className="text-muted text-xs">
                      {expandida === compra.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {expandida === compra.id && (
                  <div className="border-t border-line p-3 text-sm">
                    {editandoId === compra.id ? (
                      <>
                        <table className="w-full mb-3">
                          <thead>
                            <tr className="text-muted">
                              <th className="text-left font-normal">Código</th>
                              <th className="text-left font-normal">Producto</th>
                              <th className="text-right font-normal">Cant.</th>
                              <th className="text-right font-normal">Costo unitario</th>
                              <th className="text-right font-normal">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsEdicion.map((item, idx) => (
                              <tr key={idx} className="border-t border-line">
                                <td className="py-1 text-muted">{item.codigo}</td>
                                <td className="py-1">{item.nombre}</td>
                                <td className="py-1 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.cantidad}
                                    onChange={(e) =>
                                      actualizarItemEdicion(idx, 'cantidad', e.target.value)
                                    }
                                    className="w-20 border border-line rounded-md px-2 py-1 text-right"
                                  />
                                </td>
                                <td className="py-1 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.costoUnitario}
                                    onChange={(e) =>
                                      actualizarItemEdicion(idx, 'costoUnitario', e.target.value)
                                    }
                                    className="w-24 border border-line rounded-md px-2 py-1 text-right"
                                  />
                                </td>
                                <td className="py-1 text-right">
                                  $
                                  {(
                                    Number(item.cantidad || 0) * Number(item.costoUnitario || 0)
                                  ).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <p className="text-xs text-amber-400 mb-3">
                          El stock se ajustará según la diferencia entre la cantidad original y
                          la nueva. Si el costo cambió mucho, revisa el costo promedio del
                          producto en Inventario.
                        </p>

                        <div className="flex gap-3">
                          <button
                            onClick={() => guardarEdicion(compra)}
                            disabled={procesando}
                            className="text-emerald-400 text-sm font-medium hover:underline disabled:opacity-50"
                          >
                            {procesando ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                          <button
                            onClick={cancelarEdicion}
                            className="text-muted text-sm hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <table className="w-full mb-3">
                          <thead>
                            <tr className="text-muted">
                              <th className="text-left font-normal">Código</th>
                              <th className="text-left font-normal">Producto</th>
                              <th className="text-right font-normal">Cant.</th>
                              <th className="text-right font-normal">Costo unitario</th>
                              <th className="text-right font-normal">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {compra.items?.map((item, idx) => (
                              <tr key={idx} className="border-t border-line">
                                <td className="py-1 text-muted">{item.codigo}</td>
                                <td className="py-1">{item.nombre}</td>
                                <td className="py-1 text-right">{item.cantidad}</td>
                                <td className="py-1 text-right">
                                  ${Number(item.costoUnitario).toLocaleString()}
                                </td>
                                <td className="py-1 text-right">
                                  ${(item.cantidad * item.costoUnitario).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {compra.anulada ? (
                          <p className="text-red-400 text-xs font-medium">
                            Esta compra fue anulada el {formatearFecha(compra.fechaAnulacion)}.
                            El stock ya fue revertido.
                          </p>
                        ) : (
                          <div className="flex gap-4">
                            <button
                              onClick={() => empezarEdicion(compra)}
                              className="text-brand-light text-xs font-medium hover:underline"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => anularCompra(compra)}
                              disabled={procesando}
                              className="text-red-400 text-xs font-medium hover:underline disabled:opacity-50"
                            >
                              Anular esta compra
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {compras.length === 0 && (
              <p className="text-muted">No hay compras en este rango de fechas.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
