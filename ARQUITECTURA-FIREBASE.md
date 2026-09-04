# Arquitectura Firebase — Tercer Espacio

Este documento explica cómo se va a guardar la información real del colectivo una vez conectado a Firebase, y por qué se diseñó así. Está pensado como referencia técnica (para mí, para quien continúe el proyecto, o para ti si algún día quieres entender el porqué de una regla).

## Resumen de servicios

- **Firebase Authentication** — quién puede entrar y con qué contraseña. Reemplaza la tabla de usuarios/contraseñas en texto plano del prototipo.
- **Firestore** — la base de datos: inventario, eventos, movimientos de dinero, notas, avisos, etc.
- **Firebase Storage** — las fotos e imágenes (foto de perfil, flyers de evento, fotos de artículos). **Pausado por ahora**: Google cambió la regla en 2024 y ya exige el plan de pago Blaze (con tarjeta, aunque el uso normal de un colectivo chico se queda en $0) para poder usarlo. Mientras tanto las fotos de perfil se guardan directo en el perfil de Firestore (ver más abajo); items y eventos no tienen foto todavía.
- **Firebase Hosting** — dónde vive la página públicamente. De momento la página está publicada en GitHub Pages en vez de Firebase Hosting (no necesita nada adicional de tu parte); se puede mover a Firebase Hosting más adelante sin cambiar el código.

Authentication y Firestore están dentro del plan gratuito de Firebase (**Spark**) para el tamaño de un colectivo — no hace falta facturación para esas dos. Storage es la excepción, explicada arriba.

## Autenticación: usuario + contraseña, con Firebase por dentro

El sistema sigue pidiendo **usuario** y **contraseña** al entrar, igual que hoy — eso no cambia para nadie. Por dentro, Firebase Authentication solo entiende cuentas por **correo**, así que cada nombre de usuario se convierte automáticamente en un correo inventado que nadie ve ni usa para nada más:

```
kevin.admin  →  kevin.admin@tercer-espacio.local
```

Firebase se encarga de guardar la contraseña de forma segura (nunca queda en texto plano en ningún lado, ni siquiera yo puedo verla).

### Restablecer contraseña (limitación real, y cómo se resolvió)

Como el correo de cada quien es inventado (nadie lo revisa), el "te mandamos un correo para restablecer tu contraseña" de Firebase no sirve aquí. Y como este sistema no tiene servidor propio (es una página que vive sola, sin backend), tampoco hay forma de que el código cambie automáticamente la contraseña de otra persona — eso solo lo puede hacer alguien con acceso a la consola de Firebase.

Por eso el flujo quedó así: cuando alguien pide restablecer su contraseña, la solicitud se guarda (colección `passwordResetRequests`) y el Administrador la ve en Usuarios, igual que antes. Pero en vez de generar una contraseña temporal automáticamente, el botón le indica al Administrador que entre a Firebase console → Authentication → Users, busque a esa persona por su usuario, y desde ahí genere el restablecimiento. Es un paso manual extra (unos 30 segundos), pero solo pasa cuando alguien de verdad olvida su contraseña — no en el uso diario.

### Solicitudes de registro (aprobación de admin)

Hoy, cuando alguien se registra, queda "pendiente" hasta que un admin lo aprueba, y no existe como usuario activo hasta entonces. Con Firebase, la cuenta de acceso (usuario + contraseña) se crea de una vez, pero su perfil queda marcado `status: "pendiente"` **y sin rol todavía** — el rol lo sigue eligiendo el admin al momento de aceptar la solicitud, exactamente como hoy. Si esa persona intenta entrar antes de ser aprobada, el sistema la reconoce, le muestra el mismo aviso de "tu cuenta está en revisión" y no la deja pasar. Cuando el admin aprueba, se le asigna el rol elegido y su estado pasa a `"activo"`.

### El primer Administrador (arranque de un proyecto nuevo)

Un proyecto de Firebase recién creado no tiene ningún usuario todavía — y para aprobar solicitudes hace falta que exista al menos un Administrador. Por eso hay una única excepción a la regla de "todo registro queda pendiente": si nadie se ha registrado nunca en el proyecto, la primera cuenta que se crea se activa sola, directamente como Administrador. En cuanto eso pasa, la puerta se cierra para siempre (se marca `settings/app.adminBootstrapped = true`) y cualquier registro después de ese sigue el flujo normal de aprobación. Esto es lo que te va a permitir crear tu primera cuenta real usando la misma pantalla de "Registrarme" que ya conoces, sin que yo tenga que tocar nada de tu proyecto por fuera.

### El segundo Administrador (como máximo uno más)

Además de tu cuenta original, el Administrador puede nombrar a **un** integrante más como Administrador desde Usuarios (el `<select>` de rol de cualquier persona ya activa ofrece "Administrador" como opción). Es la única forma de crear un Administrador nuevo después del arranque — nadie puede auto-asignarse el rol, ni siquiera registrándose de nuevo.

El cupo se controla con `settings/app.secondAdminUid`: guarda el uid de esa segunda persona, o `null` si todavía no se asignó a nadie.

