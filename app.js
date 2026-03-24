/* ═══════════════════════════════════════════════
   VITAL HEALTH TRACKER — app.js
   ═══════════════════════════════════════════════ */

'use strict';

/* ── CONSTANTS ──────────────────────────────────── */
const STORAGE_KEY = 'vitalHealthData';

const DEFAULT_GOALS = {
  steps: 10000,
  sleep: 8,
  water: 8,
  calories: 2200,
  workout: 45
};

const CAT_META = {
  steps:    { label: 'Steps',    icon: '🚶', color: '#378ADD', bg: '#e6f1fb', unit: 'steps' },
  sleep:    { label: 'Sleep',    icon: '🌙', color: '#7F77DD', bg: '#eeedfe', unit: 'hrs' },
  water:    { label: 'Water',    icon: '💧', color: '#1D9E75', bg: '#e1f5ee', unit: 'glasses' },
  calories: { label: 'Calories', icon: '🍽️', color: '#EF9F27', bg: '#faeeda', unit: 'kcal' },
  weight:   { label: 'Weight',   icon: '⚖️', color: '#D85A30', bg: '#fdecea', unit: 'kg' },
  mood:     { label: 'Mood',     icon: '😊', color: '#D4537E', bg: '#fbeaf0', unit: '' },
  workout:  { label: 'Workout',  icon: '🏃', color: '#639922', bg: '#eaf3de', unit: 'min' }
};

const MOOD_OPTS  = ['Great', 'Good', 'Okay', 'Tired', 'Stressed'];
const MOOD_EMOJI = { Great: '😄', Good: '😊', Okay: '😐', Tired: '😴', Stressed: '😤' };
const MOOD_SCORE = { Great: 5, Good: 4, Okay: 3, Tired: 2, Stressed: 1 };

const WORKOUT_OPTS = ['Running', 'Cycling', 'Yoga', 'Weights', 'Swimming', 'HIIT', 'Walking', 'Other'];

/* ── STATE ──────────────────────────────────────── */
let state = loadState();
let chartInstances = {};   // keyed by canvas id → Chart instance
let selectedMood    = '';
let selectedWorkout = '';

/* ── PERSISTENCE ────────────────────────────────── */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.goals   = { ...DEFAULT_GOALS, ...(parsed.goals   || {}) };
      parsed.entries = parsed.entries || [];
      parsed.profile = parsed.profile || {};
      // Reset water count if it's a new day
      if (parsed.waterDate !== todayStr()) {
        parsed.waterToday = 0;
        parsed.waterDate  = todayStr();
      }
      return parsed;
    }
  } catch (e) { console.warn('Could not load saved data:', e); }
  return { goals: { ...DEFAULT_GOALS }, entries: [], profile: {}, waterToday: 0, waterDate: todayStr() };
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Failed to save data:', e); }
}

/* ── DATE HELPERS ───────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getLastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── DATA QUERIES ───────────────────────────────── */
function entriesOn(date) {
  return state.entries.filter(e => e.date === date);
}

function todayEntries() {
  return entriesOn(todayStr());
}

/**
 * Aggregate value for a category on a given date.
 * - mood / weight: return last entry's value
 * - others: sum all entries
 */
function getDayVal(cat, date) {
  const es = entriesOn(date).filter(e => e.cat === cat);
  if (!es.length) return null;
  if (cat === 'mood' || cat === 'weight') return es[es.length - 1].val;
  return es.reduce((sum, e) => sum + parseFloat(e.val || 0), 0);
}

function getTodayVal(cat) {
  if (cat === 'water') return state.waterToday;
  return getDayVal(cat, todayStr());
}

function getSeriesForDays(cat, dates) {
  return dates.map(d => getDayVal(cat, d));
}

/* ── STREAK ─────────────────────────────────────── */
function calcStreak() {
  let streak = 0;
  const today = todayStr();
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const has = ds === today ? true : state.entries.some(e => e.date === ds);
    if (has) { streak++; }
    else if (ds !== today) break;
  }
  return streak;
}

/* ── TOAST ──────────────────────────────────────── */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

