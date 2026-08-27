import { useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import {
  ShoppingCart,
  Truck,
  Package,
  History,
  FileClock,
  Wallet,
  BarChart3,
  StickyNote,
  FileSpreadsheet,
  Download,
  TrendingUp,
  CreditCard,
  LayoutDashboard,
  RotateCcw,
  ShieldCheck,
  Menu,
  LogOut,
  Users,
  UserCircle,
} from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { CompraDraftProvider } from './hooks/useCompraDraft'
import { ProductosProvider } from './hooks/useProductosContext'
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
import Exportar from './pages/Exportar'
import SugerenciaCompra from './pages/SugerenciaCompra'
import VentasCredito from './pages/VentasCredito'
import Dashboard from './pages/Dashboard'
import Devoluciones from './pages/Devoluciones'
import AsignarGarantias from './pages/AsignarGarantias'

const RUTAS_SOLO_ADMIN = [
  '/compras',
  '/inventario',
  '/historial-compras',
  '/reportes',
  '/importar',
  '/exportar',
  '/sugerencia-compra',
  '/ventas-credito',
  '/dashboard',
]

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard, admin: true },
  { to: '/', label: 'Ventas', icon: ShoppingCart, admin: false },
  { to: '/compras', label: 'Compras', icon: Truck, admin: true },
  { to: '/inventario', label: 'Inventario', icon: Package, admin: true },
  { to: '/historial', label: 'Historial ventas', icon: History, admin: false },
  { to: '/historial-compras', label: 'Historial compras', icon: FileClock, admin: true },
  { to: '/caja', label: 'Caja', icon: Wallet, admin: false },
  { to: '/devoluciones', label: 'Devoluciones y cambios', icon: RotateCcw, admin: false },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, admin: true },
  { to: '/notas', label: 'Notas', icon: StickyNote, admin: false },
  { to: '/importar', label: 'Importar Excel', icon: FileSpreadsheet, admin: true, accent: true },
  { to: '/exportar', label: 'Exportar datos', icon: Download, admin: true },
  { to: '/sugerencia-compra', label: 'Sugerencia de compra', icon: TrendingUp, admin: true },
  { to: '/ventas-credito', label: 'Ventas Addi/Sistecrédito', icon: CreditCard, admin: true },
]

function RutaProtegida({ children }) {
  const { rol } = useRole()
  const location = useLocation()
  if (rol === 'trabajador' && RUTAS_SOLO_ADMIN.includes(location.pathname)) {
    return <Navigate to="/" replace />
  }
  return children
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-display font-bold text-white text-lg shrink-0">
        G
      </div>
      <span className="font-display font-bold text-lg tracking-tight">
        GEEK<span className="text-brand-light">STORE</span>
      </span>
    </div>
  )
}

function Sidebar({ items, location, cerrado, onNavigate }) {
  return (
    <aside
      className={`fixed md:static z-30 top-0 left-0 h-full w-64 bg-panel border-r border-line flex flex-col transition-transform duration-200 ${
        cerrado ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
      }`}
    >
      <div className="h-16 flex items-center px-5 border-b border-line md:hidden">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {items.map(({ to, label, icon: Icon, accent }) => {
          const activo = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activo
                  ? 'bg-brand/15 text-brand-light border-l-2 border-brand -ml-[2px] pl-[14px]'
                  : accent
                  ? 'text-emerald-400 hover:bg-card'
                  : 'text-slate-300 hover:bg-card hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-line flex items-center gap-2 text-xs text-muted">
        <Wallet size={16} />
        <div>
          <p className="font-medium text-slate-300">GeekStore POS</p>
          <p>Versión 1.0.0</p>
        </div>
      </div>
    </aside>
  )
}

function AppLayout() {
  const { cerrarSesion } = useAuth()
  const { rol, cambiarUsuario } = useRole()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [perfilAbierto, setPerfilAbierto] = useState(false)
  const esAdmin = rol === 'admin'

  const itemsVisibles = NAV_ITEMS.filter((item) => !item.admin || esAdmin)

  return (
    <div className="min-h-screen flex">
      {!menuAbierto ? null : (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <Sidebar
        items={itemsVisibles}
        location={location}
        cerrado={!menuAbierto}
        onNavigate={() => setMenuAbierto(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-line bg-ink/80 backdrop-blur flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuAbierto(true)}
              className="md:hidden text-slate-300 hover:text-white"
            >
              <Menu size={22} />
            </button>
            <div className="hidden md:block">
              <Logo />
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setPerfilAbierto(!perfilAbierto)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line hover:bg-card text-sm"
            >
              <UserCircle size={20} className="text-brand-light" />
              <span className="hidden sm:inline text-slate-200">
                {esAdmin ? 'Administrador' : 'Trabajador'}
              </span>
            </button>

            {perfilAbierto && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-line rounded-lg shadow-xl py-1 z-20">
                <button
                  onClick={() => {
                    setPerfilAbierto(false)
                    cambiarUsuario()
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-panel"
                >
                  <Users size={16} /> Cambiar usuario
                </button>
                <button
                  onClick={() => {
                    setPerfilAbierto(false)
                    cerrarSesion()
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-panel"
                >
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
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
            <Route path="/devoluciones" element={<Devoluciones />} />
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
            <Route
              path="/asignar-garantias"
              element={
                <RutaProtegida>
                  <AsignarGarantias />
                </RutaProtegida>
              }
            />
            <Route
              path="/exportar"
              element={
                <RutaProtegida>
                  <Exportar />
                </RutaProtegida>
              }
            />
            <Route
              path="/sugerencia-compra"
              element={
                <RutaProtegida>
                  <SugerenciaCompra />
                </RutaProtegida>
              }
            />
            <Route
              path="/ventas-credito"
              element={
                <RutaProtegida>
                  <VentasCredito />
                </RutaProtegida>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RutaProtegida>
                  <Dashboard />
                </RutaProtegida>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function SeleccionDeRol() {
  const { rol } = useRole()
  if (!rol) return <SelectorRol />
  return (
    <ProductosProvider>
      <CompraDraftProvider>
        <AppLayout />
      </CompraDraftProvider>
    </ProductosProvider>
  )
}

function AppContent() {
  const { user, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-muted">
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
