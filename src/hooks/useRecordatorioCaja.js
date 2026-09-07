import { useState, useEffect, useRef } from 'react'

// Horas del día (formato 24h) en las que debe aparecer el recordatorio
// de contar el efectivo y verificar que todo esté en orden.
const HORAS_RECORDATORIO = ['15:30', '17:30', '19:30']
const INTERVALO_REVISION_MS = 20000 // cada 20 segundos
const POSPONER_MINUTOS = 5

export function useRecordatorioCaja() {
  const [recordatorioActivo, setRecordatorioActivo] = useState(null) // null | 'HH:MM'

  // slot = 'fechaDeHoy-HH:MM'. Una vez confirmado, no vuelve a aparecer hoy.
  const resueltosRef = useRef(new Set())
  // Próximo instante (timestamp) en el que cada slot puede volver a activarse.
  const proximoIntentoRef = useRef({})

  useEffect(() => {
    function verificar() {
      const ahora = new Date()
      const hoyStr = ahora.toDateString()

      for (const hora of HORAS_RECORDATORIO) {
        const slot = `${hoyStr}-${hora}`
        if (resueltosRef.current.has(slot)) continue

        const [h, m] = hora.split(':').map(Number)
        const programada = new Date(ahora)
        programada.setHours(h, m, 0, 0)

        if (ahora < programada) continue // esta hora del día todavía no llega

        const proximoPermitido = proximoIntentoRef.current[slot] ?? programada.getTime()

        if (ahora.getTime() >= proximoPermitido) {
          setRecordatorioActivo(hora)
          // Si no se resuelve, vuelve a activarse en 5 minutos
          proximoIntentoRef.current[slot] = ahora.getTime() + POSPONER_MINUTOS * 60 * 1000
          break
        }
      }
    }

    verificar()
    const intervalo = setInterval(verificar, INTERVALO_REVISION_MS)
    return () => clearInterval(intervalo)
  }, [])

  // Cierra el aviso por ahora, pero vuelve a aparecer en 5 minutos si sigue
  // sin confirmarse (el temporizador ya quedó programado en "verificar").
  function posponerRecordatorio() {
    setRecordatorioActivo(null)
  }

  // Marca la hora actual como confirmada: ya no vuelve a aparecer hoy.
  function confirmarConteo() {
    if (recordatorioActivo) {
      const hoyStr = new Date().toDateString()
      resueltosRef.current.add(`${hoyStr}-${recordatorioActivo}`)
    }
    setRecordatorioActivo(null)
  }

  return { recordatorioActivo, posponerRecordatorio, confirmarConteo }
}