/* ── NAVIGATION ─────────────────────────────────── */
function showSection(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav button').forEach(b => b.classList.remove('active'));

  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelector(`.nav-item[data-section="${id}"]`)?.classList.add('active');
  document.querySelector(`.mobile-nav button[data-section="${id}"]`)?.classList.add('active');

  const titles = { today: 'Today', charts: 'Charts', bmi: 'BMI & Body', history: 'History', settings: 'Settings' };
  document.getElementById('section-title').textContent = titles[id] || id;

  // Render section-specific content
  if (id === 'today')    renderToday();
  if (id === 'charts')   renderCharts();
  if (id === 'bmi')      renderBMIPage();
  if (id === 'history')  renderHistory();
  if (id === 'settings') loadGoalInputs();
}

/* ═══════════════════════════════════════════════
   TODAY
═══════════════════════════════════════════════ */
function renderToday() {
  renderMetricTiles();
  renderWaterDots();
  renderTodayLog();
  renderMiniCharts();
  document.getElementById('streak-count').textContent = calcStreak();
}

function renderMetricTiles() {
  const grid = document.getElementById('metrics-grid');
  grid.innerHTML = '';

  Object.entries(CAT_META).forEach(([cat, meta]) => {
    const raw  = getTodayVal(cat);
    const goal = state.goals[cat];

    let displayVal, unitText, pctFill;
    if (cat === 'mood') {
      displayVal = raw ? (MOOD_EMOJI[raw] || raw) : '—';
      unitText   = raw || 'not logged';
      pctFill    = raw ? MOOD_SCORE[raw] * 20 : 0;
    } else if (cat === 'water') {
      displayVal = raw !== null ? raw : '—';
      unitText   = `/ ${goal} glasses`;
      pctFill    = raw ? Math.min(100, Math.round((raw / goal) * 100)) : 0;
    } else if (raw !== null) {
      if (cat === 'weight' || cat === 'sleep') {
        displayVal = parseFloat(raw).toFixed(1);
      } else {
        displayVal = Math.round(raw).toLocaleString();
      }
      unitText  = goal ? `/ ${goal.toLocaleString()} ${meta.unit}` : meta.unit;
      pctFill   = goal ? Math.min(100, Math.round((raw / goal) * 100)) : 50;
    } else {
      displayVal = '—';
      unitText   = goal ? `/ ${goal.toLocaleString()} ${meta.unit}` : meta.unit;
      pctFill    = 0;
    }

    const tile = document.createElement('div');
    tile.className = 'metric-tile';
    tile.innerHTML = `
      <div class="tile-label">${meta.icon} ${meta.label}</div>
      <div class="tile-val">${displayVal}</div>
      <div class="tile-unit">${unitText}</div>
      <div class="tile-bar">
        <div class="tile-fill" style="width:${pctFill}%;background:${meta.color};"></div>
      </div>
    `;
    grid.appendChild(tile);
  });
}

function renderWaterDots() {
  const goal   = state.goals.water;
  const filled = state.waterToday;
  document.getElementById('water-goal-label').textContent = goal;
  const container = document.getElementById('water-dots');
  container.innerHTML = '';
  for (let i = 0; i < goal; i++) {
    const dot = document.createElement('div');
    dot.className = 'water-dot' + (i < filled ? ' filled' : '');
    dot.title = i < filled ? 'Click to remove' : 'Log a glass';
    dot.addEventListener('click', () => {
      state.waterToday = i < filled ? i : i + 1;
      state.waterDate  = todayStr();
      persist();
      renderWaterDots();
      renderMetricTiles();
    });
    container.appendChild(dot);
  }
}

function renderTodayLog() {
  const tbody  = document.getElementById('today-log-tbody');
  const noMsg  = document.getElementById('no-entries-msg');
  const entries = todayEntries().slice().reverse();

  tbody.innerHTML = '';
  noMsg.style.display = entries.length ? 'none' : '';

  entries.forEach(e => {
    const meta    = CAT_META[e.cat] || {};
    const timeStr = e.time ? new Date(e.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
    const valStr  = formatEntryVal(e);
    const status  = getEntryStatus(e);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-icon">
        <div class="log-icon" style="background:${meta.bg || '#f0ede8'}">${meta.icon || '📌'}</div>
      </td>
      <td><strong>${e.note || capitalize(e.cat)}</strong></td>
      <td class="muted">${timeStr}</td>
      <td class="mono">${valStr}</td>
      <td>${status}</td>
      <td>
        <button class="btn-icon-del" data-id="${e.id}" title="Delete entry">×</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Delete buttons
  tbody.querySelectorAll('.btn-icon-del').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(btn.dataset.id);
      renderToday();
    });
  });
}

