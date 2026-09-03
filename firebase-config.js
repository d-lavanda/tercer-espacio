/* ============================================================
   Configuración de Firebase — Tercer Espacio
   ============================================================
   Este es el ÚNICO archivo que hay que tocar para conectar el
   sistema a tu proyecto real de Firebase. No toca ningún otro
   archivo del sistema.

   Cómo conseguir estos valores:
     Firebase console → ⚙️ Configuración del proyecto → apartado
     "Tus apps" → selecciona la app web (o créala con el ícono </>)
     → "Configuración del SDK" → "Config".

   Estos valores NO son secretos: están hechos para vivir dentro
   del código de una página web pública. Lo que de verdad protege
   los datos son las reglas de seguridad (firestore.rules /
   storage.rules), no que esto esté oculto.
   ============================================================ */

const firebaseConfig = {
  apiKey: "TU-API-KEY-AQUI",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
};

/* Si el navegador no pudo cargar el SDK de Firebase (por ejemplo, sin
   conexión a internet, o algo bloqueando gstatic.com), el sistema no se
   rompe por completo: sigue mostrando la interfaz, solo que sin poder
   guardar ni leer datos reales todavía. */
let auth, db, storage, authAdmin, firebaseReady = false;

if (typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();

  /* Segunda instancia de Firebase, usada únicamente para crear cuentas
     nuevas (registro, o cuando el Administrador da de alta a alguien)
     sin cerrar la sesión de quien esté conectado en ese momento. */
  authAdmin = firebase.initializeApp(firebaseConfig, "secondary").auth();

  /* Al correr esto desde una computadora en desarrollo (por ejemplo con
     `firebase emulators:start`, que sirve la página en localhost:5000),
     el sistema se conecta solo a los emuladores locales en vez de a tu
     proyecto real — así se puede probar todo sin afectar datos reales.
     Para forzarlo manualmente en cualquier otro caso, abre la página
     agregando ?emulators=1 al final del link. */
  const USE_EMULATORS =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    new URLSearchParams(location.search).get("emulators") === "1";

  if (USE_EMULATORS) {
    auth.useEmulator("http://localhost:9099", { disableWarnings: true });
    authAdmin.useEmulator("http://localhost:9099", { disableWarnings: true });
    db.useEmulator("localhost", 8080);
    storage.useEmulator("localhost", 9199);
    console.log("[Tercer Espacio] Conectado a los emuladores locales de Firebase, no al proyecto real.");
  }

  firebaseReady = true;
} else {
  console.error("[Tercer Espacio] No se pudo cargar el SDK de Firebase (revisa tu conexión a internet).");
}
