import { useState, useEffect } from 'react'
import { useTurno } from '../hooks/useTurno'
import { useGastos } from '../hooks/useGastos'

export default function Gastos() {
  const { turno, cargando: cargandoTurno } = useTurno()
  const { registrarGasto, obtenerGastosDelTurno } = useGastos()

  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [gastos, setGastos] = useState([])
  const [cargandoGastos, setCargandoGastos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    if (turno) {
      cargarGastos()
    } else {
      setGastos([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno?.id])

  async function cargarGastos() {
    setCargandoGastos(true)
    const lista = await obtenerGastosDelTurno(turno.id)
    setGastos(lista)
    setCargandoGastos(false)
  }

  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0)

  async function handleRegistrar() {
    if (!turno || !monto) return
    setGuardando(true)
    setMensaje(null)
    try {
      await registrarGasto(turno.id, monto, nota)
      setMonto('')
      setNota('')
      setMensaje({ tipo: 'exito', texto: 'Cobro de jornal registrado.' })
      cargarGastos()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al registrar: ' + err.message })
    } finally {
      setGuardando(false)
    }
  }

  if (cargandoTurno) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Gastos — Cobro de jornal</h1>

      {!turno && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-4">
          <p className="font-medium">No hay un turno de caja abierto.</p>
          <p className="text-sm mt-1">
            Ve al módulo <strong>Caja</strong> y abre un turno para poder registrar el cobro.
          </p>
        </div>
      )}

      {turno && (
        <>
          <div className="bg-white border border-gray-200 rounded p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto a cobrar
            </label>
            <input
              type="number"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="border border-gray-300 rounded px-3 py-2 w-40 mb-3"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nota (opcional)
            </label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="ej: jornal del día"
              className="border border-gray-300 rounded px-3 py-2 w-full mb-3"
            />

            <button
              onClick={handleRegistrar}
              disabled={guardando || !monto}
              className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {guardando ? 'Registrando...' : 'Registrar cobro'}
            </button>
          </div>

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

          <h2 className="font-semibold mb-2">Cobros de este turno</h2>
          {cargandoGastos ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : gastos.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin cobros registrados aún.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded divide-y">
              {gastos.map((g) => (
                <div key={g.id} className="p-3 flex justify-between text-sm">
                  <span>{g.nota || g.concepto}</span>
                  <span className="font-medium">${Number(g.monto).toLocaleString()}</span>
                </div>
              ))}
              <div className="p-3 flex justify-between text-sm font-semibold bg-gray-50">
                <span>Total gastos del turno</span>
                <span>${totalGastos.toLocaleString()}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
