/* app.js — pantalla del autocontrol. El trabajo pesado lo hace worker.js (Python en el navegador). */
const VERSION = '2026-11-05';
const trabajador = new Worker('worker.js?v=' + VERSION);
let pedidos = 0;
const esperando = {};
let progresoActual = null;          // función que recibe (paso, pct)
let INDICE = [];                    // anexos incluidos en la página: [{archivo, ym, nombre}]
let PREP = null;                    // resultado de preparar()
let listo = null;                   // promesa de que Python ya cargó

trabajador.onmessage = (ev) => {
  const m = ev.data;
  if (m.tipo === 'progreso') { if (progresoActual) progresoActual(m.paso, m.pct); return; }
  const p = esperando[m.id];
  if (!p) return;
  delete esperando[m.id];
  if (m.tipo === 'listo') p.ok(m.resultado); else p.mal(new Error(m.mensaje));
};

function pedir(tipo, datos, transferir) {
  return new Promise((ok, mal) => {
    const id = ++pedidos;
    esperando[id] = { ok, mal };
    trabajador.postMessage({ id, tipo, datos }, transferir || []);
  });
}

function esc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const $ = (s) => document.querySelector(s);
const ymTxt = (ym) => ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][ym[1] - 1] + '-' + ym[0];
const ymClave = (ym) => `${ym[0]}-${String(ym[1]).padStart(2, '0')}`;

/* ---------- barra de progreso ---------- */
function mostrarProgreso(titulo) {
  $('#progreso').innerHTML = `<div class="progreso-caja">
      <div class="progreso-titulo"><span>${esc(titulo)}</span><span class="progreso-pct-total"></span></div>
      <div class="progreso-barra"><div class="progreso-relleno indeterminado" style="width:100%"></div></div>
      <div class="progreso-paso">Iniciando…</div></div>`;
  const relleno = $('#progreso .progreso-relleno'), paso = $('#progreso .progreso-paso'), pct = $('#progreso .progreso-pct-total');
  progresoActual = (t, p) => {
    if (t) paso.textContent = t;
    if (p === null || p === undefined) { relleno.classList.add('indeterminado'); relleno.style.width = '100%'; pct.textContent = ''; }
    else { relleno.classList.remove('indeterminado'); relleno.style.width = p + '%'; pct.textContent = p + '%'; }
  };
}
function ocultarProgreso() { $('#progreso').innerHTML = ''; progresoActual = null; }
function mostrarError(msg) { $('#progreso').innerHTML = `<div class="progreso-error">${esc(msg)}</div>`; progresoActual = null; bloquear(false); }
function bloquear(si) { document.querySelectorAll('#vista-inicio button').forEach(b => b.disabled = si); }

