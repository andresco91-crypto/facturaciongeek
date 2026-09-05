import { useState, useEffect, useRef } from 'react'

// Horas del día (formato 24h) en las que debe aparecer el recordatorio
// de hacer un arqueo de caja y verificar que todo esté en orden.
const HORAS_RECORDATORIO = ['15:30', '17:30', '19:30']

export function useRecordatorioCaja() {
  const [recordatorioActivo, setRecordatorioActivo] = useState(null) // null | 'HH:MM'
  const mostradosHoyRef = useRef(new Set())

  useEffect(() => {
    function verificar() {
      const ahora = new Date()
      const hoy = ahora.toDateString()
      const horaActual =
        String(ahora.getHours()).padStart(2, '0') +
        ':' +
        String(ahora.getMinutes()).padStart(2, '0')

      for (const hora of HORAS_RECORDATORIO) {
        const clave = `${hoy}-${hora}`
        if (horaActual === hora && !mostradosHoyRef.current.has(clave)) {
          mostradosHoyRef.current.add(clave)
          setRecordatorioActivo(hora)
        }
      }
    }

    verificar()
    // Se revisa cada 20 segundos; suficiente para no pasarse del minuto exacto
    // sin recargar la página constantemente.
    const intervalo = setInterval(verificar, 20000)
    return () => clearInterval(intervalo)
  }, [])

  function cerrarRecordatorio() {
    setRecordatorioActivo(null)
  }

  return { recordatorioActivo, cerrarRecordatorio }
}
