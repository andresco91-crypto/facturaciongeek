# Modelo de datos — Firestore

## Colección: productos
| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| codigo | string | Excel: codigo | identificador único, usado como ID de documento |
| nombre | string | Excel: nombre | |
| precioPublico | number | Excel: precio1 | precio de venta al detal |
| precioMayorista | number | Excel: precio2 | precio de venta al por mayor |
| costoPromedio | number | Excel: costo | se recalcula en cada compra (promedio ponderado) |
| stock | number | Excel: cantidad | se resta en ventas, se suma en compras |

## Colección: ventas
| Campo | Tipo | Notas |
|---|---|---|
| fecha | timestamp | |
| items | array<{codigo, nombre, cantidad, precioUnitario, tipoPrecio}> | tipoPrecio: 'publico' \| 'mayorista' |
| total | number | |
| metodoPago | string | 'efectivo' \| 'tarjeta' \| 'transferencia' |
| turnoId | string | referencia al turno de caja activo |

## Colección: compras
| Campo | Tipo | Notas |
|---|---|---|
| fecha | timestamp | |
| items | array<{codigo, nombre, cantidad, costoUnitario}> | |
| total | number | |

## Colección: turnos (caja)
| Campo | Tipo | Notas |
|---|---|---|
| fechaApertura | timestamp | |
| fechaCierre | timestamp \| null | |
| montoInicial | number | |
| montoFinalEfectivo | number \| null | contado al cierre |
| totalVentasEfectivo | number | calculado |
| totalVentasTarjeta | number | calculado |
| totalVentasTransferencia | number | calculado |
| diferencia | number | montoFinalEfectivo - (montoInicial + totalVentasEfectivo) |

## Lógica clave: costo promedio ponderado (al registrar una compra)

```
nuevoCosto = ((stockActual * costoActual) + (cantidadComprada * costoNuevo))
             / (stockActual + cantidadComprada)
```
