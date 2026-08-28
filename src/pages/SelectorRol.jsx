import { useState } from 'react'
import { useRole } from '../hooks/useRole'

export default function SelectorRol() {
  const { intentarEntrarComoAdmin, intentarEntrarComoTrabajador } = useRole()
  const [rolPendiente, setRolPendiente] = useState(null) // null | 'admin' | 'trabajador'
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleIntentar(e) {
    e.preventDefault()
    const exito =
      rolPendiente === 'admin'
        ? intentarEntrarComoAdmin(pin)
        : intentarEntrarComoTrabajador(pin)

    if (!exito) {
      setError('PIN incorrecto.')
      setPin('')
    }
  }

  function volver() {
    setRolPendiente(null)
    setPin('')
    setError('')
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

        {!rolPendiente ? (
          <div className="space-y-3">
            <button
              onClick={() => setRolPendiente('admin')}
              className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-dark font-medium"
            >
              Administrador
            </button>
            <button
              onClick={() => setRolPendiente('trabajador')}
              className="w-full bg-panel text-slate-200 py-3 rounded-lg hover:bg-line border border-line font-medium"
            >
              Trabajador
            </button>
          </div>
        ) : (
          <form onSubmit={handleIntentar}>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Ingresa el PIN de {rolPendiente === 'admin' ? 'administrador' : 'trabajador'}
            </label>
            <input
              type="password"
              inputMode="text"
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
              onClick={volver}
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
