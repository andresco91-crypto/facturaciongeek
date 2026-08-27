import { useState, useEffect } from 'react'
import { useTurno } from '../hooks/useTurno'
import { useGastos } from '../hooks/useGastos'

export default function Caja() {
  const { turno, cargando, abrirTurno, editarMontoInicial, cerrarTurno, obtenerVentasDelTurno } = useTurno()
  const { registrarGasto } = useGastos()

  const [montoInicial, setMontoInicial] = useState('')
  const [montoJornal, setMontoJornal] = useState('')
  const [montoFinalEfectivo, setMontoFinalEfectivo] = useState('')
  const [resumen, setResumen] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [editandoBase, setEditandoBase] = useState(false)
  const [nuevaBase, setNuevaBase] = useState('')

  useEffect(() => {
    if (turno) {
      cargarResumen()
    } else {
      setResumen(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno?.id])

  async function cargarResumen() {
    setCargandoResumen(true)
    const ventas = await obtenerVentasDelTurno(turno.id)

    let efectivo = 0
    let tarjeta = 0
    let transferencia = 0
    let sistecredito = 0
    let addi = 0

    for (const venta of ventas) {
      for (const pago of venta.pagos || []) {
        if (pago.metodo === 'efectivo') efectivo += pago.monto
        else if (pago.metodo === 'tarjeta') tarjeta += pago.monto
        else if (pago.metodo === 'transferencia') transferencia += pago.monto
        else if (pago.metodo === 'sistecredito') sistecredito += pago.monto
        else if (pago.metodo === 'addi') addi += pago.monto
      }
    }

    setResumen({
      cantidadVentas: ventas.length,
      efectivo,
      tarjeta,
      transferencia,
      sistecredito,
      addi,
      totalVentas: efectivo + tarjeta + transferencia + sistecredito + addi,
    })
    setCargandoResumen(false)
  }

  async function handleGuardarBase() {
    if (!turno) return
    setProcesando(true)
    setMensaje(null)
    try {
      await editarMontoInicial(turno.id, nuevaBase, turno.montoInicial)
      setEditandoBase(false)
      setNuevaBase('')
      setMensaje({ tipo: 'exito', texto: 'Base de caja actualizada.' })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al editar la base: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  async function handleAbrirTurno() {
    setProcesando(true)
    setMensaje(null)
    try {
      await abrirTurno(montoInicial)
      setMontoInicial('')
      setMensaje({ tipo: 'exito', texto: 'Turno abierto correctamente.' })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al abrir turno: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  async function handleCerrarTurno() {
    if (!resumen) return
    setProcesando(true)
    setMensaje(null)

    const jornal = Number(montoJornal) || 0
    const efectivoEsperado = Number(turno.montoInicial) + resumen.efectivo - jornal
    const diferencia = Number(montoFinalEfectivo || 0) - efectivoEsperado

    try {
      // Si se ingresó un cobro de jornal, se registra como gasto ligado a este turno
      if (jornal > 0) {
        await registrarGasto(turno.id, jornal, 'Cobro de jornal')
      }

      await cerrarTurno(turno.id, montoFinalEfectivo, {
        efectivo: resumen.efectivo,
        tarjeta: resumen.tarjeta,
        transferencia: resumen.transferencia,
        sistecredito: resumen.sistecredito,
        addi: resumen.addi,
        totalGastos: jornal,
        diferencia,
      })
      setMontoFinalEfectivo('')
      setMontoJornal('')
      setMensaje({
        tipo: 'exito',
        texto:
          diferencia === 0
            ? 'Turno cerrado. Caja cuadrada perfectamente.'
            : diferencia > 0
            ? `Turno cerrado. Sobran $${diferencia.toLocaleString()} en caja.`
            : `Turno cerrado. Faltan $${Math.abs(diferencia).toLocaleString()} en caja.`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al cerrar turno: ' + err.message })
    } finally {
      setProcesando(false)
    }
  }

  const jornalPreview = Number(montoJornal) || 0
  const efectivoEsperadoPreview = resumen
    ? Number(turno?.montoInicial || 0) + resumen.efectivo - jornalPreview
    : 0

  if (cargando) {
    return <div className="p-6 text-muted">Cargando...</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Caja</h1>

      {mensaje && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900'
              : 'bg-red-950/40 text-red-300 border border-red-900'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {!turno && (
        <div className="bg-card border border-line rounded p-6">
          <p className="text-slate-300 mb-4">
            No hay ningún turno de caja abierto. Debes abrir uno para poder registrar ventas.
          </p>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Monto inicial en caja
          </label>
          <input
            type="number"
            min="0"
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
            placeholder="0"
            className="border border-line rounded-lg px-3 py-2 w-48 mb-4"
          />
          <div>
            <button
              onClick={handleAbrirTurno}
              disabled={procesando}
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
            >
              {procesando ? 'Abriendo...' : 'Abrir turno'}
            </button>
          </div>
        </div>
      )}

      {turno && (
        <div className="bg-card border border-line rounded p-6">
          {!editandoBase ? (
            <div className="flex items-center gap-3 mb-4">
              <p className="text-sm text-muted">
                Turno abierto con ${Number(turno.montoInicial).toLocaleString()} de base.
                {turno.edicionesBase?.length > 0 && (
                  <span className="ml-2 text-xs bg-amber-950/60 text-amber-400 px-2 py-0.5 rounded">
                    BASE EDITADA
                  </span>
                )}
              </p>
              <button
                onClick={() => {
                  setEditandoBase(true)
                  setNuevaBase(String(turno.montoInicial))
                }}
                className="text-brand-light text-xs font-medium hover:underline"
              >
                Editar base
              </button>
            </div>
          ) : (
            <div className="mb-4 bg-panel border border-line rounded-lg p-3">
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Corregir monto inicial de caja
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  value={nuevaBase}
                  onChange={(e) => setNuevaBase(e.target.value)}
                  className="border border-line rounded-lg px-3 py-2 w-40"
                  autoFocus
                />
                <button
                  onClick={handleGuardarBase}
                  disabled={procesando}
                  className="bg-brand text-white px-3 py-2 rounded-lg hover:bg-brand-dark text-sm disabled:opacity-50"
                >
                  {procesando ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditandoBase(false)}
                  className="text-muted text-sm hover:underline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {turno.edicionesBase?.length > 0 && (
            <div className="mb-4 text-xs text-muted bg-panel border border-line rounded-lg p-3">
              <p className="font-medium text-slate-300 mb-1">Historial de ediciones de base:</p>
              {turno.edicionesBase.map((ed, idx) => (
                <p key={idx}>
                  ${Number(ed.anterior).toLocaleString()} → ${Number(ed.nuevo).toLocaleString()}
                  {ed.fecha && (
                    <>
                      {' '}
                      —{' '}
                      {(ed.fecha.toDate ? ed.fecha.toDate() : new Date(ed.fecha)).toLocaleString(
                        'es-CO'
                      )}
                    </>
                  )}
                </p>
              ))}
            </div>
          )}

          {cargandoResumen && <p className="text-muted text-sm">Calculando resumen...</p>}

          {resumen && (
            <div className="mb-6">
              <p className="font-medium mb-2">
                Ventas del turno: {resumen.cantidadVentas}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mb-2">
                <div className="bg-panel rounded p-3">
                  <p className="text-muted">Efectivo</p>
                  <p className="font-semibold">${resumen.efectivo.toLocaleString()}</p>
                </div>
                <div className="bg-panel rounded p-3">
                  <p className="text-muted">Tarjeta</p>
                  <p className="font-semibold">${resumen.tarjeta.toLocaleString()}</p>
                </div>
                <div className="bg-panel rounded p-3">
                  <p className="text-muted">Transferencia</p>
                  <p className="font-semibold">${resumen.transferencia.toLocaleString()}</p>
                </div>
                <div className="bg-panel rounded p-3">
                  <p className="text-muted">Sistecrédito</p>
                  <p className="font-semibold">${resumen.sistecredito.toLocaleString()}</p>
                </div>
                <div className="bg-panel rounded p-3">
                  <p className="text-muted">Addi</p>
                  <p className="font-semibold">${resumen.addi.toLocaleString()}</p>
                </div>
                <div className="bg-panel rounded p-3">
                  <p className="text-muted">Total ventas</p>
                  <p className="font-semibold">${resumen.totalVentas.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="font-medium mb-2">Cerrar turno</p>

            <label className="block text-sm font-medium text-slate-200 mb-1">
              Cobro de jornal del trabajador (opcional)
            </label>
            <input
              type="number"
              min="0"
              value={montoJornal}
              onChange={(e) => setMontoJornal(e.target.value)}
              placeholder="0"
              className="border border-line rounded-lg px-3 py-2 w-48 mb-3"
            />
            <p className="text-xs text-muted mb-4">
              Este valor se descuenta del efectivo esperado en caja.
            </p>

            {resumen && (
              <p className="text-sm text-slate-300 mb-4">
                Efectivo esperado: base (${Number(turno.montoInicial).toLocaleString()}) +
                ventas en efectivo (${resumen.efectivo.toLocaleString()}) − jornal (${jornalPreview.toLocaleString()}) ={' '}
                <strong>${efectivoEsperadoPreview.toLocaleString()}</strong>
              </p>
            )}

            <label className="block text-sm font-medium text-slate-200 mb-1">
              Monto contado físicamente en caja (solo efectivo)
            </label>
            <input
              type="number"
              min="0"
              value={montoFinalEfectivo}
              onChange={(e) => setMontoFinalEfectivo(e.target.value)}
              placeholder="0"
              className="border border-line rounded-lg px-3 py-2 w-48 mb-4"
            />
            <div>
              <button
                onClick={handleCerrarTurno}
                disabled={procesando || !resumen}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {procesando ? 'Cerrando...' : 'Cerrar turno y cuadrar caja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
