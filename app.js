'use strict';

/* ============ Almacenamiento ============ */
const STORAGE_KEY = 'track-data-v1';
const DEFAULT_DATA = { runs: [], lifts: [], sleep: null };

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    return { ...structuredClone(DEFAULT_DATA), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

let data = loadData();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    toast('No se pudo guardar en este navegador');
  }
}

/* ============ Utilidades ============ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(iso) {
  return parseISODate(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '—';
  let m = Math.floor(secPerKm / 60);
  let s = Math.round(secPerKm % 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

const fmtNum = (n, d = 1) => Number(n).toLocaleString('es', { maximumFractionDigits: d });

/** Lunes de la semana de una fecha (00:00 local). */
function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d;
}

function liftVolume(lift) {
  return lift.exercises.reduce((sum, e) => sum + e.sets * e.reps * (e.kg || 0), 0);
}

/** 1RM estimado (fórmula de Epley). */
const epley1RM = (kg, reps) => (reps === 1 ? kg : kg * (1 + reps / 30));

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ============ Pestañas ============ */
function showTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
  try { localStorage.setItem('track-tab', name); } catch { /* ignorar */ }
}
$$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

/* ============ Correr ============ */
const runForm = $('#run-form');

function runDurationSec(form) {
  const h = Number(form.h.value) || 0;
  const m = Number(form.m.value) || 0;
  const s = Number(form.s.value) || 0;
  return h * 3600 + m * 60 + s;
}

function updatePacePreview() {
  const km = Number(runForm.distance.value);
  const sec = runDurationSec(runForm);
  $('#pace-preview').textContent = km > 0 && sec > 0
    ? `Ritmo: ${fmtPace(sec / km)} · ${fmtNum((km / sec) * 3600)} km/h`
    : 'Ritmo: —';
  $('#rpe-out').textContent = runForm.rpe.value;
}
runForm.addEventListener('input', updatePacePreview);

runForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const distance = Number(runForm.distance.value);
  const duration = runDurationSec(runForm);
  if (!(distance > 0) || !(duration > 0)) {
    toast('Indica distancia y duración');
    return;
  }
  data.runs.push({
    id: uid(),
    date: runForm.date.value,
    type: runForm.type.value,
    distance,
    duration,
    rpe: Number(runForm.rpe.value),
    notes: runForm.notes.value.trim(),
  });
  save();
  runForm.reset();
  runForm.date.value = todayISO();
  updatePacePreview();
  renderAll();
  toast('Carrera guardada 🏃');
});

function runItemHtml(r, withBadge = false) {
  return `
    <li class="item">
      <div class="main">
        <div class="t">${withBadge ? '<span class="badge run">CORRER</span>' : ''}${fmtNum(r.distance, 2)} km · ${escapeHtml(r.type)}</div>
        <div class="meta">${fmtDate(r.date)} · ${fmtDuration(r.duration)} · ${fmtPace(r.duration / r.distance)} · RPE ${r.rpe}</div>
        ${r.notes ? `<div class="ex">${escapeHtml(r.notes)}</div>` : ''}
      </div>
      <button class="icon" data-del-run="${r.id}" aria-label="Borrar carrera">✕</button>
    </li>`;
}

function renderRuns() {
  const list = $('#run-list');
  const runs = [...data.runs].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = runs.length
    ? runs.map((r) => runItemHtml(r)).join('')
    : '<li class="empty">Aún no hay carreras. ¡A sumar kilómetros!</li>';
}

/* ============ Pesas ============ */
const liftForm = $('#lift-form');
const exRows = $('#exercise-rows');

function addExerciseRow(values = {}) {
  const node = $('#exercise-row').content.firstElementChild.cloneNode(true);
  if (values.name) $('.ex-name', node).value = values.name;
  if (values.sets) $('.ex-sets', node).value = values.sets;
  if (values.reps) $('.ex-reps', node).value = values.reps;
  if (values.kg != null) $('.ex-kg', node).value = values.kg;
  exRows.appendChild(node);
  updateVolumePreview();
}

function readExercises() {
  return $$('.ex-row', exRows)
    .map((row) => ({
      name: $('.ex-name', row).value.trim(),
      sets: Number($('.ex-sets', row).value) || 0,
      reps: Number($('.ex-reps', row).value) || 0,
      kg: Number($('.ex-kg', row).value) || 0,
    }))
    .filter((e) => e.name && e.sets > 0 && e.reps > 0);
}

