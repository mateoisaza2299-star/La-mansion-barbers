# La Mansión Barber Shop

Barbería en Funza, Cundinamarca. El nombre, los textos y el contacto viven en `js/config.js`.

## Fotos nuevas

1. Sube las fotos originales a `assets/originales/`.
2. Si el archivo empieza por `fachada-`, `interior-`, `equipo-`, `corte-`, `producto-`, `ambiente-` o `nosotros-`, esa es su categoría.
3. Pide «procesa las fotos nuevas».

Eso ejecuta `node tools/procesar-fotos.mjs`. Genera WebP en `assets/img/fotos/`, actualiza `assets/img/fotos.json` y no vuelve a procesar una foto que no cambió. `node tools/verificar-fotos.mjs` lista las que están sin alt, sin categoría, duplicadas o muy pesadas.

## Reservas

El sitio reserva sin cuenta y con un horario por barbero. El cliente elige servicio, barbero (o el primero libre), fecha y hora, y deja nombre, celular y la autorización de datos. La cita queda en el navegador, se puede cancelar o cambiar, y la tarjeta de fidelidad se consulta con el celular. El panel (Agenda, Reservas, Barberos, Servicios, Fidelidad, Resumen y Ajustes) distingue al dueño del barbero: el barbero solo ve su agenda y su horario. La política de tratamiento de datos está en `politica-de-datos.html`. La URL y la clave pública viven solo en `negocio.supabase`. Si falta alguna, o `enPreparacion` sigue en `true`, la página no llama a Supabase.

## Activar reservas

Mientras `negocio.supabase.url` esté vacía o `negocio.enPreparacion` sea `true`, la página no llama a Supabase y la reserva en línea avisa que la agenda no está disponible.

1. En `js/config.js`, `negocio.supabase.url` es la URL del proyecto (sin barra final y sin `/rest/v1`) y `negocio.supabase.key` la clave pública. Tiene que empezar por `sb_publishable_`. No guardes la clave privada del servidor.
2. Con `negocio.enPreparacion` en `false` se encienden las reservas. `negocio.indexable` en `false` mantiene la etiqueta `noindex, nofollow` hasta pasarlo a `true`.
3. Crea el usuario del dueño en Supabase Auth y su fila en `admins` con rol `dueno`.
4. Entra por la dirección directa `admin-login.html` y carga servicios, barberos y horarios.
5. En Servicios, revisa los que estén inactivos y actívalos.
6. Ejecuta `node tools/verificar-listo.mjs`. Si falta algo, lo lista.

`node tools/pruebas-reservas.mjs` recorre la reserva y el panel contra un simulador local, sin la base real.