function renderMiniCharts() {
  const dates = getLastNDates(7);
  const labels = dates.map(shortDay);

  makeBarChart('chart-steps-mini', labels,
    dates.map(d => getDayVal('steps', d) || 0),
    '#378ADD', state.goals.steps);

  makeLineChart('chart-sleep-mini', labels,
    dates.map(d => getDayVal('sleep', d) || 0),
    '#7F77DD', state.goals.sleep);
}

/* ═══════════════════════════════════════════════
   CHARTS
═══════════════════════════════════════════════ */
function renderCharts() {
  const week7  = getLastNDates(7);
  const week30 = getLastNDates(30);
  const labels7 = week7.map(shortDay);

  // Weekly summary stats
  renderWeeklyStats(week7);

  // Steps
  makeBarChart('chart-steps', labels7,
    week7.map(d => getDayVal('steps', d) || 0),
    '#378ADD', state.goals.steps);

  // Sleep
  makeLineChart('chart-sleep', labels7,
    week7.map(d => getDayVal('sleep', d) || 0),
    '#7F77DD', state.goals.sleep);

  // Calories
  makeBarChart('chart-calories', labels7,
    week7.map(d => getDayVal('calories', d) || 0),
    '#EF9F27', state.goals.calories);

  // Weight 30 days
  const wLabels = week30.filter((_, i) => i % 3 === 0 || i === week30.length - 1).map(d => formatDate(d).slice(0, 6));
  makeLineChart('chart-weight',
    week30.map((d, i) => i % 3 === 0 || i === week30.length - 1 ? shortDay(d) : ''),
    week30.map(d => getDayVal('weight', d)),
    '#D85A30', null, true);

  // Mood
  makeMoodChart('chart-mood', labels7, week7);

  // Workout
  makeBarChart('chart-workout', labels7,
    week7.map(d => getDayVal('workout', d) || 0),
    '#639922', state.goals.workout);

  // Water
  makeBarChart('chart-water', labels7,
    week7.map(d => {
      const water = entriesOn(d).filter(e => e.cat === 'water').reduce((s, e) => s + parseFloat(e.val || 0), 0);
      // also include waterToday for today
      return d === todayStr() ? Math.max(water, state.waterToday) : water;
    }),
    '#1D9E75', state.goals.water);
}

function renderWeeklyStats(week7) {
  const container = document.getElementById('weekly-stats-row');
  if (!container) return;

  const prevWeek = getLastNDates(14).slice(0, 7);

  const avgSteps  = avg(week7.map(d => getDayVal('steps', d)));
  const avgSleep  = avg(week7.map(d => getDayVal('sleep', d)));
  const workouts  = week7.filter(d => getDayVal('workout', d) !== null).length;
  const avgWater  = avg(week7.map(d => d === todayStr() ? state.waterToday : 0));

  const prevSteps = avg(prevWeek.map(d => getDayVal('steps', d)));
  const stepDelta = prevSteps ? Math.round(((avgSteps - prevSteps) / prevSteps) * 100) : null;

  container.innerHTML = `
    ${statBox('Avg steps',   avgSteps ? Math.round(avgSteps).toLocaleString() : '—',
        stepDelta !== null ? (stepDelta >= 0 ? `↑ ${stepDelta}% vs prev week` : `↓ ${Math.abs(stepDelta)}% vs prev week`) : '',
        stepDelta >= 0 ? 'delta-up' : 'delta-down')}
    ${statBox('Avg sleep',   avgSleep ? avgSleep.toFixed(1) + ' hrs' : '—', '', '')}
    ${statBox('Workouts',    workouts + ' / 7 days', workouts >= 5 ? 'Great week!' : '', 'delta-up')}
    ${statBox('Avg water',   avgWater ? avgWater.toFixed(1) + ' gl/day' : '—', '', '')}
  `;
}

