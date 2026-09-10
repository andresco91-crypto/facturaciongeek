import { useState, useEffect, useRef } from 'react'

// Horas del día (formato 24h) en las que debe aparecer el recordatorio
// de contar el efectivo y verificar que todo esté en orden.
const HORAS_RECORDATORIO = ['15:30', '17:30', '19:30']
const INTERVALO_REVISION_MS = 20000 // cada 20 segundos
const POSPONER_MINUTOS = 5

// Se guarda en localStorage (no en Firestore) para que sobreviva si el
// trabajador recarga la página: sin esto, un simple refresh olvidaba que
// ya se había confirmado el conteo y volvía a pedirlo de inmediato.
function claveHoy() {
  return 'recordatorioCaja_' + new Date().toDateString()
}

function cargarEstadoGuardado() {
  try {
    const raw = localStorage.getItem(claveHoy())
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function guardarEstado(estado) {
  try {
    localStorage.setItem(claveHoy(), JSON.stringify(estado))
  } catch {
    // Si localStorage no está disponible, el recordatorio sigue
    // funcionando en memoria durante esta sesión, solo no sobrevive a un refresh.
  }
}

export function useRecordatorioCaja() {
  const [recordatorioActivo, setRecordatorioActivo] = useState(null) // null | 'HH:MM'
  // estadoRef[hora] = { resuelto: bool, proximoIntento: timestamp }
  const estadoRef = useRef(cargarEstadoGuardado())

  useEffect(() => {
    function verificar() {
      const ahora = new Date()

      // No tiene sentido pedir el conteo de una hora que ya quedó muy atrás
      // si ya hay una hora más reciente pendiente (ej: no preguntar por las
      // 3:30 si ya son las 7:00 y la de las 7:30 está por vencer). Se busca
      // la última hora vencida y sin resolver, y las anteriores se descartan.
      let horaAMostrar = null

      for (const hora of HORAS_RECORDATORIO) {
        const entrada = estadoRef.current[hora] || {}
        if (entrada.resuelto) continue

        const [h, m] = hora.split(':').map(Number)
        const programada = new Date(ahora)
        programada.setHours(h, m, 0, 0)

        if (ahora < programada) continue // esta hora del día todavía no llega

        const proximoPermitido = entrada.proximoIntento ?? programada.getTime()
        if (ahora.getTime() >= proximoPermitido) {
          horaAMostrar = hora
        }
      }

      if (horaAMostrar) {
        const idx = HORAS_RECORDATORIO.indexOf(horaAMostrar)
        for (let i = 0; i < idx; i++) {
          const horaPrevia = HORAS_RECORDATORIO[i]
          const entradaPrevia = estadoRef.current[horaPrevia] || {}
          if (!entradaPrevia.resuelto) {
            estadoRef.current[horaPrevia] = { ...entradaPrevia, resuelto: true, omitido: true }
          }
        }

        setRecordatorioActivo(horaAMostrar)
        const entradaActual = estadoRef.current[horaAMostrar] || {}
        estadoRef.current[horaAMostrar] = {
          ...entradaActual,
          proximoIntento: ahora.getTime() + POSPONER_MINUTOS * 60 * 1000,
        }
        guardarEstado(estadoRef.current)
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

  // Marca la hora actual como confirmada: ya no vuelve a aparecer hoy,
  // ni siquiera si se recarga la página.
  function confirmarConteo() {
    if (recordatorioActivo) {
      estadoRef.current[recordatorioActivo] = {
        ...(estadoRef.current[recordatorioActivo] || {}),
        resuelto: true,
      }
      guardarEstado(estadoRef.current)
    }
    setRecordatorioActivo(null)
  }

  return { recordatorioActivo, posponerRecordatorio, confirmarConteo }
}
