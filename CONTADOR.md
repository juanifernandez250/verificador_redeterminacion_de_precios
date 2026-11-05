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
