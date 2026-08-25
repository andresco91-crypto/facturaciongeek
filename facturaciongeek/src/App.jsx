import { Routes, Route, Link } from 'react-router-dom'

function Placeholder({ title }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-gray-500 mt-2">Módulo en construcción.</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white p-4 flex gap-4">
        <Link to="/">Ventas</Link>
        <Link to="/compras">Compras</Link>
        <Link to="/inventario">Inventario</Link>
        <Link to="/caja">Caja</Link>
        <Link to="/reportes">Reportes</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Placeholder title="Punto de Venta" />} />
        <Route path="/compras" element={<Placeholder title="Compras" />} />
        <Route path="/inventario" element={<Placeholder title="Inventario" />} />
        <Route path="/caja" element={<Placeholder title="Caja" />} />
        <Route path="/reportes" element={<Placeholder title="Reportes" />} />
      </Routes>
    </div>
  )
}