function updateVolumePreview() {
  const vol = liftVolume({ exercises: readExercises() });
  $('#vol-preview').textContent = `Volumen: ${fmtNum(vol, 0)} kg`;
}

$('#add-ex').addEventListener('click', () => {
  addExerciseRow();
  $$('.ex-name', exRows).at(-1).focus();
});
exRows.addEventListener('click', (e) => {
  if (e.target.closest('.remove-ex')) {
    e.target.closest('.ex-row').remove();
    if (!exRows.children.length) addExerciseRow();
    updateVolumePreview();
  }
});
exRows.addEventListener('input', updateVolumePreview);

liftForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const exercises = readExercises();
  if (!exercises.length) {
    toast('Añade al menos un ejercicio');
    return;
  }
  data.lifts.push({
    id: uid(),
    date: liftForm.date.value,
    name: liftForm.name.value.trim() || 'Sesión',
    exercises,
    notes: liftForm.notes.value.trim(),
  });
  save();
  liftForm.reset();
  liftForm.date.value = todayISO();
  exRows.innerHTML = '';
  addExerciseRow();
  renderAll();
  toast('Sesión guardada 🏋️');
});

function liftItemHtml(l, withBadge = false) {
  const ex = l.exercises
    .map((e) => `${escapeHtml(e.name)} ${e.sets}×${e.reps}${e.kg ? ` @ ${fmtNum(e.kg)} kg` : ''}`)
    .join(' · ');
  return `
    <li class="item">
      <div class="main">
        <div class="t">${withBadge ? '<span class="badge lift">PESAS</span>' : ''}${escapeHtml(l.name)}</div>
        <div class="meta">${fmtDate(l.date)} · ${l.exercises.length} ${l.exercises.length === 1 ? "ejercicio" : "ejercicios"} · ${fmtNum(liftVolume(l), 0)} kg de volumen</div>
        <div class="ex">${ex}</div>
        ${l.notes ? `<div class="meta">${escapeHtml(l.notes)}</div>` : ''}
      </div>
      <button class="icon" data-del-lift="${l.id}" aria-label="Borrar sesión">✕</button>
    </li>`;
}

function renderLifts() {
  const list = $('#lift-list');
  const lifts = [...data.lifts].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = lifts.length
    ? lifts.map((l) => liftItemHtml(l)).join('')
    : '<li class="empty">Aún no hay sesiones de pesas registradas.</li>';
}

/* Borrado (delegado en todo el documento) */
document.addEventListener('click', (e) => {
  const runBtn = e.target.closest('[data-del-run]');
  const liftBtn = e.target.closest('[data-del-lift]');
  if (!runBtn && !liftBtn) return;
  if (!confirm('¿Borrar este entreno?')) return;
  if (runBtn) data.runs = data.runs.filter((r) => r.id !== runBtn.dataset.delRun);
  if (liftBtn) data.lifts = data.lifts.filter((l) => l.id !== liftBtn.dataset.delLift);
  save();
  renderAll();
  toast('Entreno borrado');
});

