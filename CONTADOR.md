# Contador general de planillas controladas

La página muestra cuántas planillas se controlaron: en total, cuántas dieron **OK**, cuántas **con errores** y cuántas **con avisos**.

- **Sin configurar nada**, cada navegador ve solo las que controló él.
- **Para ver el total de todas las empresas** hace falta un lugar donde sumar. GitHub Pages solo sirve archivos, así que se usa una planilla de Google (gratis), que además te queda como registro.

Lo único que se envía es el resultado (ok / errores / avisos), una "huella" del archivo (para no contar dos veces la misma planilla) y la versión de la página. **El Excel, la obra y la empresa no se envían.**

## Configurarlo (una sola vez, unos 5 minutos)

1. En Google Drive: **Nuevo → Hojas de cálculo de Google**. Llamala, por ejemplo, «Contador autocontrol».
2. En esa planilla: **Extensiones → Apps Script**.
3. Borrá lo que aparece y pegá todo el contenido del archivo `contador-google.gs`. Guardá (ícono del disquete).
4. Arriba a la derecha: **Implementar → Nueva implementación**.
   - Tipo (engranaje): **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - **Implementar**. Google pide autorizar: elegí tu cuenta → *Configuración avanzada* → *Ir a … (no seguro)* → *Permitir*. (Es tu propio script; el aviso sale porque Google no lo revisó.)
5. Copiá la **URL de la aplicación web** (termina en `/exec`).
6. En GitHub, en el repositorio de la página: abrí `config.js` → lápiz (*Edit this file*) → pegá la URL entre las comillas:
   `window.CONTADOR_URL = 'https://script.google.com/macros/s/…/exec';` → **Commit changes**.
7. En uno o dos minutos la página muestra «Planillas controladas con esta página». En la planilla de Google, la hoja «Registro» va sumando una fila por control.

Si algún día cambiás el código del script, hacé **Implementar → Gestionar implementaciones → editar → Versión: nueva**, así la URL sigue siendo la misma.

## Contador de visitas (oculto)

Además de las planillas, la página cuenta **cuántas veces se la abre**, sin mostrarlo en pantalla. Se manda solo un código
al azar que se genera en cada navegador (no identifica a nadie) y la versión de la página; una visita por sesión.

**Cómo verlo:** abrí la planilla de Google «Contador autocontrol» (en Drive). Hay dos hojas nuevas:
- **Resumen**: visitas totales, visitantes distintos, visitas de hoy, de los últimos 7 y 30 días, y planillas controladas.
- **Visitas**: una fila por visita, con fecha y hora.

**Si ya tenías el contador funcionando**, actualizá el script una sola vez: en la planilla, *Extensiones → Apps Script*,
reemplazá todo por el nuevo `contador-google.gs`, guardá, y luego *Implementar → Gestionar implementaciones → ✏️ editar →
Versión: Nueva versión → Implementar*. La URL no cambia, así que `config.js` no se toca. Las hojas «Visitas» y «Resumen»
aparecen solas con la primera visita.
