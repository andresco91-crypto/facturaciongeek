import { useState, useEffect } from 'react'
import { useTurno } from '../hooks/useTurno'
import { useGastos } from '../hooks/useGastos'

export default function Caja() {
  const { turno, cargando, abrirTurno, cerrarTurno, obtenerVentasDelTurno } = useTurno()
  const { obtenerGastosDelTurno } = useGastos()

  const [montoInicial, setMontoInicial] = useState('')
  const [montoFinalEfectivo, setMontoFinalEfectivo] = useState('')
  const [resumen, setResumen] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

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
    const [ventas, gastos] = await Promise.all([
      obtenerVentasDelTurno(turno.id),
      obtenerGastosDelTurno(turno.id),
    ])

    let efectivo = 0
    let tarjeta = 0
    let transferencia = 0

    for (const venta of ventas) {
      for (const pago of venta.pagos || []) {
        if (pago.metodo === 'efectivo') efectivo += pago.monto
        else if (pago.metodo === 'tarjeta') tarjeta += pago.monto
        else if (pago.metodo === 'transferencia') transferencia += pago.monto
      }
    }

    const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0)

    setResumen({
      cantidadVentas: ventas.length,
      efectivo,
      tarjeta,
      transferencia,
      totalVentas: efectivo + tarjeta + transferencia,
      totalGastos,
    })
    setCargandoResumen(false)
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

    // El efectivo esperado ahora descuenta los cobros de jornal (gastos) del turno
    const efectivoEsperado =
      Number(turno.montoInicial) + resumen.efectivo - resumen.totalGastos
    const diferencia = Number(montoFinalEfectivo || 0) - efectivoEsperado

    try {
      await cerrarTurno(turno.id, montoFinalEfectivo, {
        efectivo: resumen.efectivo,
        tarjeta: resumen.tarjeta,
        transferencia: resumen.transferencia,
        totalGastos: resumen.totalGastos,
        diferencia,
      })
      setMontoFinalEfectivo('')
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

  if (cargando) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Caja</h1>

      {mensaje && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            mensaje.tipo === 'exito'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {!turno && (
        <div className="bg-white border border-gray-200 rounded p-6">
          <p className="text-gray-600 mb-4">
            No hay ningún turno de caja abierto. Debes abrir uno para poder registrar ventas.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto inicial en caja
          </label>
          <input
            type="number"
            min="0"
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
            placeholder="0"
            className="border border-gray-300 rounded px-3 py-2 w-48 mb-4"
          />
          <div>
            <button
              onClick={handleAbrirTurno}
              disabled={procesando}
              className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {procesando ? 'Abriendo...' : 'Abrir turno'}
            </button>
          </div>
        </div>
      )}

      {turno && (
        <div className="bg-white border border-gray-200 rounded p-6">
          <p className="text-sm text-gray-500 mb-4">
            Turno abierto con ${Number(turno.montoInicial).toLocaleString()} de base.
          </p>

          {cargandoResumen && <p className="text-gray-400 text-sm">Calculando resumen...</p>}

          {resumen && (
            <div className="mb-6">
              <p className="font-medium mb-2">
                Ventas del turno: {resumen.cantidadVentas}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Efectivo</p>
                  <p className="font-semibold">${resumen.efectivo.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Tarjeta</p>
                  <p className="font-semibold">${resumen.tarjeta.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Transferencia</p>
                  <p className="font-semibold">${resumen.transferencia.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Total ventas</p>
                  <p className="font-semibold">${resumen.totalVentas.toLocaleString()}</p>
                </div>
              </div>

              {resumen.totalGastos > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm mb-2">
                  <p className="text-orange-700">
                    Gastos del turno (cobro de jornal): −${resumen.totalGastos.toLocaleString()}
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600">
                Efectivo esperado en caja: base (${Number(turno.montoInicial).toLocaleString()}) +
                ventas en efectivo (${resumen.efectivo.toLocaleString()}) − gastos (${resumen.totalGastos.toLocaleString()}) ={' '}
                <strong>
                  $
                  {(
                    Number(turno.montoInicial) +
                    resumen.efectivo -
                    resumen.totalGastos
                  ).toLocaleString()}
                </strong>
              </p>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="font-medium mb-2">Cerrar turno</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto contado físicamente en caja (solo efectivo)
            </label>
            <input
              type="number"
              min="0"
              value={montoFinalEfectivo}
              onChange={(e) => setMontoFinalEfectivo(e.target.value)}
              placeholder="0"
              className="border border-gray-300 rounded px-3 py-2 w-48 mb-4"
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