/* ============ Resumen ============ */
function renderSummary() {
  const start = weekStart(new Date());
  const inWeek = (iso) => parseISODate(iso) >= start;
  const weekRuns = data.runs.filter((r) => inWeek(r.date));
  const weekLifts = data.lifts.filter((l) => inWeek(l.date));
  const km = weekRuns.reduce((s, r) => s + r.distance, 0);
  const runSec = weekRuns.reduce((s, r) => s + r.duration, 0);
  const vol = weekLifts.reduce((s, l) => s + liftVolume(l), 0);

  $('#week-stats').innerHTML = [
    [fmtNum(km), 'km corridos'],
    [weekRuns.length, `carreras · ${runSec ? fmtDuration(runSec) : '0:00'}`],
    [weekLifts.length, 'sesiones de pesas'],
    [fmtNum(vol / 1000), 'toneladas levantadas'],
  ].map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');

  // Km por semana (últimas 8)
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(start);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const total = data.runs
      .filter((r) => { const d = parseISODate(r.date); return d >= ws && d < we; })
      .reduce((s, r) => s + r.distance, 0);
    weeks.push({ ws, total });
  }
  const max = Math.max(1, ...weeks.map((w) => w.total));
  $('#km-chart').innerHTML = weeks.map((w) => `
    <div class="bar" title="${fmtNum(w.total)} km">
      <span class="n">${w.total ? fmtNum(w.total, 0) : ''}</span>
      <div class="fill" style="height:${(w.total / max) * 100}%"></div>
      <span class="w">${w.ws.getDate()}/${w.ws.getMonth() + 1}</span>
    </div>`).join('');

  // Récords
  const recs = [];
  if (data.runs.length) {
    const longest = data.runs.reduce((a, b) => (b.distance > a.distance ? b : a));
    recs.push(['Carrera más larga', `${fmtNum(longest.distance, 2)} km`]);
    for (const [label, minKm] of [['Mejor ritmo (≥5 km)', 5], ['Mejor ritmo (≥10 km)', 10], ['Mejor ritmo (≥21 km)', 21]]) {
      const eligible = data.runs.filter((r) => r.distance >= minKm);
      if (eligible.length) {
        const best = eligible.reduce((a, b) => (b.duration / b.distance < a.duration / a.distance ? b : a));
        recs.push([label, fmtPace(best.duration / best.distance)]);
      }
    }
  }
  const bestLift = {};
  for (const l of data.lifts) {
    for (const e of l.exercises) {
      if (!e.kg) continue;
      const key = e.name.toLowerCase();
      const est = epley1RM(e.kg, e.reps);
      if (!bestLift[key] || est > bestLift[key].est) bestLift[key] = { name: e.name, kg: e.kg, reps: e.reps, est };
    }
  }
  Object.values(bestLift)
    .sort((a, b) => b.est - a.est)
    .slice(0, 6)
    .forEach((b) => recs.push([`${b.name} (1RM est.)`, `${fmtNum(b.est, 0)} kg · ${fmtNum(b.kg)}×${b.reps}`]));

  $('#records').innerHTML = recs.length
    ? `<div class="records">${recs.map(([a, b]) => `<div class="rec"><span>${escapeHtml(a)}</span><span>${b}</span></div>`).join('')}</div>`
    : '<p class="hint" style="margin:0">Registra entrenos para ver tus récords.</p>';

  // Actividad reciente (mezcla)
  const recent = [
    ...data.runs.map((r) => ({ kind: 'run', item: r })),
    ...data.lifts.map((l) => ({ kind: 'lift', item: l })),
  ].sort((a, b) => b.item.date.localeCompare(a.item.date)).slice(0, 5);
  $('#recent').innerHTML = recent.length
    ? recent.map(({ kind, item }) => (kind === 'run' ? runItemHtml(item, true) : liftItemHtml(item, true))).join('')
    : '<li class="empty">Sin actividad todavía.</li>';
}