- **Nombrar**: al elegir "Administrador" para alguien, el sistema pide confirmación aparte (por el peso de la acción) y, si el cupo está libre, escribe en un mismo lote (batch) su nuevo rol *y* `secondAdminUid`. Las reglas de seguridad verifican, de forma atómica, que el cupo seguía libre justo antes — así dos nombramientos a la vez nunca podrían dejar tres Administradores.
- **Quitar**: solo se puede quitar el rol al segundo Administrador (nunca a tu cuenta original, que sigue protegida igual que siempre — su fila en Usuarios no se puede tocar desde ahí). Al hacerlo, el mismo lote limpia `secondAdminUid` de vuelta a `null`, liberando el cupo para nombrar a alguien más adelante si hace falta.
- Como con el arranque, `settings/app.adminBootstrapped` queda protegido para que ningún Administrador (ni por error) pueda desmarcarlo y reabrir la puerta de auto-nombrarse admin al registrarse — eso rompería el límite de "como máximo dos Administradores en total".

## Colecciones de Firestore

| Colección | Qué guarda |
|---|---|
| `users/{uid}` | Perfil completo y privado de cada persona: nombre, usuario, teléfono, rol, estado (activo/pendiente), foto, permisos personalizados de Cooperador, si su sesión fue cerrada remotamente. Solo lo puede leer la propia persona o cualquier integrante ya activo. |
| `usernames/{username}` | Directorio público (ver abajo): evita usuarios duplicados y permite la vista previa en la pantalla de login. |
| `passwordResetRequests/{id}` | Solicitudes de "olvidé mi contraseña", pendientes de que el admin las atienda a mano (ver arriba). |
| `items/{id}` | Artículos del inventario. |
| `counters/inventario` | Un solo documento con el último número usado de cada código de artículo (TE-AUD-001, etc.), por departamento. Se actualiza con una transacción de Firestore al dar de alta un artículo, para que dos altas al mismo tiempo nunca puedan terminar con el mismo código. |
| `loans/{id}` | Préstamos de equipo de la Mochila (artículo + cantidad, ligados o no a un evento). |
| `events/{id}` | Eventos del calendario. |
| `transactions/{id}` | Movimientos de la Billetera (ingresos/egresos). |
| `notes/{id}` | Post-its de la Pizarra. |
| `avisos/{id}` | Notificaciones de la campana (generales y dirigidas a una persona). |
| `serviceNotices/{id}` | Avisos de servicio al Administrador (y su respuesta). |
| `activityLog/{id}` | Historial de actividad. |
| `settings/app` | Un solo documento con configuración global: permisos generales de Cooperador, modo mantenimiento y su mensaje, los textos editables de las pantallas de inicio de sesión y registro, si ya existe un Administrador (`adminBootstrapped`) y el uid del segundo Administrador si hay uno asignado (`secondAdminUid`). Es información pública (se lee sin haber iniciado sesión) para que la propia pantalla de login ya muestre el modo mantenimiento y los textos que puso el Administrador. |

### Por qué existe `usernames/{username}`, y por qué es público

Firestore no tiene forma de decir "este campo debe ser único" como lo haría una hoja de cálculo con una columna sin duplicados. El truco estándar es: al registrarse, además de crear el perfil en `users`, se crea un documento `usernames/kevin.admin` que apunta a ese usuario. Si alguien más intenta registrarse con el mismo nombre, ese documento ya existe y el sistema lo rechaza antes de crear nada.

Este documento también es el que permite la vista previa del login (el avatar y nombre que aparecen mientras escribes tu usuario, antes de iniciar sesión) — por eso, a diferencia del perfil completo en `users`, cualquiera puede leerlo sin haber iniciado sesión. Solo guarda lo que ya era visible en esa pantalla en el prototipo original: nombre, rol, foto y si la cuenta sigue pendiente de aprobación. Nunca guarda teléfono, contraseña ni nada más.

### Notificaciones dirigidas (la respuesta del admin a un aviso de servicio)

Cada documento en `avisos` tiene un campo `targetUserId`. Si está vacío, es un aviso general (como "hay un evento nuevo") que todos pueden ver. Si tiene el id de una persona, solo esa persona puede leerlo — así la respuesta del administrador a un aviso de servicio le llega únicamente a quien lo escribió, igual que en el prototipo, pero ahora reforzado por las reglas de seguridad del propio Firebase (no solo por el diseño de la pantalla).

## Reglas de seguridad (quién puede ver y cambiar qué)

Las reglas reproducen exactamente el sistema de permisos que ya construimos (la función `can()`), pero del lado del servidor — es decir, ya no dependen de que la app se comporte bien, Firebase las hace cumplir aunque alguien intentara saltarse la pantalla:

- **Administrador**: acceso total. Es el único rol que puede nombrar Administradores nuevos, y como máximo puede haber uno más además de la cuenta original (ver "El segundo Administrador" arriba).
- **Editor**: control total sobre Inventario y Calendario. No entra a Usuarios ni Billetera.
- **Cooperador**: Inventario y Calendario según los permisos que el admin le configuró (generales o personalizados por persona) — igual que hoy.
- **Lector**: solo lectura en todo.
- **Mochila** (`loans`): hereda exactamente los mismos permisos que Inventario — quien puede editar el inventario puede agregar o quitar préstamos, quien puede eliminar en inventario puede quitarlos de la Mochila.
- **Pizarra** (`notes`): cualquier cuenta activa puede dejar una nota; solo se puede quitar la propia, o cualquiera si eres Administrador.
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
