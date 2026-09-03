# Tercer Espacio

Sistema interno del colectivo para gestionar inventario, calendario de eventos, billetera y usuarios.

## Estado actual

Este repositorio ya está preparado para conectarse a un proyecto real de Firebase: incluye las reglas de seguridad, la configuración de Firebase Hosting y el archivo `firebase-config.js` donde se pegan las credenciales de tu proyecto. Léelo junto con `ARQUITECTURA-FIREBASE.md`, que explica el diseño completo.

Por ahora, la conexión real entre la interfaz (`index.html`) y Firestore/Authentication todavía se está construyendo módulo por módulo — mientras tanto, los datos siguen viviendo en memoria del navegador como en el prototipo original (se reinician al recargar). Cada módulo se irá conectando y probando por separado; este README se actualiza según avanza.

## Cómo abrirlo

Para probarlo tal cual, sin ninguna configuración: abre `index.html` directamente en un navegador (Chrome, Firefox, Edge). No requiere instalación ni servidor.

Para desarrollarlo con los emuladores de Firebase (recomendado antes de tocar datos reales):

```bash
npm install -g firebase-tools   # si no lo tienes
firebase emulators:start
```

Y abre `http://localhost:5000`. El sistema detecta automáticamente que está corriendo en local y se conecta a los emuladores en vez de a tu proyecto real (ver `firebase-config.js`).

## Estructura

- `index.html` — el sistema completo (HTML, CSS y JavaScript en un solo archivo).
- `firebase-config.js` — el único archivo que hay que editar para conectar tu proyecto real de Firebase (credenciales del SDK).
- `firebase.json`, `.firebaserc` — configuración de Firebase Hosting, Firestore y Storage, y de los emuladores locales.
- `firestore.rules`, `storage.rules` — reglas de seguridad: quién puede leer y escribir cada cosa.
- `firestore.indexes.json` — índices de Firestore (vacío por ahora; Firebase avisa si hace falta alguno según se usen las consultas).
- `ARQUITECTURA-FIREBASE.md` — explicación completa del diseño: qué guarda cada colección, cómo funciona el inicio de sesión, y por qué se tomó cada decisión de seguridad.
- `tests/` — scripts de verificación automatizados (Playwright) usados durante el desarrollo para confirmar que cada función sigue trabajando después de cada cambio. No son necesarios para usar el sistema, solo para seguir desarrollándolo con confianza.

## Publicarlo (una vez que tu proyecto de Firebase esté listo)

```bash
firebase login
firebase use --add          # elige tu proyecto la primera vez
firebase deploy
```

## Próximos pasos

1. Conectar Authentication y la sección de Usuarios a Firestore (en construcción).
2. Conectar el resto de los módulos (Inventario, Calendario, Billetera, Pizarra, Avisos, Panel admin, Historial).
3. Probar todo con datos reales y publicar la versión conectada donde el colectivo pueda usarla desde cualquier dispositivo.