function statBox(label, val, delta, deltaClass) {
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-val">${val}</div>
      ${delta ? `<div class="stat-delta ${deltaClass}">${delta}</div>` : ''}
    </div>
  `;
}

function avg(arr) {
  const nums = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + parseFloat(v), 0) / nums.length;
}

/* ═══════════════════════════════════════════════
   BMI
═══════════════════════════════════════════════ */
function renderBMIPage() {
  // Pre-fill profile from saved state
  const p = state.profile;
  if (p.height)   document.getElementById('p-height').value   = p.height;
  if (p.weight)   document.getElementById('p-weight').value   = p.weight;
  if (p.age)      document.getElementById('p-age').value      = p.age;
  if (p.sex)      document.getElementById('p-sex').value      = p.sex;
  if (p.activity) document.getElementById('p-activity').value = p.activity;

  if (p.height && p.weight) updateBMI();

  // Weight history chart
  const dates  = getLastNDates(30);
  const labels = dates.map(d => formatDate(d).slice(0, 6));
  const vals   = dates.map(d => getDayVal('weight', d));
  makeLineChart('chart-bmi-weight', labels, vals, '#D85A30', null, true);
}

function updateBMI() {
  const height   = parseFloat(document.getElementById('p-height').value);
  const weight   = parseFloat(document.getElementById('p-weight').value);
  const age      = parseInt(document.getElementById('p-age').value);
  const sex      = document.getElementById('p-sex').value;
  const activity = parseFloat(document.getElementById('p-activity').value);

  if (!height || !weight) { showToast('Please enter height and weight.'); return; }

  const bmi = weight / ((height / 100) ** 2);
  const bmiRounded = bmi.toFixed(1);

  // Category + color
  let cat, color, tip;
  if (bmi < 18.5) {
    cat = 'Underweight'; color = '#378ADD';
    tip = 'Your BMI indicates you are underweight. Consider speaking with a healthcare provider about a balanced nutrition plan.';
  } else if (bmi < 25) {
    cat = 'Normal weight'; color = '#1D9E75';
    tip = 'Great — your BMI is in the healthy range. Keep maintaining a balanced diet and regular exercise.';
  } else if (bmi < 30) {
    cat = 'Overweight'; color = '#BA7517';
    tip = 'Your BMI is slightly above the normal range. Small lifestyle adjustments — like more movement and mindful eating — can make a big difference.';
  } else {
    cat = 'Obese'; color = '#D44B3A';
    tip = 'Your BMI indicates obesity. It is advisable to consult a healthcare professional for personalized guidance.';
  }

  document.getElementById('bmi-value').textContent    = bmiRounded;
  document.getElementById('bmi-value').style.color    = color;
  document.getElementById('bmi-category').textContent = cat;
  document.getElementById('bmi-tip').textContent      = tip;

  // Needle position: map BMI 15–40 → 0–100%
  const needlePct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
  document.getElementById('bmi-needle').style.left = needlePct + '%';

  // TDEE (Harris–Benedict)
  if (age && sex && activity) {
    let bmr;
    if (sex === 'male') {
      bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
      bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }
    const tdee = bmr * activity;
    const tdeeSection = document.getElementById('tdee-section');
    const tdeeGrid    = document.getElementById('tdee-grid');
    tdeeSection.style.display = '';
    tdeeGrid.innerHTML = `
      ${tdeeBox('Maintain weight', Math.round(tdee))}
      ${tdeeBox('Lose 0.5 kg/week', Math.round(tdee - 500))}
      ${tdeeBox('Lose 1 kg/week', Math.round(tdee - 1000))}
      ${tdeeBox('Gain 0.5 kg/week', Math.round(tdee + 500))}
    `;
  }

  // Save profile
  state.profile = { height, weight, age, sex, activity };
  persist();
  showToast('BMI calculated ✓');
}

function tdeeBox(label, kcal) {
  return `<div class="tdee-box">${label}<strong>${kcal.toLocaleString()} kcal</strong></div>`;
}

/* ═══════════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════════ */
function renderHistory() {
  const metric = document.getElementById('hist-metric').value;
  const period = document.getElementById('hist-period').value;
  const tbody  = document.getElementById('history-tbody');
  const noMsg  = document.getElementById('no-history-msg');

  let entries = [...state.entries];

  // Filter by period
  if (period !== 'all') {
    const cutoff = nDaysAgo(parseInt(period));
    entries = entries.filter(e => e.date >= cutoff);
  }

  // Filter by metric
  if (metric !== 'all') {
    entries = entries.filter(e => e.cat === metric);
  }

  // Sort newest first
  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));

  tbody.innerHTML = '';
  noMsg.style.display = entries.length ? 'none' : '';

  entries.forEach(e => {
    const meta   = CAT_META[e.cat] || {};
    const tr     = document.createElement('tr');
    const valStr = formatEntryVal(e);
    tr.innerHTML = `
      <td>${formatDate(e.date)}</td>
      <td><span class="log-icon" style="background:${meta.bg||'#f0ede8'};display:inline-flex;">${meta.icon||'📌'}</span> ${capitalize(e.cat)}</td>
      <td class="mono">${valStr}</td>
      <td class="muted">${e.note || '—'}</td>
      <td><button class="btn-icon-del" data-id="${e.id}">×</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-icon-del').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(btn.dataset.id);
      renderHistory();
      showToast('Entry deleted');
    });
  });
}

