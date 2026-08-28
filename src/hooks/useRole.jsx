import { createContext, useContext, useState } from 'react'

const RoleContext = createContext(null)

// Los PIN se validan aquí, del lado del cliente. Son suficientes para evitar
// que alguien entre por error al rol equivocado, pero no son un mecanismo de
// seguridad fuerte (el código es visible en el navegador).
const PIN_ADMINISTRADOR = 'admin123'
const PIN_TRABAJADOR = 'geek123'

export function RoleProvider({ children }) {
  const [rol, setRol] = useState(null) // null | 'admin' | 'trabajador'

  function intentarEntrarComoAdmin(pin) {
    if (pin === PIN_ADMINISTRADOR) {
      setRol('admin')
      return true
    }
    return false
  }

  function intentarEntrarComoTrabajador(pin) {
    if (pin === PIN_TRABAJADOR) {
      setRol('trabajador')
      return true
    }
    return false
  }

  function cambiarUsuario() {
    setRol(null)
  }

  return (
    <RoleContext.Provider
      value={{
        rol,
        intentarEntrarComoAdmin,
        intentarEntrarComoTrabajador,
        cambiarUsuario,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole debe usarse dentro de un RoleProvider')
  }
  return context
}
