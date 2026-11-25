/**
 * Contador del Autocontrol de redeterminaciones (Google Apps Script, pegado en una planilla de Google).
 * Guarda una fila por planilla controlada: fecha, resultado (ok / errores / avisos), huella del archivo y versión.
 * No recibe ni guarda el Excel ni datos de la obra. Ver CONTADOR.md.
 */
const HOJA = 'Registro';
const HOJA_VISITAS = 'Visitas';   // una fila por visita (oculta en la página; se ve acá, en la planilla)
const RESULTADOS = ['ok', 'errores', 'avisos'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const hoja = obtenerHoja_();
  if (p.visita === '1') registrarVisita_(p);
  if (RESULTADOS.indexOf(p.r) >= 0) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      hoja.appendRow([new Date(), p.r, String(p.h || '').replace(/[^0-9a-f]/g, '').slice(0, 16),
                      String(p.v || '').slice(0, 20)]);
    } finally {
      lock.releaseLock();
    }
    registrarHallazgos_(p);
  }
  return ContentService.createTextOutput(JSON.stringify(totales_(hoja)))
    .setMimeType(ContentService.MimeType.JSON);
}

function obtenerHoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.appendRow(['Fecha', 'Resultado', 'Huella del archivo', 'Versión de la página']);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

/** Totales: la misma planilla (misma huella) con el mismo resultado cuenta una sola vez. */
function totales_(hoja) {
  const t = { total: 0, ok: 0, errores: 0, avisos: 0 };
  const n = hoja.getLastRow();
  if (n < 2) return t;
  const vistos = {};
  hoja.getRange(2, 2, n - 1, 2).getValues().forEach(function (fila) {
    const r = fila[0], h = fila[1];
    if (RESULTADOS.indexOf(r) < 0) return;
    if (h) {
      if (vistos[r + '|' + h]) return;
      vistos[r + '|' + h] = true;
    }
    t[r]++;
    t.total++;
  });
  return t;
}

/** Visita: fecha + id anónimo del navegador + versión. Crea la hoja «Visitas» y la hoja «Resumen» la primera vez. */
function registrarVisita_(p) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA_VISITAS);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_VISITAS);
    hoja.appendRow(['Fecha', 'Visitante (id anónimo)', 'Versión de la página']);
    hoja.setFrozenRows(1);
    crearResumen_(libro);
  }
  const id = String(p.id || '').replace(/[^0-9a-f]/g, '').slice(0, 16);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    hoja.appendRow([new Date(), id, String(p.v || '').slice(0, 20)]);
  } finally {
    lock.releaseLock();
  }
}

/** Hoja «Resumen» con fórmulas: se actualiza sola. */
function crearResumen_(libro) {
  let r = libro.getSheetByName('Resumen');
  if (r) return;
  r = libro.insertSheet('Resumen', 0);
  r.getRange('A1:B6').setValues([
    ['Visitas totales', '=COUNTA(Visitas!A2:A)'],
    ['Visitantes distintos (navegadores)', '=IFERROR(COUNTUNIQUE(Visitas!B2:B),0)'],
    ['Visitas de hoy', '=COUNTIF(INDEX(INT(Visitas!A2:A),0),TODAY())'],
    ['Visitas últimos 7 días', '=COUNTIF(Visitas!A2:A,">="&(NOW()-7))'],
    ['Visitas últimos 30 días', '=COUNTIF(Visitas!A2:A,">="&(NOW()-30))'],
    ['Planillas controladas (sin repetidas)', '=IFERROR(COUNTUNIQUE(FILTER(Registro!B2:B&"|"&Registro!C2:C,Registro!B2:B<>"")),0)']
  ]);
  r.getRange('A1:A6').setFontWeight('bold');
  r.setColumnWidth(1, 280);
}

/** Una fila por error/aviso encontrado: fecha, gravedad (E=error, M=menor, A=aviso), título del control. Hoja «Hallazgos». */
function registrarHallazgos_(p) {
  const filas = String(p.e || '').slice(0, 2000).split('|').map(function (t) {
    const i = t.indexOf(':');
    return i === 1 && t.length > 2 ? [new Date(), t.charAt(0).replace(/[^EMA]/g, ''), t.slice(2)] : null;
  }).filter(function (f) { return f && f[1]; });
  if (!filas.length) return;
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName('Hallazgos');
  if (!hoja) {
    hoja = libro.insertSheet('Hallazgos');
    hoja.appendRow(['Fecha', 'Gravedad (E=error, M=menor, A=aviso)', 'Control']);
    hoja.setFrozenRows(1);
    // Ranking: cuántas veces apareció cada hallazgo (se arma solo)
    hoja.getRange('E1').setFormula('=QUERY(A2:C,"select C, B, count(C) where C is not null group by C, B order by count(C) desc label C \'Control\', B \'Gravedad\', count(C) \'Veces\'",0)');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 3).setValues(filas);
  } finally {
    lock.releaseLock();
  }
}
