import { useState, useMemo } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useProductosCtx } from '../hooks/useProductosContext'

const TAMANO_LOTE = 400

// Quita tildes/acentos para que "muñecos" también capture "munecos" escrito sin tilde
function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function clasificar(nombre) {
  const n = normalizar(nombre)
  if (n.includes('cargador laptop') || n.includes('cargador ldsmart')) return '12 meses'
  if (n.includes('muneco') || n.includes('carro')) return ''
  return '3 meses'
}

export default function AsignarGarantias() {
  const { productos, actualizarVariosLocal } = useProductosCtx()
  const [aplicando, setAplicando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [mensaje, setMensaje] = useState(null)

  const clasificacion = useMemo(() => {
    const grupos = { '12 meses': [], '3 meses': [], '': [] }
    for (const p of productos) {
      const garantiaAsignada = clasificar(p.nombre)
      grupos[garantiaAsignada].push(p)
    }
    return grupos
  }, [productos])

  async function aplicarCambios() {
    const confirmado = confirm(
      `Esto va a sobrescribir la garantía de los ${productos.length} productos del catálogo:\n\n` +
        `• ${clasificacion['12 meses'].length} con "cargador laptop"/"cargador ldsmart" → 12 meses\n` +
        `• ${clasificacion[''].length} con "muñecos"/"carros" → en blanco\n` +
        `• ${clasificacion['3 meses'].length} restantes → 3 meses\n\n` +
        `¿Confirmas que quieres aplicar esto a todo el catálogo?`
    )
    if (!confirmado) return

    setAplicando(true)
    setMensaje(null)
    setProgreso(0)

    try {
      const cambiosPorCodigo = {}
      for (const p of productos) {
        cambiosPorCodigo[p.codigo] = { garantia: clasificar(p.nombre) }
      }

      const codigos = Object.keys(cambiosPorCodigo)
      for (let i = 0; i < codigos.length; i += TAMANO_LOTE) {
        const lote = codigos.slice(i, i + TAMANO_LOTE)
        const batch = writeBatch(db)
        for (const codigo of lote) {
          batch.update(doc(db, 'productos', codigo), cambiosPorCodigo[codigo])
        }
        await batch.commit()
        setProgreso(Math.min(i + TAMANO_LOTE, codigos.length))
      }

      actualizarVariosLocal(cambiosPorCodigo)
      setMensaje({
        tipo: 'exito',
        texto: `Garantías actualizadas en ${codigos.length} productos.`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al aplicar los cambios: ' + err.message })
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Asignar garantías masivamente</h1>
      <p className="text-muted text-sm mb-6">
        Herramienta de un solo uso: revisa la vista previa abajo antes de aplicar. Esto
        sobrescribe la garantía de <strong>todo el catálogo</strong> según estas reglas.
      </p>

      <div className="bg-card border border-line rounded-xl p-5 mb-6 space-y-3 text-sm">
        <div className="flex justify-between border-b border-line pb-2">
          <span>Nombre contiene "cargador laptop" o "cargador ldsmart" → <strong>12 meses</strong></span>
          <span className="text-brand-light font-semibold">
            {clasificacion['12 meses'].length} producto(s)
          </span>
        </div>
        <div className="flex justify-between border-b border-line pb-2">
          <span>Nombre contiene "muñecos" o "carros" → <strong>en blanco</strong></span>
          <span className="text-amber-400 font-semibold">
            {clasificacion[''].length} producto(s)
          </span>
        </div>
        <div className="flex justify-between">
          <span>El resto del catálogo → <strong>3 meses</strong></span>
          <span className="text-emerald-400 font-semibold">
            {clasificacion['3 meses'].length} producto(s)
          </span>
        </div>
      </div>

      {clasificacion['12 meses'].length > 0 && (
        <details className="mb-3 text-sm">
          <summary className="cursor-pointer text-brand-light">
            Ver ejemplos de "12 meses" ({clasificacion['12 meses'].length})
          </summary>
          <ul className="mt-2 text-muted list-disc list-inside">
            {clasificacion['12 meses'].slice(0, 15).map((p) => (
              <li key={p.codigo}>{p.nombre}</li>
            ))}
          </ul>
        </details>
      )}

      {clasificacion[''].length > 0 && (
        <details className="mb-6 text-sm">
          <summary className="cursor-pointer text-amber-400">
            Ver ejemplos de "en blanco" ({clasificacion[''].length})
          </summary>
          <ul className="mt-2 text-muted list-disc list-inside">
            {clasificacion[''].slice(0, 15).map((p) => (
              <li key={p.codigo}>{p.nombre}</li>
            ))}
          </ul>
        </details>
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
        onClick={aplicarCambios}
        disabled={aplicando || productos.length === 0}
        className="bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-dark font-medium disabled:opacity-50"
      >
        {aplicando
          ? `Aplicando... ${progreso}/${productos.length}`
          : `Aplicar a los ${productos.length} productos`}
      </button>
    </div>
  )
}
