import { useEffect, useState } from 'react'
import { estadoColaWeb, suscribirColaWeb } from '../lib/sincronizarWeb'

// Devuelve cuántos cambios están pendientes de enviar a la web y el último
// error, y se actualiza solo cada vez que la cola cambia.
export function useColaWeb() {
  const [estado, setEstado] = useState(estadoColaWeb)

  useEffect(() => {
    setEstado(estadoColaWeb())
    return suscribirColaWeb(setEstado)
  }, [])

  return estado
}
