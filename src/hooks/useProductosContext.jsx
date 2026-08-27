import { createContext, useContext, useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ProductosContext = createContext(null)

// Carga el catálogo de productos UNA SOLA VEZ por sesión (no una vez por cada
// visita a Ventas/Compras/Inventario), para minimizar lecturas de Firestore
// y evitar agotar la cuota gratuita diaria. Los cambios (ventas, compras) se
// aplican directamente sobre el estado local en memoria, sin volver a leer
// toda la colección de Firestore.
export function ProductosProvider({ children }) {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    const snapshot = await getDocs(collection(db, 'productos'))
    setProductos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  useEffect(() => {
    cargar()
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

  // Aplica cambios de stock/costo en memoria sin leer Firestore de nuevo.
  // ajustes: array de { codigo, stockDelta?, nuevoStock?, nuevoCosto? }
  function aplicarAjustesLocales(ajustes) {
    setProductos((prev) => {
      const copia = [...prev]
      for (const ajuste of ajustes) {
        const idx = copia.findIndex((p) => p.codigo === ajuste.codigo)
        if (idx === -1) continue
        const actualizado = { ...copia[idx] }
        if (ajuste.stockDelta !== undefined) {
          actualizado.stock = (Number(actualizado.stock) || 0) + ajuste.stockDelta
        }
        if (ajuste.nuevoStock !== undefined) {
          actualizado.stock = ajuste.nuevoStock
        }
        if (ajuste.nuevoCosto !== undefined) {
          actualizado.costoPromedio = ajuste.nuevoCosto
        }
        copia[idx] = actualizado
      }
      return copia
    })
  }

  // Agrega un producto nuevo al estado local (ej: creado desde Compras)
  function agregarProductoLocal(producto) {
    setProductos((prev) => [...prev, producto])
  }

  // Actualiza cualquier campo de un producto en memoria (ej: tras editar en Inventario)
  function actualizarProductoLocal(codigo, cambios) {
    setProductos((prev) =>
      prev.map((p) => (p.codigo === codigo ? { ...p, ...cambios } : p))
    )
  }

  return (
    <ProductosContext.Provider
      value={{
        productos,
        cargando,
        buscar,
        recargar: cargar,
        aplicarAjustesLocales,
        agregarProductoLocal,
        actualizarProductoLocal,
      }}
    >
      {children}
    </ProductosContext.Provider>
  )
}

export function useProductosCtx() {
  const context = useContext(ProductosContext)
  if (!context) {
    throw new Error('useProductosCtx debe usarse dentro de un ProductosProvider')
  }
  return context
}
