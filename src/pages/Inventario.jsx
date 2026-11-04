import { useEffect, useState } from 'react'
import { doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { db } from '../lib/firebase'
import { useProductosCtx } from '../hooks/useProductosContext'
import { useRole } from '../hooks/useRole'
import { useColaWeb } from '../hooks/useColaWeb'
import {
  CATEGORIA_COLECCIONABLES,
  webConfigurada,
  publicarProducto,
  obtenerEstadoWeb,
  sincronizarWebCompleto,
  avisarWeb,
} from '../lib/sincronizarWeb'

const TAMANO_LOTE = 400
const AVISO_FICHA =
  "Se abrió la ficha web. Complétala (fotos, descripción con IA, alto de la figura) y marca 'Publicar en geekstore.com.co'."

function esColeccionable(p) {
  return p.categoria === CATEGORIA_COLECCIONABLES
}

function tieneFicha(p, estado) {
  return Boolean((p.web && p.web.enKennedy) || estado)
}

function fichaIncompleta(estado) {
  if (!estado) return false
  return estado.completo === false || (estado.faltan || []).length > 0
}

// Etiqueta del estado web de un producto, según lo que responde Kennedy.
function EtiquetaWeb({ producto, estado }) {
  if (!estado) {
    if (producto.web && producto.web.enKennedy) {
      return <span className="text-xs text-muted">Sin datos de la web (pulsa ↻)</span>
    }
    return null
  }

  let etiqueta
  if (estado.enLaPagina) {
    etiqueta = (
      <a
        href={estado.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded hover:underline"
      >
        En la página <ExternalLink size={12} />
      </a>
    )
  } else if (estado.publicado && estado.completo && Number(estado.stock) <= 0) {
    etiqueta = (
      <span className="text-xs bg-red-950/60 text-red-300 px-2 py-0.5 rounded">
        Sin stock en la web
      </span>
    )
  } else if ((estado.faltan || []).length > 0) {
    etiqueta = (
      <span className="text-xs bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded">
        Falta: {estado.faltan.join(', ')}
      </span>
    )
  } else if (!estado.publicado) {
    etiqueta = (
      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
        No publicado
      </span>
    )
  } else {
    etiqueta = (
      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
        Publicado
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {estado.foto && (
        <img
          src={estado.foto}
          alt=""
          className="w-8 h-8 rounded object-cover border border-line shrink-0"
        />
      )}
      {etiqueta}
    </div>
  )
}

export default function Inventario() {
  const {
    productos,
    cargando,
    actualizarProductoLocal,
    actualizarVariosLocal,
    reemplazarCodigoLocal,
  } = useProductosCtx()
  const { rol } = useRole()
  const esAdmin = rol === 'admin'
  const { pendientes, error: errorCola } = useColaWeb()

  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [filtroStock, setFiltroStock] = useState('todos') // todos | con-stock | agotados
  const [filtroWeb, setFiltroWeb] = useState('todos') // todos | coleccionables | en-web | incompleta
  const [editando, setEditando] = useState(null) // codigo del producto en edición
  const [valores, setValores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const [seleccion, setSeleccion] = useState(() => new Set())
  const [aplicandoCategoria, setAplicandoCategoria] = useState(false)

  const [estadoWeb, setEstadoWeb] = useState({})
  const [cargandoWeb, setCargandoWeb] = useState(false)
  const [errorWeb, setErrorWeb] = useState('')
  const [publicando, setPublicando] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    if (webConfigurada) cargarEstadoWeb()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarEstadoWeb() {
    setCargandoWeb(true)
    setErrorWeb('')
    try {
      setEstadoWeb(await obtenerEstadoWeb())
    } catch (err) {
      setErrorWeb(err.message)
    } finally {
      setCargandoWeb(false)
    }
  }

  // ---------------------------------------------------------------------
  // Filtros
  // ---------------------------------------------------------------------

  function buscarTodos(texto) {
    const t = texto.toLowerCase().trim()
    return productos.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(t) || p.codigo?.toLowerCase().includes(t)
    )
  }

  const listaBase = textoBusqueda.trim() ? buscarTodos(textoBusqueda) : productos

  // "Agotados" incluye tanto stock en cero como stock NEGATIVO (productos
  // vendidos de más antes de reponer, que quedaron en números rojos).
  const listaFiltrada = listaBase.filter((p) => {
    const stock = Number(p.stock) || 0
    if (filtroStock === 'con-stock' && !(stock > 0)) return false
    if (filtroStock === 'agotados' && !(stock <= 0)) return false

    const estado = estadoWeb[p.codigo]
    if (filtroWeb === 'coleccionables' && !esColeccionable(p)) return false
    if (filtroWeb === 'en-web' && !(estado && estado.enLaPagina)) return false
    if (filtroWeb === 'incompleta' && !fichaIncompleta(estado)) return false
    return true
  })

  const cantidadConStock = productos.filter((p) => (Number(p.stock) || 0) > 0).length
  const cantidadAgotados = productos.filter((p) => (Number(p.stock) || 0) <= 0).length
  const cantidadNegativos = productos.filter((p) => (Number(p.stock) || 0) < 0).length
  const cantidadColeccionables = productos.filter(esColeccionable).length
  const cantidadEnWeb = productos.filter((p) => estadoWeb[p.codigo]?.enLaPagina).length
  const cantidadIncompletas = productos.filter((p) => fichaIncompleta(estadoWeb[p.codigo])).length

  // ---------------------------------------------------------------------
  // Selección múltiple y categoría
  // ---------------------------------------------------------------------

  const todosVisiblesSeleccionados =
    listaFiltrada.length > 0 && listaFiltrada.every((p) => seleccion.has(p.codigo))

  function alternarSeleccion(codigo) {
    setSeleccion((prev) => {
      const nueva = new Set(prev)
      if (nueva.has(codigo)) nueva.delete(codigo)
      else nueva.add(codigo)
      return nueva
    })
  }

  function alternarTodosVisibles() {
    setSeleccion((prev) => {
      const nueva = new Set(prev)
      if (todosVisiblesSeleccionados) {
        listaFiltrada.forEach((p) => nueva.delete(p.codigo))
      } else {
        listaFiltrada.forEach((p) => nueva.add(p.codigo))
      }
      return nueva
    })
  }

  async function aplicarCategoria(categoria) {
    const codigos = [...seleccion]
    if (codigos.length === 0) return
    setAplicandoCategoria(true)
    setMensaje(null)
    try {
      for (let i = 0; i < codigos.length; i += TAMANO_LOTE) {
        const batch = writeBatch(db)
        codigos
          .slice(i, i + TAMANO_LOTE)
          .forEach((c) => batch.update(doc(db, 'productos', c), { categoria }))
        await batch.commit()
      }
      const cambios = {}
      codigos.forEach((c) => (cambios[c] = { categoria }))
      actualizarVariosLocal(cambios)
      setSeleccion(new Set())
      setMensaje({
        tipo: 'exito',
        texto: categoria
          ? `${codigos.length} producto(s) marcados como ${categoria}.`
          : `Se quitó la categoría a ${codigos.length} producto(s).`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al cambiar la categoría: ' + err.message })
    } finally {
      setAplicandoCategoria(false)
    }
  }

  // ---------------------------------------------------------------------
  // Web: publicar / editar ficha y sincronizar
  // ---------------------------------------------------------------------

  async function handlePublicar(p) {
    // La pestaña se abre en el mismo clic, antes de cualquier espera, para
    // que el navegador no la bloquee. Luego se le pone la dirección.
    const ventana = window.open('', '_blank')
    try {
      ventana?.document.write(
        '<p style="font-family:sans-serif;padding:24px">Abriendo la ficha web…</p>'
      )
    } catch {
      // algunos navegadores no permiten escribir en la pestaña; no importa
    }

    setPublicando(p.codigo)
    setMensaje(null)
    try {
      const { producto, enlace, web } = await publicarProducto(p)
      actualizarProductoLocal(p.codigo, { web })
      setEstadoWeb((prev) => ({ ...prev, [p.codigo]: producto }))

      if (ventana) {
        ventana.location.href = enlace
        setMensaje({ tipo: 'exito', texto: AVISO_FICHA })
      } else {
        // El navegador bloqueó la pestaña: se deja el enlace para abrirlo a mano.
        setMensaje({ tipo: 'exito', texto: AVISO_FICHA, enlace })
      }
    } catch (err) {
      ventana?.close()
      setMensaje({ tipo: 'error', texto: 'No se pudo abrir la ficha web: ' + err.message })
    } finally {
      setPublicando(null)
    }
  }

  async function handleSincronizar() {
    setSincronizando(true)
    setMensaje(null)
    try {
      const r = await sincronizarWebCompleto()
      setMensaje({
        tipo: 'exito',
        texto:
          r.enviados === 0
            ? 'No hay productos con ficha web todavía.'
            : `${r.enviados} producto(s) al día en la web.`,
      })
      await cargarEstadoWeb()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'No se pudo sincronizar la web: ' + err.message })
    } finally {
      setSincronizando(false)
    }
  }

  // ---------------------------------------------------------------------
  // Edición de un producto
  // ---------------------------------------------------------------------

  function empezarEdicion(producto) {
    setEditando(producto.codigo)
    setValores({
      codigo: producto.codigo ?? '',
      nombre: producto.nombre ?? '',
      categoria: producto.categoria ?? '',
      precioPublico: producto.precioPublico ?? 0,
      precioMayorista: producto.precioMayorista ?? 0,
      costoPromedio: producto.costoPromedio ?? 0,
      garantia: producto.garantia ?? '',
      stock: producto.stock ?? 0,
    })
    setMensaje(null)
  }

  function cancelarEdicion() {
    setEditando(null)
    setValores({})
  }

  async function guardarEdicion(codigoOriginal) {
    const nuevoCodigo = String(valores.codigo || '').trim()
    const original = productos.find((p) => p.codigo === codigoOriginal)

    if (!String(valores.nombre || '').trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' })
      return
    }
    if (!nuevoCodigo) {
      setMensaje({ tipo: 'error', texto: 'El código no puede quedar vacío.' })
      return
    }

    const cambioDeCodigo = nuevoCodigo !== codigoOriginal
    if (cambioDeCodigo && original?.web?.enKennedy) {
      setMensaje({
        tipo: 'error',
        texto:
          'Este producto ya tiene ficha en la página web, así que su código no se puede cambiar (la web lo identifica por ese código).',
      })
      return
    }

    setGuardando(true)
    setMensaje(null)
    try {
      const cambios = {
        codigo: nuevoCodigo,
        nombre: String(valores.nombre).trim(),
        categoria: valores.categoria || '',
        precioPublico: Number(valores.precioPublico) || 0,
        precioMayorista: Number(valores.precioMayorista) || 0,
        costoPromedio: Number(valores.costoPromedio) || 0,
        garantia: String(valores.garantia || '').trim(),
        stock: Number(valores.stock) || 0,
      }

      if (!cambioDeCodigo) {
        await updateDoc(doc(db, 'productos', codigoOriginal), cambios)
        actualizarProductoLocal(codigoOriginal, cambios)
        // Si cambió el precio o el stock y tiene ficha web, la web se entera.
        avisarWeb([codigoOriginal])
      } else {
        const yaExisteLocal = productos.some((p) => p.codigo === nuevoCodigo)
        if (yaExisteLocal) {
          throw new Error(`El código "${nuevoCodigo}" ya está en uso por otro producto.`)
        }
        const snapNuevo = await getDoc(doc(db, 'productos', nuevoCodigo))
        if (snapNuevo.exists()) {
          throw new Error(`El código "${nuevoCodigo}" ya está en uso por otro producto.`)
        }

        // Se conservan todos los campos del producto (no solo los del formulario).
        // eslint-disable-next-line no-unused-vars
        const { id, ...resto } = original || {}
        const productoNuevo = { ...resto, ...cambios }

        const batch = writeBatch(db)
        batch.set(doc(db, 'productos', nuevoCodigo), productoNuevo)
        batch.delete(doc(db, 'productos', codigoOriginal))
        await batch.commit()

        reemplazarCodigoLocal(codigoOriginal, { ...productoNuevo, id: nuevoCodigo })
      }

      setMensaje({
        tipo: 'exito',
        texto: cambioDeCodigo
          ? `Producto actualizado. El código cambió a "${nuevoCodigo}". Las ventas y compras ya registradas conservan el código anterior en su historial.`
          : 'Producto actualizado.',
      })
      setEditando(null)
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  // ---------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------

  function botonFiltro(activo, onClick, texto, colorActivo) {
    return (
      <button
        onClick={onClick}
        className={`text-sm px-3 py-1.5 rounded-lg border ${
          activo ? colorActivo : 'border-line text-slate-300 hover:bg-panel'
        }`}
      >
        {texto}
      </button>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Inventario</h1>

        {webConfigurada && esAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {pendientes > 0 && (
              <span className="text-xs bg-amber-950/60 text-amber-300 px-2 py-1 rounded">
                {pendientes} cambio(s) sin enviar a la web
              </span>
            )}
            <button
              onClick={cargarEstadoWeb}
              disabled={cargandoWeb}
              title="Actualizar estado web"
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-line text-slate-300 hover:bg-panel disabled:opacity-50"
            >
              <RefreshCw size={14} className={cargandoWeb ? 'animate-spin' : ''} />
              Estado web
            </button>
            <button
              onClick={handleSincronizar}
              disabled={sincronizando}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {sincronizando ? 'Sincronizando...' : 'Sincronizar web'}
            </button>
          </div>
        )}
      </div>

      {!webConfigurada && (
        <p className="text-xs text-muted mb-3">
          La conexión con geekstore.com.co está desactivada: falta configurar la clave de la web
          (VITE_GEEK_API_KEY).
        </p>
      )}
      {webConfigurada && (errorWeb || errorCola) && (
        <p className="text-xs text-red-300 mb-3">Web: {errorWeb || errorCola}</p>
      )}

      <input
        type="text"
        value={textoBusqueda}
        onChange={(e) => setTextoBusqueda(e.target.value)}
        placeholder="Buscar por nombre o código..."
        className="w-full max-w-md border border-line rounded-lg px-3 py-2 mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-2">
        {botonFiltro(filtroStock === 'todos', () => setFiltroStock('todos'), `Todos (${productos.length})`, 'bg-brand text-white border-brand')}
        {botonFiltro(filtroStock === 'con-stock', () => setFiltroStock('con-stock'), `Con stock (${cantidadConStock})`, 'bg-emerald-600 text-white border-emerald-600')}
        {botonFiltro(
          filtroStock === 'agotados',
          () => setFiltroStock('agotados'),
          `Agotados (${cantidadAgotados}${cantidadNegativos > 0 ? `, ${cantidadNegativos} en negativo` : ''})`,
          'bg-red-600 text-white border-red-600'
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {botonFiltro(filtroWeb === 'todos', () => setFiltroWeb('todos'), 'Todas las categorías', 'bg-brand text-white border-brand')}
        {botonFiltro(filtroWeb === 'coleccionables', () => setFiltroWeb('coleccionables'), `Coleccionables (${cantidadColeccionables})`, 'bg-brand text-white border-brand')}
        {webConfigurada &&
          botonFiltro(filtroWeb === 'en-web', () => setFiltroWeb('en-web'), `En la web (${cantidadEnWeb})`, 'bg-emerald-600 text-white border-emerald-600')}
        {webConfigurada &&
          botonFiltro(filtroWeb === 'incompleta', () => setFiltroWeb('incompleta'), `Con ficha incompleta (${cantidadIncompletas})`, 'bg-amber-600 text-white border-amber-600')}
      </div>

      {seleccion.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-panel border border-line rounded-lg px-3 py-2 text-sm">
          <span className="text-slate-200">{seleccion.size} seleccionado(s)</span>
          <button
            onClick={() => aplicarCategoria(CATEGORIA_COLECCIONABLES)}
            disabled={aplicandoCategoria}
            className="bg-brand text-white px-3 py-1 rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {aplicandoCategoria ? 'Guardando...' : 'Marcar como Coleccionables'}
          </button>
          <button
            onClick={() => aplicarCategoria('')}
            disabled={aplicandoCategoria}
            className="text-slate-300 hover:underline disabled:opacity-50"
          >
            Quitar categoría
          </button>
          <button onClick={() => setSeleccion(new Set())} className="text-muted hover:underline">
            Limpiar selección
          </button>
        </div>
      )}

      {mensaje && (
        <div
          className={`p-3 rounded-lg mb-4 text-sm max-w-2xl ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-950/40 border border-emerald-900 text-emerald-300'
              : 'bg-red-950/40 border border-red-900 text-red-300'
          }`}
        >
          {mensaje.texto}
          {mensaje.enlace && (
            <a
              href={mensaje.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 underline font-medium"
            >
              El navegador bloqueó la pestaña: haz clic aquí para abrir la ficha web
            </a>
          )}
        </div>
      )}

      {cargando ? (
        <p className="text-muted">Cargando productos...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-line bg-card">
            <thead className="bg-panel">
              <tr>
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={todosVisiblesSeleccionados}
                    onChange={alternarTodosVisibles}
                    title="Seleccionar todos los visibles"
                  />
                </th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-right">Costo prom.</th>
                <th className="p-2 text-right">P. público</th>
                <th className="p-2 text-right">P. mayorista</th>
                <th className="p-2 text-right">Stock</th>
                <th className="p-2 text-left">Garantía</th>
                {webConfigurada && <th className="p-2 text-left">Web</th>}
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((p) => {
                const stockNum = Number(p.stock) || 0
                const estado = estadoWeb[p.codigo]
                const conFicha = tieneFicha(p, estado)
                const puedePublicar = esAdmin && webConfigurada && (esColeccionable(p) || conFicha)

                return (
                  <tr key={p.codigo} className="border-t border-line align-top">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={seleccion.has(p.codigo)}
                        onChange={() => alternarSeleccion(p.codigo)}
                      />
                    </td>
                    <td className="p-2 text-muted">
                      {editando === p.codigo ? (
                        <input
                          type="text"
                          value={valores.codigo}
                          onChange={(e) => setValores({ ...valores, codigo: e.target.value })}
                          className="w-24 border border-line rounded-lg px-2 py-1"
                        />
                      ) : (
                        p.codigo
                      )}
                    </td>
                    <td className="p-2">
                      {editando === p.codigo ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={valores.nombre}
                            onChange={(e) => setValores({ ...valores, nombre: e.target.value })}
                            className="w-full min-w-[160px] border border-line rounded-lg px-2 py-1"
                          />
                          <select
                            value={valores.categoria}
                            onChange={(e) => setValores({ ...valores, categoria: e.target.value })}
                            className="w-full border border-line rounded-lg px-2 py-1 text-xs bg-panel"
                          >
                            <option value="">Sin categoría</option>
                            <option value={CATEGORIA_COLECCIONABLES}>{CATEGORIA_COLECCIONABLES}</option>
                          </select>
                        </div>
                      ) : (
                        <>
                          {p.nombre}
                          {esColeccionable(p) && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide bg-brand/20 text-brand-light px-1.5 py-0.5 rounded">
                              Coleccionable
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-2 text-right text-muted">
                      {editando === p.codigo ? (
                        <input
                          type="number"
                          value={valores.costoPromedio}
                          onChange={(e) =>
                            setValores({ ...valores, costoPromedio: e.target.value })
                          }
                          className="w-24 border border-line rounded-lg px-2 py-1 text-right"
                        />
                      ) : (
                        `$${Number(p.costoPromedio || 0).toLocaleString()}`
                      )}
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
                            className="w-24 border border-line rounded-lg px-2 py-1 text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={valores.precioMayorista}
                            onChange={(e) =>
                              setValores({ ...valores, precioMayorista: e.target.value })
                            }
                            className="w-24 border border-line rounded-lg px-2 py-1 text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={valores.stock}
                            onChange={(e) =>
                              setValores({ ...valores, stock: e.target.value })
                            }
                            className="w-20 border border-line rounded-lg px-2 py-1 text-right"
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
                            className="w-28 border border-line rounded-lg px-2 py-1"
                          />
                        </td>
                        {webConfigurada && (
                          <td className="p-2">
                            <EtiquetaWeb producto={p} estado={estado} />
                          </td>
                        )}
                        <td className="p-2 whitespace-nowrap">
                          <button
                            onClick={() => guardarEdicion(p.codigo)}
                            disabled={guardando}
                            className="text-emerald-400 text-xs font-medium hover:underline mr-2"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={cancelarEdicion}
                            className="text-muted text-xs hover:underline"
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
                        <td className="p-2 text-right">
                          {stockNum < 0 ? (
                            <span className="text-red-400 font-semibold">
                              {stockNum} (negativo)
                            </span>
                          ) : stockNum === 0 ? (
                            <span className="text-amber-400 font-medium">{stockNum}</span>
                          ) : (
                            stockNum
                          )}
                        </td>
                        <td className="p-2 text-muted">{p.garantia || '—'}</td>
                        {webConfigurada && (
                          <td className="p-2">
                            <EtiquetaWeb producto={p} estado={estado} />
                          </td>
                        )}
                        <td className="p-2 whitespace-nowrap">
                          <button
                            onClick={() => empezarEdicion(p)}
                            className="text-brand-light text-xs hover:underline"
                          >
                            Editar
                          </button>
                          {puedePublicar && (
                            <button
                              onClick={() => handlePublicar(p)}
                              disabled={publicando === p.codigo}
                              className="block mt-1 text-emerald-400 text-xs font-medium hover:underline disabled:opacity-50"
                            >
                              {publicando === p.codigo
                                ? 'Abriendo...'
                                : conFicha
                                ? 'Editar ficha web'
                                : 'Publicar en la web'}
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {listaFiltrada.length === 0 && (
            <p className="text-muted mt-4">No se encontraron productos.</p>
          )}
        </div>
      )}
    </div>
  )
}
