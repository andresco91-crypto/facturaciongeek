// Ticket de venta con formato para impresora térmica de 80mm.
// Se muestra oculto en pantalla y solo se activa al llamar window.print().
// El CSS @media print controla que SOLO el ticket se imprima (todo lo demás se oculta).
// IMPORTANTE: se fuerza color negro sobre fondo blanco explícitamente, sin depender
// de los estilos del tema oscuro de la app, para que sea legible en la impresora.

export default function TicketVenta({ venta }) {
  if (!venta) return null

  const fecha = venta.fecha instanceof Date ? venta.fecha : new Date()

  return (
    <div id="ticket-imprimible" className="hidden print:block">
      <div
        style={{
          width: '80mm',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '4mm',
          color: '#000',
          background: '#fff',
        }}
      >
        <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', margin: 0 }}>
          FacturacionGeek
        </p>
        <p style={{ textAlign: 'center', margin: '2px 0' }}>
          {fecha.toLocaleDateString('es-CO')} {fecha.toLocaleTimeString('es-CO')}
        </p>
        {venta.numeroFactura && (
          <p style={{ textAlign: 'center', margin: '2px 0', fontWeight: 'bold' }}>
            Factura: {venta.numeroFactura}
          </p>
        )}
        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

        {venta.items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: '4px' }}>
            <div>{item.nombre}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {item.cantidad} x ${Number(item.precioUnitario).toLocaleString()}
              </span>
              <span>
                ${(item.cantidad * item.precioUnitario).toLocaleString()}
              </span>
            </div>
          </div>
        ))}

        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>TOTAL</span>
          <span>${Number(venta.total).toLocaleString()}</span>
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

        {venta.pagos.map((pago, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ textTransform: 'capitalize' }}>{pago.metodo}</span>
            <span>${Number(pago.monto).toLocaleString()}</span>
          </div>
        ))}

        <p style={{ textAlign: 'center', marginTop: '8px' }}>¡Gracias por su compra!</p>
      </div>
    </div>
  )
}
