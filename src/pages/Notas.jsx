import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

function formatearFecha(fecha) {
  if (!fecha) return ''
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO')
}

export default function Notas() {
  const [texto, setTexto] = useState('')
  const [notas, setNotas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'notas'), orderBy('fecha', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setCargando(false)
    })
    return unsubscribe
  }, [])

  async function agregarNota() {
    const contenido = texto.trim()
    if (!contenido) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'notas'), {
        texto: contenido,
        fecha: serverTimestamp(),
      })
      setTexto('')
    } catch (err) {
      alert('Error al guardar la nota: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrarNota(id) {
    if (!confirm('¿Borrar esta nota? Esta acción no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'notas', id))
    } catch (err) {
      alert('Error al borrar: ' + err.message)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
      agregarNota()
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Notas</h1>
      <p className="text-gray-500 text-sm mb-4">
        Espacio de escritura libre para faltantes, mercancía en préstamo, o cualquier
        pendiente que quieras dejar anotado.
      </p>

      <div className="bg-white border border-gray-200 rounded p-4 mb-6">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: Prestaron un cargador USB-C a Juan, devuelve el viernes..."
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
        />
        <button
          onClick={agregarNota}
          disabled={guardando || !texto.trim()}
          className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Agregar nota'}
        </button>
        <span className="text-xs text-gray-400 ml-2">Ctrl+Enter también funciona</span>
      </div>

      {cargando ? (
        <p className="text-gray-400">Cargando notas...</p>
      ) : notas.length === 0 ? (
        <p className="text-gray-400">No hay notas todavía.</p>
      ) : (
        <div className="space-y-2">
          {notas.map((nota) => (
            <div
              key={nota.id}
              className="bg-white border border-gray-200 rounded p-3 flex justify-between items-start gap-3"
            >
              <div>
                <p className="whitespace-pre-wrap">{nota.texto}</p>
                <p className="text-xs text-gray-400 mt-1">{formatearFecha(nota.fecha)}</p>
              </div>
              <button
                onClick={() => borrarNota(nota.id)}
                className="text-red-500 text-xs hover:underline whitespace-nowrap"
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
