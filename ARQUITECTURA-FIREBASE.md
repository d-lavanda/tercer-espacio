# Arquitectura Firebase — Tercer Espacio

Este documento explica cómo se va a guardar la información real del colectivo una vez conectado a Firebase, y por qué se diseñó así. Está pensado como referencia técnica (para mí, para quien continúe el proyecto, o para ti si algún día quieres entender el porqué de una regla).

## Resumen de servicios

- **Firebase Authentication** — quién puede entrar y con qué contraseña. Reemplaza la tabla de usuarios/contraseñas en texto plano del prototipo.
- **Firestore** — la base de datos: inventario, eventos, movimientos de dinero, notas, avisos, etc.
- **Firebase Storage** — las fotos e imágenes (foto de perfil, flyers de evento, fotos de artículos).
- **Firebase Hosting** — dónde vive la página públicamente.

Los cuatro están dentro del plan gratuito de Firebase (**Spark**) para el tamaño de un colectivo — no hace falta activar facturación ni el plan de pago (**Blaze**) para nada de lo descrito aquí.

## Autenticación: usuario + contraseña, con Firebase por dentro

El sistema sigue pidiendo **usuario** y **contraseña** al entrar, igual que hoy — eso no cambia para nadie. Por dentro, Firebase Authentication solo entiende cuentas por **correo**, así que cada nombre de usuario se convierte automáticamente en un correo inventado que nadie ve ni usa para nada más:

```
kevin.admin  →  kevin.admin@tercer-espacio.local
```

Firebase se encarga de guardar la contraseña de forma segura (nunca queda en texto plano en ningún lado, ni siquiera yo puedo verla). Esto también nos da gratis, sin construir nada extra, un flujo real de "olvidé mi contraseña" por correo si en algún momento se usan correos reales en vez de este truco — por ahora seguimos con el flujo de reseteo por aprobación de administrador que ya existe, porque es el que tiene sentido para un colectivo pequeño.

### Solicitudes de registro (aprobación de admin)

Hoy, cuando alguien se registra, queda "pendiente" hasta que un admin lo aprueba, y no existe como usuario real hasta entonces. Con Firebase, la cuenta se crea de una vez (con su usuario y contraseña ya funcionando por dentro), pero queda marcada `status: "pendiente"` en su perfil. Si esa persona intenta entrar antes de ser aprobada, el sistema la reconoce, le muestra el mismo aviso de "tu cuenta está en revisión" y cierra la sesión automáticamente — para quien lo usa, se siente exactamente igual que ahora. Cuando el admin aprueba, solo se cambia ese estado a `"activo"`, sin crear nada de cero.

## Colecciones de Firestore

| Colección | Qué guarda |
|---|---|
| `users/{uid}` | Perfil de cada persona: nombre, usuario, teléfono, rol, estado (activo/pendiente), foto, permisos personalizados de Cooperador. |
| `usernames/{username}` | Solo existe para evitar usuarios duplicados (ver abajo). |
| `items/{id}` | Artículos del inventario. |
| `events/{id}` | Eventos del calendario. |
| `transactions/{id}` | Movimientos de la Billetera (ingresos/egresos). |
| `notes/{id}` | Post-its de la Pizarra. |
| `avisos/{id}` | Notificaciones de la campana (generales y dirigidas a una persona). |
| `serviceNotices/{id}` | Avisos de servicio al Administrador (y su respuesta). |
| `activityLog/{id}` | Historial de actividad. |
| `settings/app` | Un solo documento con configuración global: modo mantenimiento, su mensaje, y los textos editables de las pantallas de inicio de sesión y registro. |

### Por qué existe `usernames/{username}`

Firestore no tiene forma de decir "este campo debe ser único" como lo haría una hoja de cálculo con una columna sin duplicados. El truco estándar es: al registrarse, además de crear el perfil en `users`, se crea un documento `usernames/kevin.admin` que apunta a ese usuario. Si alguien más intenta registrarse con el mismo nombre, ese documento ya existe y el sistema lo rechaza antes de crear nada. Es un documento técnico, nunca lo vas a ver ni necesitas tocarlo.

### Notificaciones dirigidas (la respuesta del admin a un aviso de servicio)

Cada documento en `avisos` tiene un campo `targetUserId`. Si está vacío, es un aviso general (como "hay un evento nuevo") que todos pueden ver. Si tiene el id de una persona, solo esa persona puede leerlo — así la respuesta del administrador a un aviso de servicio le llega únicamente a quien lo escribió, igual que en el prototipo, pero ahora reforzado por las reglas de seguridad del propio Firebase (no solo por el diseño de la pantalla).

## Reglas de seguridad (quién puede ver y cambiar qué)

Las reglas reproducen exactamente el sistema de permisos que ya construimos (la función `can()`), pero del lado del servidor — es decir, ya no dependen de que la app se comporte bien, Firebase las hace cumplir aunque alguien intentara saltarse la pantalla:

- **Administrador**: acceso total. Es el único rol que puede crear otro Administrador (y solo puede haber uno, igual que hoy).
- **Editor**: control total sobre Inventario y Calendario. No entra a Usuarios ni Billetera.
- **Cooperador**: Inventario y Calendario según los permisos que el admin le configuró (generales o personalizados por persona) — igual que hoy.
- **Lector**: solo lectura en todo.
- **Billetera y Usuarios**: exclusivos del Administrador, sin excepción, para cualquier rol.
- Una cuenta con estado `"pendiente"` no puede leer ni escribir nada más que su propio perfil, hasta que un admin la apruebe.

El archivo `firestore.rules` (junto a este documento) tiene la versión exacta, lista para publicarse tal cual.

## Fotos y archivos (Storage)

Cada foto vive en una carpeta según a qué pertenece:

```
/users/{uid}/foto-perfil
/items/{itemId}/foto
/events/{eventId}/flyer
```

Solo se aceptan imágenes de hasta 5 MB (8 MB para flyers de evento), y solo de alguien con sesión iniciada.

## Qué significa esto para las pruebas mientras se construye

No voy a esperar a tener tu proyecto real de Firebase para avanzar: uso los **emuladores locales de Firebase** (una copia de Firestore/Authentication/Storage que corre aquí mismo, sin tocar internet ni tu cuenta) para construir y probar cada módulo. Cuando todo esté probado, conectar tu proyecto real es cuestión de pegar tus datos de configuración en un solo archivo — no se vuelve a tocar el resto del código.
