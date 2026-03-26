/* calabaza.js
   Simulador/verificador: Flor de calabaza (5 plantas x 21 días)
   - Genera datos reproducibles con semilla
   - Calcula cuartiles (Tukey) y boxplot (Tukey 1.5×RIC)
   - Dibuja: caja y bigotes + histogramas (A por día, B agregado)
   - Renderiza tablas, KPIs, pasos de verificación
   - Exporta CSV
*/

/* =========================================================
   CONFIG
   ========================================================= */
const N_PLANTS = 5;
const N_DAYS = 21;
const MAX_FLOWERS = 25;

let data = [];       // data[dayIndex][plantIndex] = {male,female,total}
let lastSeed = "";

/* =========================================================
   PRNG con semilla (reproducible)
   ========================================================= */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRng(seedStr) {
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function round2(x) { return Math.round(x * 100) / 100; }

/* =========================================================
   ESTADÍSTICA: Tukey (cuartiles por mediana de mitades)
   ========================================================= */
function mean(arr) {
  if (!arr.length) return NaN;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

function medianSorted(sorted) {
  const n = sorted.length;
  const m = Math.floor(n / 2);
  return (n % 2 === 1) ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function quartilesTukey(values) {
  const x = values.slice().sort((a, b) => a - b);
  const n = x.length;
  const q2 = medianSorted(x);

  let lower, upper;
  if (n % 2 === 1) {
    lower = x.slice(0, Math.floor(n / 2));
    upper = x.slice(Math.floor(n / 2) + 1);
  } else {
    lower = x.slice(0, n / 2);
    upper = x.slice(n / 2);
  }

  const q1 = medianSorted(lower);
  const q3 = medianSorted(upper);

  return { q1, q2, q3, sorted: x, lower, upper };
}

function boxplotStats(values) {
  const { q1, q2, q3, sorted, lower, upper } = quartilesTukey(values);
  const iqr = q3 - q1;

  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;

  let lo = sorted.find(v => v >= loFence);
  let hi = [...sorted].reverse().find(v => v <= hiFence);
  if (lo === undefined) lo = sorted[0];
  if (hi === undefined) hi = sorted[sorted.length - 1];

  const outliers = sorted.filter(v => v < loFence || v > hiFence);

  return {
    q1, q2, q3, iqr,
    loFence, hiFence,
    whiskerLo: lo, whiskerHi: hi,
    outliers, sorted, lower, upper
  };
}

/* =========================================================
   MODELO DIDÁCTICO: datos 5 plantas x 21 días
   ========================================================= */
function generateData(seedStr) {
  const rng = seededRng(seedStr);

  // vigor por planta (diferencias entre plantas)
  const vigor = Array.from({ length: N_PLANTS }, () => 0.85 + rng() * 0.40);

  function baseTotalForDay(d) {
    // crecimiento suave del total esperado: 6..12
    const t = (d - 1) / 20;
    return 6 + 6 * t;
  }

  function femaleShare(d) {
    // proporción femenina baja al inicio, luego crece
    if (d <= 7) {
      return 0.05 + 0.06 * ((d - 1) / 6);
    } else if (d <= 14) {
      const t = (d - 8) / 6;
      return 0.12 + 0.18 * t;
    } else {
      const t = (d - 15) / 6;
      return 0.30 + 0.12 * t;
    }
  }

  function jitter() {
    // ruido simple centrado aprox. en 0
    const a = rng(), b = rng();
    return (a - b);
  }

  const out = [];
  for (let d = 1; d <= N_DAYS; d++) {
    const dayRow = [];
    const base = baseTotalForDay(d);
    const fShare = femaleShare(d);

    for (let p = 0; p < N_PLANTS; p++) {
      let expected = base * vigor[p];
      expected += 2.2 * jitter();
      expected = clamp(expected, 0, MAX_FLOWERS);

      let total = Math.round(expected);
      total = clamp(total, 0, MAX_FLOWERS);

      let pf = fShare + 0.05 * jitter();
      pf = clamp(pf, 0, 0.90);

      let female = 0;
      for (let k = 0; k < total; k++) {
        if (rng() < pf) female++;
      }
      const male = total - female;

      dayRow.push({ male, female, total });
    }
    out.push(dayRow);
  }

  data = out;
  lastSeed = seedStr;
}

/* =========================================================
   EXTRACCIÓN DE SERIES
   ========================================================= */
function getDayValues(day1to21, variable) {
  return data[day1to21 - 1].map(obj => obj[variable]);
}

function getAggValues(aggKey, variable) {
  let days = [];
  if (aggKey === "w1") days = [1, 2, 3, 4, 5, 6, 7];
  else if (aggKey === "w2") days = [8, 9, 10, 11, 12, 13, 14];
  else if (aggKey === "w3") days = [15, 16, 17, 18, 19, 20, 21];
  else days = Array.from({ length: 21 }, (_, i) => i + 1);

  const vals = [];
  for (const d of days) {
    for (let p = 0; p < N_PLANTS; p++) {
      vals.push(data[d - 1][p][variable]);
    }
  }
  return vals;
}

function labelVar(v) {
  if (v === "male") return "Masculinas";
  if (v === "female") return "Femeninas";
  return "Total";
}

/* =========================================================
   TABLAS
   ========================================================= */
function renderTable() {
  const mode = document.getElementById("tableSel")?.value || "day";
  const day = +document.getElementById("daySel")?.value || 1;
  let html = "";

  const tableArea = document.getElementById("tableArea");
  if (!tableArea) return;

  if (mode === "day") {
    const row = data[day - 1];
    html += `<div class="small"><strong>Tabla del día ${day}</strong> (valores por planta)</div>`;
    html += `<table><thead><tr>
      <th>Planta</th><th>Masculinas</th><th>Femeninas</th><th>Total</th>
    </tr></thead><tbody>`;
    for (let p = 0; p < N_PLANTS; p++) {
      html += `<tr>
        <td>P${p + 1}</td>
        <td>${row[p].male}</td>
        <td>${row[p].female}</td>
        <td><strong>${row[p].total}</strong></td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  if (mode === "week") {
    const weeks = [
      { k: "Semana 1 (d1–d7)", d0: 1, d1: 7 },
      { k: "Semana 2 (d8–d14)", d0: 8, d1: 14 },
      { k: "Semana 3 (d15–d21)", d0: 15, d1: 21 }
    ];

    html += `<div class="small"><strong>Resumen semanal por planta</strong> (Total = M+F)</div>`;
    html += `<table><thead><tr>
      <th>Planta</th>
      <th>S1 Total</th><th>S2 Total</th><th>S3 Total</th>
      <th>3 Semanas</th>
    </tr></thead><tbody>`;

    for (let p = 0; p < N_PLANTS; p++) {
      const totals = weeks.map(w => {
        let s = 0;
        for (let d = w.d0; d <= w.d1; d++) s += data[d - 1][p].total;
        return s;
      });
      const all = totals.reduce((a, b) => a + b, 0);

      html += `<tr>
        <td>P${p + 1}</td>
        <td>${totals[0]}</td>
        <td>${totals[1]}</td>
        <td>${totals[2]}</td>
        <td><strong>${all}</strong></td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  if (mode === "all") {
    html += `<div class="small"><strong>Tabla completa</strong> (21 días × 5 plantas)</div>`;
    html += `<table><thead><tr>
      <th>Día</th>
      ${Array.from({ length: N_PLANTS }, (_, i) =>
        `<th>P${i + 1} M</th><th>P${i + 1} F</th><th>P${i + 1} T</th>`
      ).join("")}
    </tr></thead><tbody>`;

    for (let d = 1; d <= N_DAYS; d++) {
      html += `<tr><td><strong>${d}</strong></td>`;
      for (let p = 0; p < N_PLANTS; p++) {
        const o = data[d - 1][p];
        html += `<td>${o.male}</td><td>${o.female}</td><td><strong>${o.total}</strong></td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  }

  tableArea.innerHTML = html;
}

/* =========================================================
   PASOS DE VERIFICACIÓN (para el cuaderno)
   ========================================================= */
function renderSteps() {
  const stepsArea = document.getElementById("stepsArea");
  if (!stepsArea) return;

  const day = +document.getElementById("daySel")?.value || 1;
  const variable = document.getElementById("varSel")?.value || "total";
  const vals = getDayValues(day, variable);
  const bp = boxplotStats(vals);

  const text = (arr) => arr.map(x => String(x)).join(", ");

  const html = `
    <div class="stepBox">
      <h3>Verificación en el cuaderno (Día ${day} — ${labelVar(variable)})</h3>
      <div class="small">1) Ordena los 5 valores:</div>
      <div class="mono">${text(bp.sorted)}</div>
      <div class="small" style="margin-top:8px">
        2) Mediana (Q2): valor central (n=5 → 3er valor). <span class="pillOk">Q2 = ${round2(bp.q2)}</span>
      </div>
    </div>

    <div class="stepBox">
      <h3>Método Tukey (mediana de mitades)</h3>
      <div class="small">Mitad inferior (sin incluir Q2):</div>
      <div class="mono">${text(bp.lower)}</div>
      <div class="small">Mitad superior (sin incluir Q2):</div>
      <div class="mono">${text(bp.upper)}</div>
      <div class="small" style="margin-top:8px">
        <strong>Q1 = ${round2(bp.q1)}</strong> &nbsp;|&nbsp; <strong>Q3 = ${round2(bp.q3)}</strong> &nbsp;|&nbsp;
        <strong>RIC = ${round2(bp.iqr)}</strong>
      </div>
    </div>
  `;

  stepsArea.innerHTML = html;
}

/* =========================================================
   KPI
   ========================================================= */
function renderKPI() {
  const kpiArea = document.getElementById("kpiArea");
  if (!kpiArea) return;

  const day = +document.getElementById("daySel")?.value || 1;
  const variable = document.getElementById("varSel")?.value || "total";
  const vals = getDayValues(day, variable);
  const bp = boxplotStats(vals);
  const m = mean(vals);

  kpiArea.innerHTML = `
    <div class="box"><div class="t">Día</div><div class="v">${day}</div></div>
    <div class="box"><div class="t">Variable</div><div class="v">${labelVar(variable)}</div></div>
    <div class="box"><div class="t">Media</div><div class="v">${round2(m)}</div></div>
    <div class="box"><div class="t">Mediana (Q2)</div><div class="v">${round2(bp.q2)}</div></div>
    <div class="box"><div class="t">Q1 / Q3</div><div class="v">${round2(bp.q1)} / ${round2(bp.q3)}</div></div>
    <div class="box"><div class="t">RIC</div><div class="v">${round2(bp.iqr)}</div></div>
    <div class="box"><div class="t">Bigotes</div><div class="v">${bp.whiskerLo} – ${bp.whiskerHi}</div></div>
    <div class="box"><div class="t">Cercas (1.5×RIC)</div><div class="v">${round2(bp.loFence)} – ${round2(bp.hiFence)}</div></div>
  `;
}

/* =========================================================
   CANVAS: helpers
   ========================================================= */
function clearCanvas(ctx, w, h) { ctx.clearRect(0, 0, w, h); }

function drawBackground(ctx, w, h) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // grid suave
  ctx.strokeStyle = "rgba(17,24,39,.06)";
  ctx.lineWidth = 1;
  const step = 50;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function niceTicks(min, max, n = 5) {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / (n - 1);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const mult = raw / pow;

  let step = 1;
  if (mult <= 1.5) step = 1;
  else if (mult <= 3) step = 2;
  else if (mult <= 7) step = 5;
  else step = 10;
  step *= pow;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks = [];
  for (let v = start; v <= end + 1e-9; v += step) ticks.push(v);
  return ticks;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const min = Math.min(w, h);
  r = Math.min(r, min / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* =========================================================
   DIBUJO: Boxplot
   ========================================================= */
function drawBoxplot(canvasId, values, title) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;

  clearCanvas(ctx, W, H);
  drawBackground(ctx, W, H);

  const padL = 56, padR = 18, padT = 34, padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const bp = boxplotStats(values);
  const minV = Math.min(...values, bp.loFence, bp.hiFence);
  const maxV = Math.max(...values, bp.loFence, bp.hiFence);
  const denom = (maxV - minV) || 1;

  const y = (v) => padT + (maxV - v) * (plotH / denom);

  // axes
  ctx.strokeStyle = "rgba(17,24,39,.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // ticks
  const ticks = niceTicks(minV, maxV, 6);
  ctx.fillStyle = "rgba(17,24,39,.70)";
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  for (const t of ticks) {
    const yy = y(t);
    ctx.strokeStyle = "rgba(17,24,39,.08)";
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
    ctx.fillText(String(t), 10, yy + 4);
  }

  // title
  ctx.fillStyle = "rgba(17,24,39,.90)";
  ctx.font = "bold 13px " + getComputedStyle(document.body).fontFamily;
  ctx.fillText(title, padL, 18);

  const cx = padL + plotW * 0.55;
  const boxW = Math.min(200, plotW * 0.35);

  // whisker line
  ctx.strokeStyle = "rgba(17,24,39,.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, y(bp.whiskerLo));
  ctx.lineTo(cx, y(bp.whiskerHi));
  ctx.stroke();

  // caps
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - boxW * 0.22, y(bp.whiskerLo));
  ctx.lineTo(cx + boxW * 0.22, y(bp.whiskerLo));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - boxW * 0.22, y(bp.whiskerHi));
  ctx.lineTo(cx + boxW * 0.22, y(bp.whiskerHi));
  ctx.stroke();

  // box Q1-Q3
  const yTop = y(bp.q3);
  const yBot = y(bp.q1);
  ctx.fillStyle = "rgba(37,99,235,.18)";
  ctx.strokeStyle = "rgba(37,99,235,.85)";
  ctx.lineWidth = 2.2;
  roundRect(ctx, cx - boxW / 2, yTop, boxW, yBot - yTop, 10, true, true);

  // median
  ctx.strokeStyle = "rgba(22,163,74,.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - boxW / 2, y(bp.q2));
  ctx.lineTo(cx + boxW / 2, y(bp.q2));
  ctx.stroke();

  // raw points (jitter fijo)
  ctx.fillStyle = "rgba(17,24,39,.78)";
  for (let i = 0; i < values.length; i++) {
    const jitter = (i - 2) * 4;
    circle(ctx, cx + jitter, y(values[i]), 4);
  }

  // outliers
  if (bp.outliers.length) {
    ctx.fillStyle = "rgba(217,119,6,.95)";
    for (const v of bp.outliers) {
      circle(ctx, cx + boxW * 0.36, y(v), 5);
    }
  }

  ctx.fillStyle = "rgba(75,85,99,.85)";
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  ctx.fillText("Criterio: bigotes por 1.5×RIC (Tukey). Puntos: 5 plantas.", padL, H - 16);
}

/* =========================================================
   DIBUJO: Histograma
   ========================================================= */
function drawHistogram(canvasId, values, title, binsOpt) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;

  clearCanvas(ctx, W, H);
  drawBackground(ctx, W, H);

  const padL = 56, padR = 18, padT = 34, padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minV = 0;
  const maxV = MAX_FLOWERS;

  let k;
  if (binsOpt === "auto") k = clamp(Math.round(Math.sqrt(values.length)), 5, 13);
  else k = +binsOpt;

  const binW = (maxV - minV) / k;
  const counts = Array.from({ length: k }, () => 0);

  for (const v of values) {
    let idx = Math.floor((v - minV) / binW);
    if (idx < 0) idx = 0;
    if (idx >= k) idx = k - 1;
    counts[idx]++;
  }

  const maxC = Math.max(...counts, 1);

  // axes
  ctx.strokeStyle = "rgba(17,24,39,.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // y ticks
  const yticks = niceTicks(0, maxC, 5);
  ctx.fillStyle = "rgba(17,24,39,.70)";
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  for (const t of yticks) {
    const yy = padT + plotH - (t / maxC) * plotH;
    ctx.strokeStyle = "rgba(17,24,39,.08)";
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
    ctx.fillText(String(t), 10, yy + 4);
  }

  // title
  ctx.fillStyle = "rgba(17,24,39,.90)";
  ctx.font = "bold 13px " + getComputedStyle(document.body).fontFamily;
  ctx.fillText(title, padL, 18);

  // bars
  const barGap = 4;
  const barW = (plotW / k) - barGap;

  for (let i = 0; i < k; i++) {
    const x = padL + i * (plotW / k) + barGap / 2;
    const h = (counts[i] / maxC) * plotH;
    const y = padT + plotH - h;

    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, "rgba(37,99,235,.70)");
    grad.addColorStop(1, "rgba(37,99,235,.22)");
    ctx.fillStyle = grad;

    roundRect(ctx, x, y, barW, h, 10, true, false);

    ctx.strokeStyle = "rgba(17,24,39,.10)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, barW, h, 10, false, true);
  }

  // x labels
  ctx.fillStyle = "rgba(75,85,99,.95)";
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  const stepLabel = Math.max(1, Math.round(k / 6));

  for (let i = 0; i < k; i += stepLabel) {
    const a = Math.round(minV + i * binW);
    const b = Math.round(minV + (i + 1) * binW);
    const x = padL + i * (plotW / k);
    ctx.fillText(`${a}–${b}`, x + 2, H - 18);
  }

  ctx.fillStyle = "rgba(107,114,128,.95)";
  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  ctx.fillText(`n=${values.length} | intervalos=${k}`, padL, H - 4);
}

/* =========================================================
   EXPORT CSV
   ========================================================= */
function exportCSV() {
  let rows = [];
  rows.push(["dia", "planta", "masculinas", "femeninas", "total"].join(","));
  for (let d = 1; d <= N_DAYS; d++) {
    for (let p = 1; p <= N_PLANTS; p++) {
      const o = data[d - 1][p - 1];
      rows.push([d, `P${p}`, o.male, o.female, o.total].join(","));
    }
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `flor_calabaza_5plantas_21dias_${lastSeed.replace(/[^a-z0-9-_]/gi, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/* =========================================================
   UPDATE GENERAL
   ========================================================= */
function updateAll() {
  const daySel = document.getElementById("daySel");
  const day = daySel ? +daySel.value : 1;

  const dayLabel = document.getElementById("dayLabel");
  if (dayLabel) dayLabel.textContent = day;

  const variable = document.getElementById("varSel")?.value || "total";
  const agg = document.getElementById("aggSel")?.value || "all";
  const binsOpt = document.getElementById("binSel")?.value || "auto";

  const dayVals = getDayValues(day, variable);

  drawBoxplot("boxCanvas", dayVals, `Caja y bigotes — Día ${day} — ${labelVar(variable)} (5 plantas)`);
  drawHistogram("histACanvas", dayVals, `Histograma A (por día) — Día ${day} — ${labelVar(variable)} (5 plantas)`, binsOpt);

  const aggVals = getAggValues(agg, variable);
  const aggLabel =
    (agg === "w1") ? "Semana 1 (días 1–7)" :
    (agg === "w2") ? "Semana 2 (días 8–14)" :
    (agg === "w3") ? "Semana 3 (días 15–21)" :
    "3 semanas (días 1–21)";

  drawHistogram("histBCanvas", aggVals, `Histograma B (agregado) — ${aggLabel} — ${labelVar(variable)} (n=${aggVals.length})`, binsOpt);

  renderKPI();
  renderTable();
  renderSteps();
}

/* =========================================================
   UI BINDING
   ========================================================= */
function bindUI() {
  const btnGenerate = document.getElementById("btnGenerate");
  if (btnGenerate) {
    btnGenerate.addEventListener("click", () => {
      const seed = (document.getElementById("seed")?.value || "").trim() || "CALABAZA-2026";
      generateData(seed);
      updateAll();
    });
  }

  const btnExport = document.getElementById("btnExport");
  if (btnExport) btnExport.addEventListener("click", exportCSV);

  ["varSel", "daySel", "aggSel", "binSel", "tableSel"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", updateAll);
    el.addEventListener("input", updateAll);
  });
}

/* =========================================================
   INIT (robusto)
   ========================================================= */

function safeInit() {
  try {
    // Diagnóstico rápido
    console.log("[calabaza] JS cargó OK");

    bindUI();

    const seedInput = document.getElementById("seed");
    const seed = (seedInput?.value || "").trim() || "CALABAZA-2026";

    // Si no existe boxCanvas, es señal de que el HTML no coincide o el script está mal ubicado
    const c = document.getElementById("boxCanvas");
    if (!c) {
      console.error("[calabaza] No encuentro #boxCanvas. Revisa IDs o ubicación del <script>.");
      return;
    }

    generateData(seed);
    updateAll();

    console.log("[calabaza] init terminado");
  } catch (err) {
    console.error("[calabaza] Error en init:", err);
    alert("Hay un error en calabaza.js. Abre F12 → Console para ver el detalle.");
  }
}

// Ejecuta cuando el DOM esté listo (funciona aunque el script esté en <head>)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInit);
} else {
  safeInit();
}
