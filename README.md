# Autocontrol de la planilla de redeterminación (versión web)

Página para que las empresas controlen la planilla de una redeterminación de precios **antes de presentarla**.
Usa exactamente los mismos controles que el verificador del organismo (ítems INDEC, VAR, análisis de precios y
planilla de costos) y dice OK o qué celdas corregir. Se puede bajar el PDF con las observaciones y una copia del
Excel con las celdas marcadas.

**Todo corre en el navegador de quien la usa** (Python compilado para la web, con Pyodide): el Excel y los boletines
no se envían a ningún servidor. Por eso puede publicarse gratis en GitHub Pages, que solo sirve archivos.

## Publicarla en GitHub Pages (una sola vez)

1. Entrá a <https://github.com> con tu cuenta (o creá una gratis).
2. Arriba a la derecha: **+ → New repository**. Nombre, por ejemplo, `autocontrol-redeterminaciones`.
   Dejalo **Public** (GitHub Pages gratis necesita repositorio público) y tocá **Create repository**.
3. En el repositorio nuevo: **uploading an existing file** (o **Add file → Upload files**). Arrastrá **todo el
   contenido de esta carpeta** (los archivos y las carpetas `pyodide`, `wheels` y `anexos`; desde Chrome o Edge se
   pueden arrastrar carpetas). Abajo: **Commit changes**. Si son muchos archivos, subilos en dos o tres tandas.
4. **Settings → Pages**. En *Build and deployment*: Source **Deploy from a branch**, Branch **main** y carpeta
   **/ (root)** → **Save**.
5. Esperá uno o dos minutos y recargá esa pantalla: arriba aparece la dirección, del estilo
   `https://TU-USUARIO.github.io/autocontrol-redeterminaciones/`. Esa es la que se les pasa a las empresas.

El archivo `.nojekyll` tiene que subirse también (hace que GitHub sirva los archivos tal cual).

## Cómo la usa una empresa

1. Abre la dirección (Chrome, Edge o Firefox actualizados; en computadora, no en el celular).
2. Sube el Excel → «Controlar la planilla». La primera vez tarda un poco más (el navegador baja unos 30 MB que
   después quedan guardados).
3. Si la planilla usa un mes cuyo boletín no está incluido, la página dice cuál «INDEC Informa» bajar; lo sube ahí
   mismo y queda guardado **en su navegador** para la próxima.
4. Ve el resultado (OK / errores, celda por celda) y baja el PDF o su Excel con las celdas marcadas.

## Contador de planillas controladas

Arriba de la página se ve cuántas planillas se controlaron: total, OK, con errores y con avisos. Sin configurar nada
cuenta las de cada navegador; para el total de todas las empresas se conecta a una planilla de Google: ver
[CONTADOR.md](CONTADOR.md) (se pega una dirección en `config.js`). Al contador se envía solo el resultado, nunca el Excel.

## Mantenimiento

- **Boletines incluidos** (`anexos/`): diciembre 2024 a agosto 2026. Los meses nuevos los puede subir cada empresa
  como PDF. Para incluirlos en la página (así nadie tiene que subirlos), pedile a Claude el paquete actualizado con
  los boletines de la biblioteca del verificador y reemplazá la carpeta `anexos/`.
- **Controles** (`codigo.zip`): es el mismo código del verificador. Cuando el verificador cambie, se regenera este
  archivo y se sube reemplazando el anterior. Conviene cambiar también `VERSION` en `app.js` para que los navegadores
  no usen la versión vieja guardada.
- No reemplaza la revisión del organismo: las observaciones descartadas o los índices asignados a mano por el
  administrador del verificador no están en esta versión.