/* ---------- boletines subidos: se guardan en este navegador (IndexedDB) ---------- */
function abrirBase() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('autocontrol', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('anexos', { keyPath: 'clave' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function misAnexos() {
  try {
    const db = await abrirBase();
    return await new Promise((ok) => {
      const q = db.transaction('anexos').objectStore('anexos').getAll();
      q.onsuccess = () => ok(q.result || []);
      q.onerror = () => ok([]);
    });
  } catch (e) { return []; }
}
async function guardarAnexo(a) {
  try {
    const db = await abrirBase();
    await new Promise((ok) => {
      const t = db.transaction('anexos', 'readwrite');
      t.objectStore('anexos').put({ clave: ymClave(a.ym), ym: a.ym, nombre: a.nombre, lines: a.lines });
      t.oncomplete = ok; t.onerror = ok;
    });
  } catch (e) { /* sin almacenamiento (ventana privada): se usa solo esta vez */ }
}
async function borrarAnexo(clave) {
  try {
    const db = await abrirBase();
    await new Promise((ok) => { const t = db.transaction('anexos', 'readwrite'); t.objectStore('anexos').delete(clave); t.oncomplete = ok; });
  } catch (e) {}
  pintarInfoBoletines();
}
let SUBIDOS_ESTA_VEZ = [];          // por si el navegador no deja guardar

async function mesesDisponibles() {
  const propios = (await misAnexos()).map(a => a.ym).concat(SUBIDOS_ESTA_VEZ.map(a => a.ym));
  return INDICE.map(a => a.ym).concat(propios);
}

async function pintarInfoBoletines() {
  const propios = await misAnexos();
  const inc = INDICE.map(a => a.ym);
  $('#info-boletines').textContent = INDICE.length
    ? `Boletines incluidos en la página: ${INDICE.length} meses (${ymTxt(inc[0])} a ${ymTxt(inc[inc.length - 1])}).`
    + (propios.length ? ` Además subiste ${propios.length} en este navegador.` : '')
    : 'Sin boletines incluidos: subí los que pida tu planilla.';
  $('#det-mis-boletines').hidden = !propios.length;
  $('#mis-boletines').innerHTML = propios.sort((a, b) => a.clave.localeCompare(b.clave)).map(a =>
    `<div class="fila-boletin"><span>${esc(ymTxt(a.ym))} · ${esc(a.nombre)}</span>
      <button type="button" class="link-boton" onclick="borrarAnexo('${a.clave}')">quitar</button></div>`).join('');
}

/* ---------- flujo ---------- */
async function leerArchivo(input) {
  const f = input.files && input.files[0];
  return f ? { nombre: f.name, datos: await f.arrayBuffer() } : null;
}

$('#form-excel').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  bloquear(true);
  $('#paso-boletines').hidden = true;
  try {
    mostrarProgreso('Preparando…');
    await listo;
    const excel = await leerArchivo(ev.target.excel);
    HUELLA = await huella(excel.datos);           // antes de mandarlo al trabajador (después ya no se puede leer)
    const anterior = await leerArchivo(ev.target.anterior);
    mostrarProgreso('Leyendo la planilla…');
    const transferir = [excel.datos].concat(anterior ? [anterior.datos] : []);
    PREP = await pedir('preparar', { excel, anterior, disponibles: await mesesDisponibles() }, transferir);
    PREP.nombre = excel.nombre;
    if (PREP.faltan.length) {
      ocultarProgreso();
      $('#lista-faltan').innerHTML = PREP.faltan.map(f => `<li><b>${esc(f.mes)}</b>: ${esc(f.boletin)}</li>`).join('');
      $('#paso-boletines').hidden = false;
      bloquear(false);
    } else {
      await analizar();
    }
  } catch (e) { mostrarError(e.message); }
});

async function subirBoletinesYControlar() {
  const input = $('#pdfs');
  if (!input.files.length) { alert('Elegí el o los PDF del INDEC Informa.'); return; }
  bloquear(true);
  $('#paso-boletines').hidden = true;
  try {
    mostrarProgreso('Leyendo los boletines del INDEC (puede tardar un minuto cada uno)…');
    const archivos = [];
    for (const f of input.files) archivos.push({ nombre: f.name, datos: await f.arrayBuffer() });
    const leidos = await pedir('leer_pdfs', { archivos }, archivos.map(a => a.datos));
    const errores = [];
    for (const b of leidos) {
      if (!b.ok) { errores.push(b.error); continue; }
      SUBIDOS_ESTA_VEZ.push(b);
      await guardarAnexo(b);
    }
    pintarInfoBoletines();
    if (errores.length) alert(errores.join('\n'));
    await analizar();
  } catch (e) { mostrarError(e.message); }
}

async function anexosParaControlar() {
  // para cada mes que pide la planilla: el que subió la contratista (manda) o el incluido en la página
  const propios = {};
  for (const a of (await misAnexos()).concat(SUBIDOS_ESTA_VEZ)) propios[ymClave(a.ym)] = a;
  const out = [];
  for (const ym of PREP.meses) {
    const k = ymClave(ym);
    if (propios[k]) { out.push(propios[k]); continue; }
    const inc = INDICE.find(a => ymClave(a.ym) === k);
    if (inc) {
      const r = await fetch('anexos/' + inc.archivo);
      if (r.ok) { const d = await r.json(); out.push({ ym: inc.ym, nombre: d.nombre, lines: d.lines }); }
    }
  }
  return out;
}

async function analizar() {
  bloquear(true);
  $('#paso-boletines').hidden = true;
  try {
    mostrarProgreso('Controlando la planilla…');
    const anexos = await anexosParaControlar();
    const t0 = performance.now();
    const res = await pedir('analizar', { meses: PREP.meses, anexos });
    res.segundos_total = Math.round((performance.now() - t0) / 1000);
    ocultarProgreso();
    mostrarResultado(res);
    contar(categoria(res.veredicto));
  } catch (e) { mostrarError(e.message); }
}

/* ---------- contador de planillas controladas ----------
   Local: en este navegador (localStorage). General: si config.js trae CONTADOR_URL (Google Apps Script), se manda
   SOLO el resultado (ok / errores / avisos) y una huella del archivo para no contar dos veces el mismo; nunca el Excel. */
let HUELLA = '';
const URL_CONTADOR = (window.CONTADOR_URL || '').trim();

async function huella(buf) {
  try {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return ''; }
}

function categoria(v) {
  if (v.clase === 'error') return 'errores';
  if (v.clase === 'menor' || v.clase === 'parcial' || (v.n && v.n.AVISO)) return 'avisos';
  return 'ok';
}

function leerLocal() {
  try { return Object.assign({ ok: 0, errores: 0, avisos: 0, vistos: [] }, JSON.parse(localStorage.getItem('contador') || '{}')); }
  catch (e) { return { ok: 0, errores: 0, avisos: 0, vistos: [] }; }
}

function pintarContador(t, general) {
  if (!t) return;
  const total = t.total ?? ((t.ok || 0) + (t.errores || 0) + (t.avisos || 0));
  const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
  $('#c-total').textContent = fmt(total);
  $('#c-ok').textContent = fmt(t.ok);
  $('#c-errores').textContent = fmt(t.errores);
  $('#c-avisos').textContent = fmt(t.avisos);
  $('#contador-titulo').textContent = general ? 'Planillas controladas con esta página' : 'Planillas controladas en este navegador';
  $('#contador-nota').textContent = general
    ? 'Para este contador se envía solo el resultado (OK, con errores o con avisos). El Excel no sale de tu computadora.'
    : 'Se cuenta cada planilla distinta que controlaste en este navegador.';
  $('#contador').hidden = false;
}

async function totalesGenerales(params) {
  if (!URL_CONTADOR) return null;
  try {
    const r = await fetch(URL_CONTADOR + (params ? '?' + new URLSearchParams(params) : ''), { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

async function contar(cat) {
  const l = leerLocal();
  const clave = cat + ':' + HUELLA;
  if (!HUELLA || !l.vistos.includes(clave)) {          // la misma planilla con el mismo resultado no suma dos veces
    l[cat] = (l[cat] || 0) + 1;
    if (HUELLA) l.vistos = l.vistos.concat(clave).slice(-500);
    try { localStorage.setItem('contador', JSON.stringify(l)); } catch (e) { /* navegador sin almacenamiento */ }
  }
  const g = await totalesGenerales({ r: cat, h: HUELLA, v: VERSION });
  pintarContador(g || l, !!g);
}

async function iniciarContador() {
  const g = await totalesGenerales(null);
  if (g) pintarContador(g, true);
  else {
    const l = leerLocal();
    if (l.ok + l.errores + l.avisos > 0) pintarContador(l, false);   // vacío y sin contador general: no se muestra
  }
}

/* ---------- resultado ---------- */
function mostrarResultado(r) {
  const v = r.veredicto;
  const icono = { ok: '✔', parcial: '✔', menor: '⚠', error: '✖' }[v.clase];
  const errores = r.items.filter(x => x.gravedad === 'ERROR' || x.gravedad === 'MENOR');
  const avisos = r.items.filter(x => x.gravedad === 'AVISO');
  let h = `<div class="migas"><button type="button" class="link-boton link-azul" onclick="volver()">← Controlar otra planilla</button></div>
    <div class="veredicto veredicto-${v.clase}">
      <div class="veredicto-icono">${icono}</div>
      <div><div class="veredicto-titulo">${esc(v.titulo)}</div>
        <div class="veredicto-archivo">${esc(PREP.nombre)}${r.obra ? ' · ' + esc(r.obra) : ''}</div>
        ${v.sub.map(s => `<div class="veredicto-sub">${esc(s)}</div>`).join('')}</div>
    </div>
    <div class="botones-resultado">
      ${errores.length ? `<button type="button" onclick="bajar('pdf', this)">📕 Bajar el PDF con lo que hay que corregir</button>` : ''}
      ${r.copia && r.items.length ? `<button type="button" class="secundario" onclick="bajar('copia', this)">✏️ Bajar mi Excel con las celdas marcadas</button>` : ''}
      <button type="button" class="secundario" onclick="volver()">Controlar otra planilla</button>
    </div>
    <div id="progreso-descarga"></div>
    <h2>Cada control</h2><table>${r.controles.map(c => `<tr><td style="width:34%">${esc(c.titulo)}</td>
      <td><span class="pastilla pastilla-${c.clase}">${esc(c.estado)}</span> <span class="campo-ayuda">${esc(c.mensaje)}</span></td></tr>`).join('')}</table>`;
  if (errores.length) {
    h += `<h2>Qué hay que corregir (${errores.length})</h2>`;
    errores.forEach((x, i) => {
      const cl = x.gravedad === 'ERROR' ? 'error' : 'menor';
      h += `<div class="tarjeta obs obs-${cl}">
        <div class="obs-cabecera"><strong>${i + 1}. ${esc(x.titulo)}</strong><span class="pastilla pastilla-${cl}">${esc(x.grav)}</span></div>
        ${x.que ? `<p style="margin:8px 0">${esc(x.que)}</p>` : ''}
        ${x.ubic.length ? `<table class="tabla-celdas"><tr><th>Hoja</th><th>Celda</th><th>Dice</th><th>Debería decir</th></tr>
          ${x.ubic.slice(0, 12).map(u => `<tr><td>${esc(u.hoja)}</td><td><b>${esc(u.celda)}</b>${u.origen ? ' <span class="campo-ayuda">(corregir acá)</span>' : ''}</td>
            <td>${esc(u.dice)}</td><td><b>${esc(u.debe)}</b></td></tr>`).join('')}</table>
          ${x.ubic.length > 12 ? `<div class="campo-ayuda">… y ${x.ubic.length - 12} celda(s) más (están todas en el PDF).</div>` : ''}` : ''}
        ${x.accion ? `<p class="obs-accion"><b>Qué hacer:</b> ${esc(x.accion)}</p>` : ''}
        ${x.fuente ? `<p class="campo-ayuda" style="margin:4px 0 0">Fuente: ${esc(x.fuente)}</p>` : ''}
      </div>`;
    });
  }
  if (avisos.length) {
    h += `<details class="tarjeta desplegable-tarjeta" style="margin-top:20px"><summary><b>Avisos (${avisos.length})</b>
      <span class="campo-ayuda">— no son errores; conviene mirarlos</span></summary>
      ${avisos.map(x => `<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--borde)"><b>${esc(x.titulo)}</b>
        ${x.que ? `<div class="campo-ayuda" style="margin:4px 0">${esc(x.que)}</div>` : ''}
        ${x.ubic.length ? `<div class="campo-ayuda">${x.ubic.slice(0, 8).map(u => esc(u.hoja + '!' + u.celda)).join(', ')}${x.ubic.length > 8 ? ' …' : ''}</div>` : ''}</div>`).join('')}
    </details>`;
  }
  if (!r.items.length) h += `<div class="tarjeta vacio" style="margin-top:20px"><div class="icono">🎉</div><p>No hay nada para corregir en lo que se controló.</p></div>`;
  h += `<p class="campo-ayuda" style="margin-top:28px">Este autocontrol usa los mismos controles que el organismo, pero no reemplaza su revisión:
    el organismo puede tener criterios propios o boletines más recientes. (Control hecho en ${r.segundos_total} s, en tu navegador.)</p>`;
  $('#vista-resultado').innerHTML = h;
  $('#vista-inicio').hidden = true;
  $('#vista-resultado').hidden = false;
  window.scrollTo(0, 0);
}

async function bajar(tipo, boton) {
  boton.disabled = true;
  const caja = $('#progreso-descarga');
  caja.innerHTML = `<div class="campo-ayuda">${tipo === 'pdf' ? 'Armando el PDF…' : 'Armando la copia del Excel (puede tardar)…'}</div>`;
  try {
    const r = await pedir(tipo, {});
    const url = URL.createObjectURL(new Blob([r.datos]));
    const a = document.createElement('a');
    a.href = url; a.download = r.nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    caja.innerHTML = '';
  } catch (e) { caja.innerHTML = `<div class="progreso-error">${esc(e.message)}</div>`; }
  boton.disabled = false;
}

function volver() {
  $('#vista-resultado').hidden = true;
  $('#vista-inicio').hidden = false;
  $('#form-excel').reset();
  bloquear(false);
  ocultarProgreso();
  window.scrollTo(0, 0);
}

/* ---------- arranque: Python se carga en segundo plano apenas se abre la página ---------- */
(async function arrancar() {
  try {
    const r = await fetch('anexos/indice.json?v=' + VERSION);
    INDICE = r.ok ? (await r.json()).anexos : [];
  } catch (e) { INDICE = []; }
  pintarInfoBoletines();
  iniciarContador();
  listo = pedir('iniciar', {}).catch(e => { mostrarError('No se pudo cargar el programa en este navegador: ' + e.message); throw e; });
})();
