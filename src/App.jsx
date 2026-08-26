import { Routes, Route, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import ImportarExcel from './pages/ImportarExcel'
import Compras from './pages/Compras'
import Ventas from './pages/Ventas'
import Caja from './pages/Caja'
import Reportes from './pages/Reportes'
import Inventario from './pages/Inventario'
import HistorialVentas from './pages/HistorialVentas'
import HistorialCompras from './pages/HistorialCompras'

function AppLayout() {
  const { cerrarSesion } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white p-4 flex gap-4 items-center flex-wrap">
        <Link to="/">Ventas</Link>
        <Link to="/compras">Compras</Link>
        <Link to="/inventario">Inventario</Link>
        <Link to="/historial">Historial ventas</Link>
        <Link to="/historial-compras">Historial compras</Link>
        <Link to="/caja">Caja</Link>
        <Link to="/reportes">Reportes</Link>
        <Link to="/importar" className="text-yellow-400">Importar Excel</Link>
        <button
          onClick={cerrarSesion}
          className="ml-auto text-sm bg-gray-700 px-3 py-1 rounded hover:bg-gray-600"
        >
          Cerrar sesión
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<Ventas />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/historial" element={<HistorialVentas />} />
        <Route path="/historial-compras" element={<HistorialCompras />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/importar" element={<ImportarExcel />} />
      </Routes>
    </div>
  )
}

function AppContent() {
  const { user, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando...
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return <AppLayout />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
