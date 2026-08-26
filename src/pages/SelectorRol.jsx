import { useState } from 'react'
import { useRole } from '../hooks/useRole'

export default function SelectorRol() {
  const { entrarComoTrabajador, intentarEntrarComoAdmin } = useRole()
  const [mostrarPin, setMostrarPin] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleIntentarAdmin(e) {
    e.preventDefault()
    const exito = intentarEntrarComoAdmin(pin)
    if (!exito) {
      setError('PIN incorrecto.')
      setPin('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
        <h1 className="text-xl font-bold mb-6">¿Quién va a usar el sistema?</h1>

        {!mostrarPin ? (
          <div className="space-y-3">
            <button
              onClick={() => {
                setMostrarPin(true)
                setError('')
              }}
              className="w-full bg-gray-900 text-white py-3 rounded hover:bg-gray-800"
            >
              Administrador
            </button>
            <button
              onClick={entrarComoTrabajador}
              className="w-full bg-gray-100 text-gray-800 py-3 rounded hover:bg-gray-200 border border-gray-300"
            >
              Trabajador
            </button>
          </div>
        ) : (
          <form onSubmit={handleIntentarAdmin}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingresa el PIN de administrador
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-center text-lg tracking-widest"
            />
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-2 rounded hover:bg-gray-800 mb-2"
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarPin(false)
                setPin('')
                setError('')
              }}
              className="w-full text-sm text-gray-500 hover:underline"
            >
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
