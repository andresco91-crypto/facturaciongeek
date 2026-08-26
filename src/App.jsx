import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { CompraDraftProvider } from './hooks/useCompraDraft'
import { RoleProvider, useRole } from './hooks/useRole'
import Login from './pages/Login'
import SelectorRol from './pages/SelectorRol'
import ImportarExcel from './pages/ImportarExcel'
import Compras from './pages/Compras'
import Ventas from './pages/Ventas'
import Caja from './pages/Caja'
import Reportes from './pages/Reportes'
import Inventario from './pages/Inventario'
import HistorialVentas from './pages/HistorialVentas'
import HistorialCompras from './pages/HistorialCompras'
import Notas from './pages/Notas'

// Rutas visibles/accesibles solo para el rol administrador.
// El trabajador solo puede usar: Ventas (/), Historial ventas, Caja y Notas.
const RUTAS_SOLO_ADMIN = [
  '/compras',
  '/inventario',
  '/historial-compras',
  '/reportes',
  '/importar',
]

function RutaProtegida({ children }) {
  const { rol } = useRole()
  const location = useLocation()

  if (rol === 'trabajador' && RUTAS_SOLO_ADMIN.includes(location.pathname)) {
    return <Navigate to="/" replace />
  }
  return children
}

function AppLayout() {
  const { cerrarSesion } = useAuth()
  const { rol, cambiarUsuario } = useRole()
  const esAdmin = rol === 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white p-4 flex gap-4 items-center flex-wrap">
        <Link to="/">Ventas</Link>
        {esAdmin && <Link to="/compras">Compras</Link>}
        {esAdmin && <Link to="/inventario">Inventario</Link>}
        <Link to="/historial">Historial ventas</Link>
        {esAdmin && <Link to="/historial-compras">Historial compras</Link>}
        <Link to="/caja">Caja</Link>
        {esAdmin && <Link to="/reportes">Reportes</Link>}
        <Link to="/notas">Notas</Link>
        {esAdmin && (
          <Link to="/importar" className="text-yellow-400">
            Importar Excel
          </Link>
        )}

        <button
          onClick={cambiarUsuario}
          className="ml-auto text-sm bg-gray-700 px-3 py-1 rounded hover:bg-gray-600"
        >
          Cambiar usuario
        </button>
        <button
          onClick={cerrarSesion}
          className="text-sm bg-gray-700 px-3 py-1 rounded hover:bg-gray-600"
        >
          Cerrar sesión
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<Ventas />} />
        <Route
          path="/compras"
          element={
            <RutaProtegida>
              <Compras />
            </RutaProtegida>
          }
        />
        <Route
          path="/inventario"
          element={
            <RutaProtegida>
              <Inventario />
            </RutaProtegida>
          }
        />
        <Route path="/historial" element={<HistorialVentas />} />
        <Route
          path="/historial-compras"
          element={
            <RutaProtegida>
              <HistorialCompras />
            </RutaProtegida>
          }
        />
        <Route path="/caja" element={<Caja />} />
        <Route
          path="/reportes"
          element={
            <RutaProtegida>
              <Reportes />
            </RutaProtegida>
          }
        />
        <Route path="/notas" element={<Notas />} />
        <Route
          path="/importar"
          element={
            <RutaProtegida>
              <ImportarExcel />
            </RutaProtegida>
          }
        />
      </Routes>
    </div>
  )
}

function SeleccionDeRol() {
  const { rol } = useRole()
  if (!rol) return <SelectorRol />
  return (
    <CompraDraftProvider>
      <AppLayout />
    </CompraDraftProvider>
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

  return (
    <RoleProvider>
      <SeleccionDeRol />
    </RoleProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
