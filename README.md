# La Mansión Barber Shop

Barbería en Mosquera, Cundinamarca. El nombre, los textos y el contacto viven en `js/config.js`.

## Fotos nuevas

1. Sube las fotos originales a `assets/originales/`.
2. Si el archivo empieza por `fachada-`, `interior-`, `equipo-`, `corte-`, `producto-`, `ambiente-` o `nosotros-`, esa es su categoría.
3. Pide «procesa las fotos nuevas».

Eso ejecuta `node tools/procesar-fotos.mjs`. Genera WebP en `assets/img/fotos/`, actualiza `assets/img/fotos.json` y no vuelve a procesar una foto que no cambió. `node tools/verificar-fotos.mjs` lista las que están sin alt, sin categoría, duplicadas o muy pesadas.
