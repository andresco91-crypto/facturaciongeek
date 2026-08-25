import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

// Carga todos los productos una vez y permite buscar en memoria por nombre o código.
// Con ~1000 productos esto es rápido y evita hacer una consulta a Firestore por cada tecla.
export function useProductos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  async function recargar() {
    setCargando(true)
    const snapshot = await getDocs(collection(db, 'productos'))
    const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    setProductos(lista)
    setCargando(false)
  }

  useEffect(() => {
    recargar()
  }, [])

  function buscar(texto) {
    if (!texto || texto.trim() === '') return []
    const t = texto.toLowerCase().trim()
    return productos
      .filter(
        (p) =>
          p.nombre?.toLowerCase().includes(t) ||
          p.codigo?.toLowerCase().includes(t)
      )
      .slice(0, 15)
  }

  return { productos, cargando, buscar, recargar }
}
