import { createContext, useContext, useState } from 'react'

const RoleContext = createContext(null)

// El PIN de administrador se valida aquí, del lado del cliente. Es suficiente
// para evitar que un trabajador entre por error a módulos administrativos,
// pero no es un mecanismo de seguridad fuerte (el código es visible en el navegador).
const PIN_ADMINISTRADOR = '1234'

export function RoleProvider({ children }) {
  const [rol, setRol] = useState(null) // null | 'admin' | 'trabajador'

  function entrarComoTrabajador() {
    setRol('trabajador')
  }

  function intentarEntrarComoAdmin(pin) {
    if (pin === PIN_ADMINISTRADOR) {
      setRol('admin')
      return true
    }
    return false
  }

  function cambiarUsuario() {
    setRol(null)
  }

  return (
    <RoleContext.Provider
      value={{ rol, entrarComoTrabajador, intentarEntrarComoAdmin, cambiarUsuario }}
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
