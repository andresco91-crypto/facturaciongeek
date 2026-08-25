# FacturacionGeek

Sistema de facturación local (sin DIAN) para tienda de artículos geek y tecnológicos.

## Stack
- React (Vite) + Tailwind CSS
- Firebase: Firestore, Auth, Hosting
- Impresión de tickets en térmica 80mm

## Cómo continuar el desarrollo

1. Clona este repo y entra a la carpeta:
   ```bash
   git clone https://github.com/andresco91-crypto/facturaciongeek.git
   cd facturaciongeek
   ```

2. Instala dependencias:
   ```bash
   npm install
   ```

3. Copia `.env.example` a `.env.local` y llena con los datos de tu proyecto Firebase
   (Firebase Console → Configuración del proyecto → Tus apps → SDK setup and configuration):
   ```bash
   cp .env.example .env.local
   ```

4. Corre en local:
   ```bash
   npm run dev
   ```

## Estructura del proyecto
```
src/
  components/   componentes reutilizables (tablas, formularios, botones)
  pages/        vistas por módulo (Ventas, Compras, Inventario, Caja, Reportes)
  lib/          firebase.js (conexión) y schema.md (modelo de datos)
  hooks/        hooks personalizados (ej. useProductos, useCarrito)
```

## Roadmap
1. ✅ Estructura del proyecto
2. ⬜ Conexión a Firebase (Firestore, Auth, Hosting)
3. ⬜ Login simple (usuario/clave compartida)
4. ⬜ Importador de Excel → carga inicial de productos
5. ⬜ Módulo de Compras (suma stock, recalcula costo promedio ponderado)
6. ⬜ Módulo de Ventas / POS (precio público o mayorista, resta stock)
7. ⬜ Impresión de ticket térmico 80mm
8. ⬜ Caja: apertura/cierre de turno, cuadre por método de pago
9. ⬜ Reportes: ventas, compras, ganancia

Ver `src/lib/schema.md` para el modelo de datos completo de Firestore.
