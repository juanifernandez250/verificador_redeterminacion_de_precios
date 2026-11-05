/**
 * Contador del Autocontrol de redeterminaciones (Google Apps Script, pegado en una planilla de Google).
 * Guarda una fila por planilla controlada: fecha, resultado (ok / errores / avisos), huella del archivo y versión.
 * No recibe ni guarda el Excel ni datos de la obra. Ver CONTADOR.md.
 */
const HOJA = 'Registro';
const RESULTADOS = ['ok', 'errores', 'avisos'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const hoja = obtenerHoja_();
  if (RESULTADOS.indexOf(p.r) >= 0) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      hoja.appendRow([new Date(), p.r, String(p.h || '').replace(/[^0-9a-f]/g, '').slice(0, 16),
                      String(p.v || '').slice(0, 20)]);
    } finally {
      lock.releaseLock();
    }
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