/* ============ Exportar / importar ============ */
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `track-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.runs) || !Array.isArray(parsed.lifts)) throw new Error('formato');
    if (!confirm('Esto reemplazará tus datos actuales. ¿Continuar?')) return;
    data = { ...structuredClone(DEFAULT_DATA), ...parsed };
    save();
    renderAll();
    loadSleepSettings();
    toast('Datos importados');
  } catch {
    toast('Archivo no válido');
  } finally {
    e.target.value = '';
  }
});

/* ============ Calculadora de sueño ============ */
const sleepForm = $('#sleep-form');
const CYCLE_MIN = 90;

/** Horas objetivo y preparación sugerida según el tipo de entreno. */
const TRAINING_PROFILES = {
  easy: { hours: 7.5, prep: 30, why: 'Una carrera suave no exige extra: 7 h 30 min es un buen objetivo.' },
  hard: { hours: 8, prep: 40, why: 'Las sesiones intensas piden piernas frescas y sistema nervioso descansado: apunta a 8 h.' },
  long: { hours: 8.5, prep: 60, why: 'Para la tirada larga conviene dormir más y desayunar con tiempo antes de salir.' },
  lift: { hours: 8, prep: 45, why: 'El sueño es clave para la recuperación muscular y la fuerza: apunta a 8 h.' },
  rest: { hours: 7.5, prep: 20, why: 'Día suave: mantén tu horario habitual para no desajustar el ritmo.' },
};

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const wrap = (min) => ((Math.round(min) % 1440) + 1440) % 1440;
const fmtClock = (min) => { const m = wrap(min); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const fmtHours = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

function computeSleepPlan({ trainTime, trainType, prep, latency, target }) {
  const profile = TRAINING_PROFILES[trainType] || TRAINING_PROFILES.easy;
  const wake = toMin(trainTime) - prep;
  const targetHours = target === 'auto' ? profile.hours : Number(target);
  const sleepMin = targetHours * 60;
  const bed = wake - sleepMin - latency;

  const options = [6, 5, 4].map((cycles) => {
    const mins = cycles * CYCLE_MIN;
    return { cycles, sleepMin: mins, bed: wake - mins - latency };
  });
  // El ciclo más cercano al objetivo (en caso de empate, el que da más sueño).
  const best = options.reduce((a, b) => (Math.abs(b.sleepMin - sleepMin) < Math.abs(a.sleepMin - sleepMin) ? b : a));

  return { profile, wake, bed, sleepMin, options, best, targetIsAuto: target === 'auto' };
}

/** Minutos desde ahora hasta la próxima vez que el reloj marque `clockMin`. */
function minutesUntil(clockMin) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return wrap(clockMin - nowMin);
}

function renderSleep() {
  const input = {
    trainTime: sleepForm.trainTime.value || '06:00',
    trainType: sleepForm.trainType.value,
    prep: Math.max(0, Number(sleepForm.prep.value) || 0),
    latency: Math.max(0, Number(sleepForm.latency.value) || 0),
    target: sleepForm.target.value,
  };
  const plan = computeSleepPlan(input);
  const until = minutesUntil(plan.bed);

  $('#sleep-result').innerHTML = `
    <div class="lbl">Métete en la cama a las</div>
    <div class="big">${fmtClock(plan.bed)}</div>
    <div class="lbl">para dormir ${fmtHours(plan.sleepMin)} y despertar a las <strong>${fmtClock(plan.wake)}</strong></div>
    <div class="line">⏰ Alarma: <strong>${fmtClock(plan.wake)}</strong> · 📵 Pantallas fuera: <strong>${fmtClock(plan.bed - 60)}</strong></div>
    <div class="line">${until === 0 ? '¡Es hora de acostarte!' : `Faltan <strong>${fmtHours(until)}</strong> para acostarte`}</div>
    ${plan.targetIsAuto ? `<p class="hint">${plan.profile.why}</p>` : ''}`;

  $('#sleep-options').innerHTML = plan.options.map((o) => `
    <li class="item option ${o === plan.best ? 'best' : ''}">
      <span class="time">${fmtClock(o.bed)}</span>
      <div class="main">
        <div class="t">${o.cycles} ciclos · ${fmtHours(o.sleepMin)} de sueño ${o === plan.best ? '<span class="badge run">MÁS CERCA DE TU OBJETIVO</span>' : ''}</div>
        <div class="meta">${o.cycles >= 6 ? 'Ideal antes de una sesión clave o en semana de carga' : o.cycles === 5 ? 'Bueno para la mayoría de los días' : 'Mínimo aceptable; no lo conviertas en costumbre'}</div>
      </div>
    </li>`).join('');

  data.sleep = input;
  save();
}

function loadSleepSettings() {
  if (!data.sleep) return;
  for (const [k, v] of Object.entries(data.sleep)) {
    if (sleepForm[k] != null) sleepForm[k].value = v;
  }
}

sleepForm.addEventListener('input', renderSleep);
// Al cambiar el tipo de entreno, sugerimos un tiempo de preparación acorde.
sleepForm.trainType.addEventListener('change', () => {
  sleepForm.prep.value = TRAINING_PROFILES[sleepForm.trainType.value].prep;
  renderSleep();
});
sleepForm.addEventListener('submit', (e) => e.preventDefault());

/* ============ Inicio ============ */
function renderAll() {
  renderRuns();
  renderLifts();
  renderSummary();
}

runForm.date.value = todayISO();
liftForm.date.value = todayISO();
addExerciseRow();
loadSleepSettings();
renderAll();
renderSleep();
updatePacePreview();
setInterval(renderSleep, 60_000); // refresca la cuenta atrás

try {
  const tab = localStorage.getItem('track-tab');
  if (tab && $(`#${tab}`)) showTab(tab);
} catch { /* ignorar */ }
