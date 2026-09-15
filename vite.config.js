import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Guarda en caché todo lo necesario para que la app cargue sin
      // internet, siempre que se haya abierto al menos una vez con conexión.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Evita que las llamadas a Firebase intenten servirse desde caché;
        // esas ya las maneja el propio SDK de Firestore (persistencia offline).
        navigateFallbackDenylist: [/^\/__/],
      },
      manifest: {
        name: 'FacturacionGeek',
        short_name: 'GeekStore',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0e1a',
        theme_color: '#2f6fed',
      },
    }),
  ],
})
