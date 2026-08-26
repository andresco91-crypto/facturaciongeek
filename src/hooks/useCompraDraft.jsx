import { createContext, useContext, useState } from 'react'

const CompraDraftContext = createContext(null)

// Guarda el estado de la compra en progreso a nivel de toda la app (no del módulo Compras),
// para que si el usuario navega a Ventas y regresa, no pierda lo que ya había armado.
export function CompraDraftProvider({ children }) {
  const [items, setItems] = useState([])

  return (
    <CompraDraftContext.Provider value={{ items, setItems }}>
      {children}
    </CompraDraftContext.Provider>
  )
}

export function useCompraDraft() {
  const context = useContext(CompraDraftContext)
  if (!context) {
    throw new Error('useCompraDraft debe usarse dentro de un CompraDraftProvider')
  }
  return context
}