/* ═══════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════ */
function loadGoalInputs() {
  Object.keys(DEFAULT_GOALS).forEach(k => {
    const el = document.getElementById('goal-' + k);
    if (el) el.value = state.goals[k];
  });
}

function saveGoals() {
  Object.keys(DEFAULT_GOALS).forEach(k => {
    const el = document.getElementById('goal-' + k);
    if (el && el.value) state.goals[k] = parseFloat(el.value);
  });
  persist();
  showToast('Goals saved ✓');
}

/* ═══════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════ */
function openModal() {
  selectedMood = '';
  selectedWorkout = '';
  document.getElementById('log-modal').classList.add('open');
  updateModalFields();
}

function closeModal() {
  document.getElementById('log-modal').classList.remove('open');
}

function updateModalFields() {
  const cat     = document.getElementById('log-cat').value;
  const container = document.getElementById('modal-dynamic-fields');
  selectedMood = '';
  selectedWorkout = '';

  const templates = {
    steps: `
      <div class="form-group">
        <label>Steps count</label>
        <input type="number" id="fi-val" placeholder="e.g. 5000" min="0">
      </div>
      <div class="form-group">
        <label>Activity note (optional)</label>
        <input type="text" id="fi-note" placeholder="e.g. Morning walk">
      </div>`,

    sleep: `
      <div class="form-group">
        <label>Hours slept</label>
        <input type="number" id="fi-val" step="0.1" placeholder="e.g. 7.5" min="0" max="24">
      </div>
      <div class="form-group">
        <label>Note (optional)</label>
        <input type="text" id="fi-note" placeholder="e.g. Woke up refreshed">
      </div>`,

    water: `
      <div class="form-group">
        <label>Glasses of water</label>
        <input type="number" id="fi-val" placeholder="e.g. 2" min="1" max="20">
      </div>`,

    calories: `
      <div class="form-group">
        <label>Meal / food name</label>
        <input type="text" id="fi-note" placeholder="e.g. Lunch — rice + dal">
      </div>
      <div class="form-group">
        <label>Calories (kcal)</label>
        <input type="number" id="fi-val" placeholder="e.g. 600" min="0">
      </div>`,

    weight: `
      <div class="form-group">
        <label>Weight (kg)</label>
        <input type="number" id="fi-val" step="0.1" placeholder="e.g. 72.5" min="20" max="300">
      </div>`,

    mood: `
      <div class="form-group">
        <label>How are you feeling?</label>
        <div class="chip-group" id="mood-chips">
          ${MOOD_OPTS.map(m => `
            <button class="chip" data-mood="${m}">${MOOD_EMOJI[m]} ${m}</button>
          `).join('')}
        </div>
        <input type="hidden" id="fi-val">
      </div>
      <div class="form-group">
        <label>Note (optional)</label>
        <textarea id="fi-note" placeholder="What's on your mind?"></textarea>
      </div>`,

    workout: `
      <div class="form-group">
        <label>Workout type</label>
        <div class="chip-group" id="workout-chips">
          ${WORKOUT_OPTS.map(w => `
            <button class="chip" data-workout="${w}">${w}</button>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Duration (min)</label>
        <input type="number" id="fi-val" placeholder="e.g. 45" min="1">
      </div>
      <div class="form-group">
        <label>Note (optional)</label>
        <input type="text" id="fi-note" placeholder="e.g. 5k run in the park">
      </div>`
  };

  container.innerHTML = templates[cat] || '';

  // Attach mood chip listeners
  container.querySelectorAll('#mood-chips .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#mood-chips .chip').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
      const hidden = document.getElementById('fi-val');
      if (hidden) hidden.value = selectedMood;
    });
  });

  // Attach workout chip listeners
  container.querySelectorAll('#workout-chips .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#workout-chips .chip').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedWorkout = btn.dataset.workout;
    });
  });
}

function saveEntry() {
  const cat   = document.getElementById('log-cat').value;
  const valEl = document.getElementById('fi-val');
  const noteEl= document.getElementById('fi-note');
  const val   = valEl ? valEl.value.trim() : '';
  const note  = noteEl ? noteEl.value.trim() : '';

  if (!val && cat !== 'mood') { showToast('Please enter a value.'); return; }
  if (cat === 'mood' && !selectedMood) { showToast('Please select a mood.'); return; }

  const entry = {
    id:   uid(),
    cat,
    val:  cat === 'mood' ? selectedMood : parseFloat(val),
    note: cat === 'workout' && selectedWorkout ? (selectedWorkout + (note ? ' — ' + note : '')) : note,
    date: todayStr(),
    time: new Date().toISOString()
  };

  state.entries.push(entry);

  // Special: water updates waterToday
  if (cat === 'water') {
    state.waterToday = Math.min(state.goals.water, state.waterToday + entry.val);
    state.waterDate  = todayStr();
  }

  persist();
  closeModal();
  renderToday();
  showToast(`${capitalize(cat)} logged ✓`);
}

/* ═══════════════════════════════════════════════
   ENTRY MANAGEMENT
═══════════════════════════════════════════════ */
function deleteEntry(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;
  // Adjust water count if deleting a water entry for today
  if (entry.cat === 'water' && entry.date === todayStr()) {
    state.waterToday = Math.max(0, state.waterToday - parseFloat(entry.val || 1));
  }
  state.entries = state.entries.filter(e => e.id !== id);
  persist();
}

/* ═══════════════════════════════════════════════
   EXPORT CSV
═══════════════════════════════════════════════ */
function exportCSV() {
  if (!state.entries.length) { showToast('No data to export.'); return; }

  const header = ['Date', 'Time', 'Category', 'Value', 'Unit', 'Note'];
  const rows   = state.entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => {
      const meta   = CAT_META[e.cat] || {};
      const timeStr = e.time ? new Date(e.time).toLocaleString('en-IN') : '';
      return [e.date, timeStr, capitalize(e.cat), e.val, meta.unit || '', `"${(e.note || '').replace(/"/g, '""')}"`];
    });

  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `vital-health-data-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported ✓');
}

function clearAllData() {
  if (!confirm('This will permanently delete ALL your health data. Are you sure?')) return;
  state = { goals: { ...DEFAULT_GOALS }, entries: [], profile: {}, waterToday: 0, waterDate: todayStr() };
  persist();
  renderToday();
  showToast('All data cleared');
}

/* ═══════════════════════════════════════════════
   CHART HELPERS
═══════════════════════════════════════════════ */
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9e9990', maxRotation: 0 } },
    y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 11 }, color: '#9e9990', maxTicksLimit: 5 } }
  }
};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function makeBarChart(id, labels, data, color, goal) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const goalLine = goal ? [{
    type: 'line',
    label: 'Goal',
    data: Array(labels.length).fill(goal),
    borderColor: color + '66',
    borderWidth: 1.5,
    borderDash: [4, 3],
    pointRadius: 0
  }] : [];

  chartInstances[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { data, backgroundColor: color + '40', borderColor: color, borderWidth: 1.5, borderRadius: 4 },
        ...goalLine
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { legend: { display: false } }
    }
  });
}

function makeLineChart(id, labels, data, color, goal, skipNull = false) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const processedData = skipNull
    ? data.map(v => (v === null || v === undefined) ? null : v)
    : data.map(v => v || 0);

  const goalLine = goal ? [{
    type: 'line',
    data: Array(labels.length).fill(goal),
    borderColor: color + '55',
    borderWidth: 1,
    borderDash: [4, 3],
    pointRadius: 0
  }] : [];

  chartInstances[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: processedData,
          borderColor: color,
          borderWidth: 2,
          backgroundColor: color + '18',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: color,
          pointRadius: 3,
          pointHoverRadius: 5,
          spanGaps: skipNull
        },
        ...goalLine
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { legend: { display: false } }
    }
  });
}

function makeMoodChart(id, labels, dates) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scores = dates.map(d => {
    const mood = getDayVal('mood', d);
    return mood ? (MOOD_SCORE[mood] || null) : null;
  });

  chartInstances[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: scores,
        borderColor: '#D4537E',
        borderWidth: 2,
        backgroundColor: '#D4537E18',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#D4537E',
        pointRadius: 4,
        spanGaps: false
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9e9990' } },
        y: {
          min: 0, max: 6,
          grid: { color: 'rgba(128,128,128,0.1)' },
          ticks: {
            font: { size: 11 }, color: '#9e9990',
            stepSize: 1,
            callback: v => ['', 'Stressed', 'Tired', 'Okay', 'Good', 'Great', ''][v] || ''
          }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ═══════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════ */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function formatEntryVal(e) {
  const meta = CAT_META[e.cat] || {};
  if (e.cat === 'mood') return (MOOD_EMOJI[e.val] || '') + ' ' + (e.val || '');
  if (e.cat === 'weight' || e.cat === 'sleep') return parseFloat(e.val).toFixed(1) + ' ' + meta.unit;
  return Math.round(e.val).toLocaleString() + ' ' + meta.unit;
}

function getEntryStatus(e) {
  const goal = state.goals[e.cat];
  if (!goal || e.cat === 'mood' || e.cat === 'weight') return '';
  const v = parseFloat(e.val);
  if (v >= goal)       return '<span class="badge badge-good">goal met</span>';
  if (v >= goal * 0.7) return '<span class="badge badge-warn">on track</span>';
  return '<span class="badge badge-low">below goal</span>';
}

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
function boot() {
  // Date
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });

  // Mobile nav (injected into body)
  const mobileNav = document.createElement('nav');
  mobileNav.className = 'mobile-nav';
  mobileNav.innerHTML = `
    <button data-section="today" class="active"><span class="mn-icon">📊</span>Today</button>
    <button data-section="charts"><span class="mn-icon">📈</span>Charts</button>
    <button data-section="bmi"><span class="mn-icon">⚖️</span>BMI</button>
    <button data-section="history"><span class="mn-icon">🗓️</span>History</button>
    <button data-section="settings"><span class="mn-icon">⚙️</span>Settings</button>
  `;
  document.body.appendChild(mobileNav);
  mobileNav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });

  // Log modal
  document.getElementById('btn-open-modal').addEventListener('click', openModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-modal-save').addEventListener('click', saveEntry);
  document.getElementById('log-cat').addEventListener('change', updateModalFields);
  document.getElementById('log-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Charts section filters
  document.getElementById('hist-metric')?.addEventListener('change', renderHistory);
  document.getElementById('hist-period')?.addEventListener('change', renderHistory);

  // Export / clear
  document.getElementById('btn-export')?.addEventListener('click', exportCSV);
  document.getElementById('btn-clear-all')?.addEventListener('click', clearAllData);
  document.getElementById('btn-export-settings')?.addEventListener('click', exportCSV);
  document.getElementById('btn-clear-settings')?.addEventListener('click', clearAllData);

  // BMI calc
  document.getElementById('btn-calc-bmi')?.addEventListener('click', updateBMI);

  // Goals save
  document.getElementById('btn-save-goals')?.addEventListener('click', saveGoals);

  // Keyboard: ESC closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Initial render
  renderToday();
}

document.addEventListener('DOMContentLoaded', boot);
