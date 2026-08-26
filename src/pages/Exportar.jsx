import { useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from '../lib/firebase'

const COLECCIONES = [
  { nombre: 'productos', hoja: 'Productos' },
  { nombre: 'ventas', hoja: 'Ventas' },
  { nombre: 'compras', hoja: 'Compras' },
  { nombre: 'turnos', hoja: 'Turnos' },
  { nombre: 'gastos', hoja: 'Gastos' },
  { nombre: 'notas', hoja: 'Notas' },
]

// Convierte campos especiales (fechas de Firestore, arrays de items) a texto plano
// legible en una celda de Excel, en vez de objetos [Object object].
function aplanarValor(valor) {
  if (valor && typeof valor.toDate === 'function') {
    return valor.toDate().toLocaleString('es-CO')
  }
  if (Array.isArray(valor)) {
    return valor
      .map((item) =>
        typeof item === 'object' ? JSON.stringify(item) : String(item)
      )
      .join(' | ')
  }
  if (valor && typeof valor === 'object') {
    return JSON.stringify(valor)
  }
  return valor
}

function aplanarDocumento(id, data) {
  const fila = { id }
  for (const [clave, valor] of Object.entries(data)) {
    fila[clave] = aplanarValor(valor)
  }
  return fila
}

export default function Exportar() {
  const [exportando, setExportando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [mensaje, setMensaje] = useState(null)

  async function exportarTodo() {
    setExportando(true)
    setMensaje(null)
    try {
      const libro = XLSX.utils.book_new()
      let totalFilas = 0

      for (const { nombre, hoja } of COLECCIONES) {
        setProgreso(`Descargando ${nombre}...`)
        const snapshot = await getDocs(collection(db, nombre))
        const filas = snapshot.docs.map((d) => aplanarDocumento(d.id, d.data()))
        totalFilas += filas.length

        const hojaDatos =
          filas.length > 0
            ? XLSX.utils.json_to_sheet(filas)
            : XLSX.utils.aoa_to_sheet([['(sin datos)']])

        XLSX.utils.book_append_sheet(libro, hojaDatos, hoja)
      }

      const fechaArchivo = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(libro, `facturaciongeek-backup-${fechaArchivo}.xlsx`)

      setMensaje({
        tipo: 'exito',
        texto: `Exportación completa: ${totalFilas} registros en total, en ${COLECCIONES.length} hojas.`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al exportar: ' + err.message })
    } finally {
      setExportando(false)
      setProgreso('')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Exportar base de datos</h1>
      <p className="text-muted text-sm mb-6">
        Descarga un archivo Excel con todos tus datos (productos, ventas, compras, turnos,
        gastos y notas) como respaldo. Útil para guardar una copia periódica fuera del sistema.
      </p>

      <div className="bg-card border border-line rounded-xl p-6">
        <ul className="text-sm text-slate-300 mb-6 space-y-1">
          {COLECCIONES.map((c) => (
            <li key={c.nombre}>• {c.hoja}</li>
          ))}
        </ul>

        <button
          onClick={exportarTodo}
          disabled={exportando}
          className="bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-dark font-medium disabled:opacity-50"
        >
          {exportando ? progreso || 'Exportando...' : 'Exportar todo a Excel'}
        </button>

        {mensaje && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              mensaje.tipo === 'exito'
                ? 'bg-emerald-950/40 border border-emerald-900 text-emerald-300'
                : 'bg-red-950/40 border border-red-900 text-red-300'
            }`}
          >
            {mensaje.texto}
          </div>
        )}
      </div>
    </div>
  )
}
