import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await iniciarSesion(correo, contrasena)
    } catch (err) {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-panel">
      <form
        onSubmit={handleSubmit}
        className="bg-card p-8 rounded-xl shadow-xl border border-line w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center font-display font-bold text-white text-2xl">
            G
          </div>
        </div>
        <h1 className="text-2xl font-display font-bold mb-6 text-center">
          GEEK<span className="text-brand-light">STORE</span>
        </h1>

        <label className="block text-sm font-medium text-slate-200 mb-1">
          Correo
        </label>
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
          className="w-full border border-line rounded-lg px-3 py-2 mb-4 bg-panel focus:outline-none focus:ring-2 focus:ring-brand"
        />

        <label className="block text-sm font-medium text-slate-200 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          required
          className="w-full border border-line rounded-lg px-3 py-2 mb-4 bg-panel focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-brand text-white py-2.5 rounded-lg hover:bg-brand-dark font-medium disabled:opacity-50"
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
