/* worker.js — corre Python (Pyodide) en segundo plano, para que la página no se congele mientras controla.
   Usa el mismo código de control que el programa del organismo (codigo.zip). Nada sale del navegador. */
importScripts('pyodide/pyodide.js');

let py = null;
let lineaPendiente = '';
const BARRA = /^(.*?)\s*\[[#\-]+\]\s*(\d{1,3})%/;

function avisar(paso, pct) { postMessage({ tipo: 'progreso', paso, pct }); }

function salida(texto) {
  // el código imprime barras de progreso ("... [####----] 40% (2/5)") con \r: se convierten en avance real
  for (const parte of texto.split(/(\r|\n)/)) {
    if (parte === '\r' || parte === '\n') {
      const t = lineaPendiente.trim();
      lineaPendiente = '';
      if (!t || /^[=#-]/.test(t)) continue;
      const m = t.match(BARRA);
      if (m) avisar(m[1].trim() || 'Controlando…', parseInt(m[2], 10));
      else if (t.startsWith('>>> ')) avisar(t.slice(4), null);
      else if (/página\s+\d+\s*\/\s*\d+/i.test(t)) {
        const p = t.match(/página\s+(\d+)\s*\/\s*(\d+)/i);
        avisar(t, Math.round(100 * p[1] / p[2]));
      } else avisar(t, null);
    } else if (parte) lineaPendiente += parte;
  }
}

async function bajar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No pude descargar ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

async function iniciar() {
  avisar('Cargando Python en el navegador (la primera vez tarda un poco más)…', 5);
  py = await loadPyodide({ indexURL: new URL('pyodide/', self.location.href).href });
  py.setStdout({ write: (buf) => { salida(new TextDecoder().decode(buf)); return buf.length; } });
  py.setStderr({ write: (buf) => buf.length });
  avisar('Cargando las librerías…', 30);
  await py.loadPackage(['cryptography', 'pillow', 'charset-normalizer', 'xlrd'], { messageCallback: () => {} });
  const ruedas = ['et_xmlfile-2.0.0-py3-none-any.whl', 'openpyxl-3.1.5-py2.py3-none-any.whl',
    'pdfminer_six-20260107-py3-none-any.whl', 'pdfplumber-0.11.10-py3-none-any.whl', 'reportlab-5.0.1-py3-none-any.whl'];
  let i = 0;
  for (const w of ruedas) {
    avisar('Cargando las librerías…', 40 + Math.round(40 * (i++) / ruedas.length));
    py.unpackArchive(await bajar('wheels/' + w), 'zip', { extractDir: '/lib/python3.12/site-packages' });
  }
  avisar('Cargando los controles…', 85);
  py.FS.mkdirTree('/app'); py.FS.mkdirTree('/datos/anexos'); py.FS.mkdirTree('/salida');
  py.unpackArchive(await bajar('codigo.zip?v=' + (self.VERSION || '')), 'zip', { extractDir: '/app' });
  await py.runPythonAsync(`import sys; sys.path.insert(0, '/app'); import web_control as wc`);
  avisar('Listo', 100);
}

function limpiarCarpeta(dir) {
  for (const f of py.FS.readdir(dir)) if (f !== '.' && f !== '..') py.FS.unlink(dir + '/' + f);
}

const acciones = {
  async iniciar() { await iniciar(); return { ok: true }; },

  async preparar({ excel, anterior, disponibles }) {
    limpiarCarpeta('/datos/anexos');
    for (const f of py.FS.readdir('/datos')) {
      if (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.xlsm')) py.FS.unlink('/datos/' + f);
    }
    const ruta = '/datos/' + excel.nombre.replace(/[\\/]/g, '_');
    py.FS.writeFile(ruta, new Uint8Array(excel.datos));
    let rutaPrev = null;
    if (anterior) {
      rutaPrev = '/datos/anterior_' + anterior.nombre.replace(/[\\/]/g, '_');
      py.FS.writeFile(rutaPrev, new Uint8Array(anterior.datos));
    }
    self.EXCEL = ruta; self.PREV = rutaPrev; self.NOMBRE = excel.nombre;
    avisar('Leyendo la planilla…', null);
    py.globals.set('ARG_EXCEL', ruta);
    py.globals.set('ARG_DISP', JSON.stringify(disponibles));
    return JSON.parse(py.runPython('wc.preparar(ARG_EXCEL, ARG_DISP)'));
  },

  async leer_pdfs({ archivos }) {
    const leidos = [];
    for (const a of archivos) {
      const ruta = '/datos/' + a.nombre.replace(/[\\/]/g, '_');
      py.FS.writeFile(ruta, new Uint8Array(a.datos));
      avisar(`Leyendo el boletín ${a.nombre}…`, 0);
      py.globals.set('ARG_PDF', ruta);
      leidos.push(JSON.parse(py.runPython('wc.leer_boletin_pdf(ARG_PDF)')));
      py.FS.unlink(ruta);
    }
    return leidos;
  },

  async analizar({ meses, anexos }) {
    // anexos: [{ym, nombre, lines}] (los incluidos en la página y los que subió la contratista)
    limpiarCarpeta('/datos/anexos');
    const rutas = [];
    for (const a of anexos) {
      const r = `/datos/anexos/${a.ym[0]}-${String(a.ym[1]).padStart(2, '0')}.json`;
      py.FS.writeFile(r, JSON.stringify({ nombre: a.nombre, lines: a.lines }));
      rutas.push(r);
    }
    avisar('Controlando la planilla…', null);
    py.globals.set('ARG_EXCEL', self.EXCEL);
    py.globals.set('ARG_RUTAS', JSON.stringify(rutas));
    py.globals.set('ARG_MESES', JSON.stringify(meses));
    py.globals.set('ARG_PREV', self.PREV);
    py.globals.set('ARG_NOMBRE', self.NOMBRE);
    return JSON.parse(py.runPython('wc.analizar(ARG_EXCEL, ARG_RUTAS, ARG_MESES, ARG_PREV, ARG_NOMBRE)'));
  },

  async pdf() {
    limpiarCarpeta('/salida');
    const ruta = py.runPython(`wc.pdf_observaciones('/salida')`);
    const datos = py.FS.readFile(ruta);
    return { nombre: ruta.split('/').pop(), datos: datos.buffer };
  },

  async copia() {
    limpiarCarpeta('/salida');
    avisar('Armando la copia del Excel con las celdas marcadas…', null);
    const ruta = py.runPython(`wc.copia_anotada('/salida')`);
    const datos = py.FS.readFile(ruta);
    return { nombre: ruta.split('/').pop(), datos: datos.buffer };
  },
};

onmessage = async (ev) => {
  const { id, tipo, datos } = ev.data;
  try {
    const resultado = await acciones[tipo](datos || {});
    const transferir = resultado && resultado.datos instanceof ArrayBuffer ? [resultado.datos] : [];
    postMessage({ tipo: 'listo', id, resultado }, transferir);
  } catch (e) {
    let msg = String(e && e.message || e);
    const m = msg.match(/(ErrorVerificacion|Error): ([^\n]+)\s*$/);
    if (m) msg = m[2];
    postMessage({ tipo: 'error', id, mensaje: msg });
  }
};
