import { useState } from 'react'
import * as XLSX from 'xlsx'
import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'

// Tamaño de lote: Firestore permite máximo 500 operaciones por batch
const TAMANO_LOTE = 400

export default function ImportarExcel() {
  const [archivo, setArchivo] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState([])
  const [estado, setEstado] = useState('inicial') // inicial | leyendo | listo | importando | hecho | error
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })
  const [mensajeError, setMensajeError] = useState('')
  const [resumen, setResumen] = useState(null)

  function handleArchivoSeleccionado(e) {
    const file = e.target.files[0]
    if (!file) return
    setArchivo(file)
    setEstado('leyendo')
    setMensajeError('')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const hoja = workbook.Sheets[workbook.SheetNames[0]]
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' })

        const productos = filas.map((fila) => normalizarFila(fila))
        setVistaPrevia(productos)
        setEstado('listo')
      } catch (err) {
        setMensajeError('No se pudo leer el archivo. Verifica que sea un .xlsx válido.')
        setEstado('error')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function normalizarFila(fila) {
    // Acepta las columnas tal como vienen del Excel (codigo, nombre, garantia, costo, precio1, precio2, cantidad)
    const codigo = String(fila.codigo ?? '').trim()
    const nombre = String(fila.nombre ?? '').trim()
    const costo = Number(fila.costo) || 0
    const precioPublico = Number(fila.precio1) || 0
    const precioMayorista = Number(fila.precio2) || 0
    let stock = Number(fila.cantidad) || 0
    if (stock < 0) stock = 0 // stock negativo se convierte a 0

    return {
      codigo,
      nombre,
      costoPromedio: costo,
      precioPublico,
      precioMayorista,
      stock,
      garantia: '', // se deja en blanco, se completa manualmente después
    }
  }

  async function importarAFirestore() {
    setEstado('importando')
    setProgreso({ hechos: 0, total: vistaPrevia.length })

    try {
      const productosRef = collection(db, 'productos')
      let importados = 0
      let saltados = 0

      for (let i = 0; i < vistaPrevia.length; i += TAMANO_LOTE) {
        const lote = vistaPrevia.slice(i, i + TAMANO_LOTE)
        const batch = writeBatch(db)

        for (const producto of lote) {
          if (!producto.codigo) {
            saltados++
            continue
          }
          const ref = doc(productosRef, producto.codigo)
          batch.set(ref, producto)
          importados++
        }

        await batch.commit()
        setProgreso({ hechos: Math.min(i + TAMANO_LOTE, vistaPrevia.length), total: vistaPrevia.length })
      }

      setResumen({ importados, saltados, total: vistaPrevia.length })
      setEstado('hecho')
    } catch (err) {
      setMensajeError('Error al importar a Firestore: ' + err.message)
      setEstado('error')
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Importar productos desde Excel</h1>
      <p className="text-muted mb-6">
        Carga inicial del catálogo. Solo debes hacer esto una vez.
      </p>

      {estado === 'inicial' && (
        <div className="border-2 border-dashed border-line rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleArchivoSeleccionado}
            className="block mx-auto"
          />
          <p className="text-sm text-muted mt-2">
            Columnas esperadas: codigo, nombre, garantia, costo, precio1, precio2, cantidad
          </p>
        </div>
      )}

      {estado === 'leyendo' && (
        <p className="text-muted">Leyendo archivo...</p>
      )}

      {estado === 'listo' && (
        <div>
          <p className="mb-3">
            Se encontraron <strong>{vistaPrevia.length}</strong> productos en{' '}
            <strong>{archivo?.name}</strong>. Vista previa de los primeros 5:
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-line">
              <thead className="bg-panel">
                <tr>
                  <th className="p-2 text-left">Código</th>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-right">Costo</th>
                  <th className="p-2 text-right">Precio público</th>
                  <th className="p-2 text-right">Precio mayorista</th>
                  <th className="p-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.slice(0, 5).map((p, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{p.codigo}</td>
                    <td className="p-2">{p.nombre}</td>
                    <td className="p-2 text-right">{p.costoPromedio.toLocaleString()}</td>
                    <td className="p-2 text-right">{p.precioPublico.toLocaleString()}</td>
                    <td className="p-2 text-right">{p.precioMayorista.toLocaleString()}</td>
                    <td className="p-2 text-right">{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={importarAFirestore}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark"
          >
            Importar {vistaPrevia.length} productos a Firestore
          </button>
        </div>
      )}

      {estado === 'importando' && (
        <div>
          <p className="mb-2">
            Importando... {progreso.hechos} / {progreso.total}
          </p>
          <div className="w-full bg-line rounded-full h-3">
            <div
              className="bg-brand h-3 rounded-full transition-all"
              style={{ width: `${(progreso.hechos / progreso.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {estado === 'hecho' && resumen && (
        <div className="bg-emerald-950/40 border border-emerald-900 rounded-lg p-4">
          <p className="font-semibold text-emerald-300">Importación completada</p>
          <p className="text-sm text-emerald-300 mt-1">
            {resumen.importados} productos importados
            {resumen.saltados > 0 && `, ${resumen.saltados} filas saltadas (sin código)`}
          </p>
        </div>
      )}

      {estado === 'error' && (
        <div className="bg-red-950/40 border border-red-900 rounded-lg p-4">
          <p className="text-red-300">{mensajeError}</p>
        </div>
      )}
    </div>
  )
}
