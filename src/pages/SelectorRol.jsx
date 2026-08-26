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
    <div className="min-h-screen flex items-center justify-center bg-panel">
      <div className="bg-card p-8 rounded-xl shadow-xl border border-line w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center font-display font-bold text-white text-2xl">
            G
          </div>
        </div>
        <h1 className="text-xl font-display font-bold mb-6">¿Quién va a usar el sistema?</h1>

        {!mostrarPin ? (
          <div className="space-y-3">
            <button
              onClick={() => {
                setMostrarPin(true)
                setError('')
              }}
              className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-dark font-medium"
            >
              Administrador
            </button>
            <button
              onClick={entrarComoTrabajador}
              className="w-full bg-panel text-slate-200 py-3 rounded-lg hover:bg-line border border-line font-medium"
            >
              Trabajador
            </button>
          </div>
        ) : (
          <form onSubmit={handleIntentarAdmin}>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Ingresa el PIN de administrador
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              className="w-full border border-line rounded-lg px-3 py-2 mb-3 text-center text-lg tracking-widest bg-panel"
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              type="submit"
              className="w-full bg-brand text-white py-2.5 rounded-lg hover:bg-brand-dark mb-2 font-medium"
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
              className="w-full text-sm text-muted hover:underline"
            >
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
