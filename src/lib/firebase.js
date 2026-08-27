// Configuración de Firebase para FacturacionGeek
// Reemplaza estos valores con los de tu proyecto Firebase
// (Firebase Console > Configuración del proyecto > Tus apps > SDK setup)

import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// Habilita caché local (IndexedDB) para que la app siga funcionando sin internet:
// los productos ya cargados quedan disponibles, y las ventas/compras que hagas
// sin conexión se guardan localmente y se sincronizan solas al volver la señal.
// persistentMultipleTabManager permite tener la app abierta en varias pestañas
// del mismo dispositivo sin conflictos.
let db
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })
} catch (err) {
  // Si el navegador no soporta IndexedDB (ej: algunos modos incógnito),
  // usamos Firestore sin caché local como respaldo, en vez de romper la app.
  db = getFirestore(app)
}

export { db }
export const auth = getAuth(app)
export default app
