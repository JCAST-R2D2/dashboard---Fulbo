/* app.js — Lógica estadística, dibujado de Canvas y Tablas Descriptivas */

const NUM_PLAYERS = 8;
const MATCHES_PER_MONTH = 4;
const MONTHS = ["Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May"];
const TOTAL_MONTHS = MONTHS.length;
const POSITIONS = ["Portero", "Defensa Central", "Lateral Derecho", "Lateral Izquierdo", "Pivote", "Mediapunta", "Extremo", "Delantero"];

let playerData = []; 

// 1. Generador de Datos (Simulación de calificaciones de partido)
function generateData() {
    playerData = [];
    for (let p = 0; p < NUM_PLAYERS; p++) {
        const matchRatings = [];
        
        // Atributos del jugador: base de calidad y consistencia
        const baseRating = 6.5 + Math.random() * 1.5; // Promedio entre 6.5 y 8.0
        const variance = 0.4 + Math.random() * 1.2;   // Qué tan irregular es

        for (let m = 0; m < TOTAL_MONTHS; m++) {
            const monthlyData = [];
            for (let d = 0; d < MATCHES_PER_MONTH; d++) {
                
                // Variación normal del partido
                const matchNoise = (Math.random() - 0.5) * variance * 2;
                let rating = baseRating + matchNoise;

                // Probabilidad de un partido atípico (lesión leve, expulsión o partido perfecto)
                if (Math.random() < 0.05) {
                    rating += (Math.random() > 0.5 ? 1.5 : -2.0);
                }

                // Limitar calificaciones entre 4.0 y 10.0
                rating = Math.max(4.0, Math.min(10.0, rating));
                monthlyData.push(parseFloat(rating.toFixed(1)));
            }
            matchRatings.push(monthlyData);
        }
        playerData.push(matchRatings);
    }
}

// 2. Funciones Estadísticas (Método Tukey y Desviación Estándar)
function calcStats(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    const getMedian = (arr) => {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    const q2 = getMedian(sorted);
    const midIndex = Math.floor(sorted.length / 2);
    const lowerHalf = sorted.slice(0, midIndex);
    const upperHalf = sorted.slice(sorted.length % 2 === 0 ? midIndex : midIndex + 1);
    
    const q1 = getMedian(lowerHalf);
    const q3 = getMedian(upperHalf);
    const iqr = q3 - q1;

    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
    
    const whiskerLo = sorted.find(v => v >= lowerFence) || min;
    const whiskerHi = [...sorted].reverse().find(v => v <= upperFence) || max;

    // Calcular media y desviación típica (estándar)
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, q1, q2, q3, iqr, whiskerLo, whiskerHi, outliers, mean, stdDev, n: values.length };
}

// Extrae todos los partidos de un jugador en un solo arreglo
function getFlatData(playerIndex) {
    let flat = [];
    playerData[playerIndex].forEach(month => flat = flat.concat(month));
    return flat;
}

// 3. Renderizar Tabla de Estadísticos Descriptivos
function renderStatsTable() {
    const tbody = document.querySelector('#statsTable tbody');
    tbody.innerHTML = '';

    for (let i = 0; i < NUM_PLAYERS; i++) {
        const flatData = getFlatData(i); // Los 40 partidos del jugador
        const stats = calcStats(flatData);
        
        const tr = document.createElement('tr');
        // Estilizamos las columnas igual que en tu ejemplo de referencia
        tr.innerHTML = `
            <td><strong>Jug. ${i+1}</strong> <span style="font-size:0.8em; color:var(--text-muted)">(${POSITIONS[i]})</span></td>
            <td style="color: var(--primary); font-weight: bold;">${stats.n}</td>
            <td style="color: var(--warning); font-weight: bold;">${stats.mean.toFixed(1)}</td>
            <td>${stats.q2.toFixed(1)}</td>
            <td>${stats.q1.toFixed(1)}</td>
            <td>${stats.q3.toFixed(1)}</td>
            <td>${stats.iqr.toFixed(1)}</td>
            <td>${stats.stdDev.toFixed(2)}</td>
            <td style="color: var(--primary);">${stats.min.toFixed(1)}</td>
            <td style="color: var(--danger);">${stats.max.toFixed(1)}</td>
            <td>${stats.outliers.length}</td>
        `;
        tbody.appendChild(tr);
    }
}

// 4. Dibujo de Canvas - Cajas y Bigotes
function drawBoxplots(playerIndex) {
    const canvas = document.getElementById('boxplotCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const monthlyData = playerData[playerIndex];
    const globalMin = 4.0;
    const globalMax = 10.0;

    const padL = 40, padR = 20, padT = 20, padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const scaleY = (val) => padT + plotH - ((val - globalMin) / (globalMax - globalMin)) * plotH;

    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    for (let i = 4; i <= 10; i++) {
        let y = scaleY(i);
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.fillStyle = '#64748b';
        ctx.fillText(i.toFixed(1), 15, y + 4);
    }
    ctx.stroke();

    const boxWidth = (plotW / TOTAL_MONTHS) * 0.5;

    monthlyData.forEach((monthRatings, i) => {
        const stats = calcStats(monthRatings);
        const cx = padL + (i + 0.5) * (plotW / TOTAL_MONTHS);

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, scaleY(stats.whiskerLo));
        ctx.lineTo(cx, scaleY(stats.whiskerHi));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - boxWidth/4, scaleY(stats.whiskerLo)); ctx.lineTo(cx + boxWidth/4, scaleY(stats.whiskerLo));
        ctx.moveTo(cx - boxWidth/4, scaleY(stats.whiskerHi)); ctx.lineTo(cx + boxWidth/4, scaleY(stats.whiskerHi));
        ctx.stroke();

        const boxTop = scaleY(stats.q3);
        const boxBot = scaleY(stats.q1);
        ctx.fillStyle = 'rgba(79, 70, 229, 0.2)'; 
        ctx.strokeStyle = '#4f46e5';
        ctx.fillRect(cx - boxWidth/2, boxTop, boxWidth, boxBot - boxTop);
        ctx.strokeRect(cx - boxWidth/2, boxTop, boxWidth, boxBot - boxTop);

        ctx.strokeStyle = '#ef4444'; 
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - boxWidth/2, scaleY(stats.q2));
        ctx.lineTo(cx + boxWidth/2, scaleY(stats.q2));
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        stats.outliers.forEach(outlier => {
            ctx.beginPath();
            ctx.arc(cx, scaleY(outlier), 4, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(MONTHS[i], cx, H - 10);
    });
}

// 5. Dibujo de Canvas - Histograma
function drawHistogram(playerIndex) {
    const canvas = document.getElementById('histogramCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const data = getFlatData(playerIndex);
    const bins = 12; 
    const min = 4.0;
    const max = 10.0;
    const binWidth = (max - min) / bins;

    const frequencies = new Array(bins).fill(0);
    data.forEach(val => {
        let binIdx = Math.floor((val - min) / binWidth);
        if (binIdx >= bins) binIdx = bins - 1; 
        frequencies[binIdx]++;
    });

    const maxFreq = Math.max(...frequencies, 5); 
    
    const padL = 40, padR = 20, padT = 20, padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const barWidth = plotW / bins;

    frequencies.forEach((freq, i) => {
        const barHeight = (freq / maxFreq) * plotH;
        const x = padL + i * barWidth;
        const y = padT + plotH - barHeight;

        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        const labelVal = (min + i * binWidth).toFixed(1);
        ctx.fillText(labelVal, x + barWidth/2, H - 10);
    });
}

// 6. Actualizar la Interfaz
function updateDashboard() {
    const sel = document.getElementById('playerSel');
    const idx = parseInt(sel.value);

    let allRatings = [];
    for(let i = 0; i < NUM_PLAYERS; i++){
        allRatings = allRatings.concat(getFlatData(i));
    }
    
    const globalAvg = (allRatings.reduce((a,b) => a+b, 0) / allRatings.length).toFixed(2);
    const globalMax = Math.max(...allRatings).toFixed(1);
    const globalMin = Math.min(...allRatings).toFixed(1);

    document.getElementById('kpi-avg').innerText = globalAvg;
    document.getElementById('kpi-max').innerText = globalMax;
    document.getElementById('kpi-min').innerText = globalMin;

    drawBoxplots(idx);
    drawHistogram(idx);
}

// 7. Navegación por Pestañas
function openTab(evt, tabId) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
    }

    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        tabBtns[i].style.backgroundColor = "var(--primary)"; 
        tabBtns[i].style.opacity = "0.7";
        tabBtns[i].classList.remove("active");
    }

    document.getElementById(tabId).style.display = "block";
    evt.currentTarget.style.opacity = "1";
    evt.currentTarget.classList.add("active");
    
    if(tabId === 'prob1') {
        updateDashboard();
    }
    // NUEVO: Dibujar los 6 diagramas de Venn cuando abrimos el Problema 3
    if(tabId === 'prob3') {
        drawVennRegion('vennA1', 'AnB');    // Numerador inciso A
        drawVennRegion('vennA2', 'A');      // Denominador inciso A
        drawVennRegion('vennB1', 'BnC');    // Numerador inciso B
        drawVennRegion('vennB2', 'C');      // Denominador inciso B
        drawVennRegion('vennC1', 'AnBnC');  // Numerador inciso C
        drawVennRegion('vennC2', 'AnC');    // Denominador inciso C
    }
    if(tabId === 'prob4') {
        drawDistribution();
    }
}
// 8. Inicialización
function init() {
    initDistributions();
    generateData();
    renderStatsTable(); // Dibuja la tabla con los datos generados
    
    const sel = document.getElementById('playerSel');
    sel.innerHTML = '';
    
    for(let i=0; i<NUM_PLAYERS; i++){
        sel.innerHTML += `<option value="${i}">Jugador ${i+1} (${POSITIONS[i]})</option>`;
    }
    
    sel.addEventListener('change', updateDashboard);
    document.getElementById('btnRegenerate').addEventListener('click', () => {
        generateData();
        renderStatsTable(); // Actualiza la tabla si se simula una nueva temporada
        updateDashboard();
    });

    updateDashboard();

    // Estilo inicial de los botones de pestañas
    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        if(!tabBtns[i].classList.contains("active")) {
            tabBtns[i].style.opacity = "0.7";
        }
    }
}
// 9. Dibujo dinámico de áreas de Venn
function drawVennRegion(canvasId, regionToShade) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Posiciones de los círculos como en la imagen (a: izq, b: der, c: abajo)
    const r = 65; 
    const cA = new Path2D(); cA.arc(110, 100, r, 0, Math.PI * 2);
    const cB = new Path2D(); cB.arc(190, 100, r, 0, Math.PI * 2);
    const cC = new Path2D(); cC.arc(150, 160, r, 0, Math.PI * 2);

    // Sombreado de la región específica usando "clipping" (recortes mágicos de Canvas)
    ctx.fillStyle = '#374151'; // Gris oscuro para el sombreado
    ctx.save();
    
    if (regionToShade === 'A') {
        ctx.fill(cA);
    } else if (regionToShade === 'C') {
        ctx.fill(cC);
    } else if (regionToShade === 'AnB') {
        ctx.clip(cA); ctx.fill(cB);
    } else if (regionToShade === 'BnC') {
        ctx.clip(cB); ctx.fill(cC);
    } else if (regionToShade === 'AnC') {
        ctx.clip(cA); ctx.fill(cC);
    } else if (regionToShade === 'AnBnC') {
        ctx.clip(cA); ctx.clip(cB); ctx.fill(cC);
    }
    
    ctx.restore();

    // Dibujar los contornos de los círculos encima
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#000000';
    ctx.stroke(cA); 
    ctx.stroke(cB); 
    ctx.stroke(cC);

    // Etiquetas a, b, c
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('a', 60, 65);
    ctx.fillText('b', 225, 65);
    ctx.fillText('c', 145, 240);
}
// =========================================================
// 10. SIMULADOR DE DISTRIBUCIONES (Pestaña 4)
// =========================================================

// Funciones matemáticas auxiliares
function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}
function combinatoria(n, k) {
    return factorial(n) / (factorial(k) * factorial(n - k));
}

// Dibujo principal de la distribución
function drawDistribution() {
    const canvas = document.getElementById('distCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const distType = document.getElementById('distSel').value;
    
    // Ocultar todos los controles y fórmulas
    document.querySelectorAll('.dist-ctrl').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.dist-form').forEach(el => el.style.display = 'none');
    
    // Mostrar el activo
    document.getElementById(`ctrl-${distType}`).style.display = 'block';
    document.getElementById(`form-${distType}`).style.display = 'block';

    const padL = 50, padR = 20, padT = 20, padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Configuración visual (modo oscuro inspirado en tu imagen)
    ctx.fillStyle = '#111827'; 
    ctx.fillRect(0, 0, W, H);
    
    // Rejilla de fondo
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for(let i=0; i<=5; i++) {
        let y = padT + i*(plotH/5);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    }

    let minX, maxX, maxY, step, points = [];

    // --- CÁLCULOS SEGÚN LA DISTRIBUCIÓN ---
    if (distType === 'normal') {
        const mu = parseFloat(document.getElementById('sl-mu').value);
        const sigma = parseFloat(document.getElementById('sl-sigma').value);
        document.getElementById('val-mu').innerText = mu.toFixed(1);
        document.getElementById('val-sigma').innerText = sigma.toFixed(1);

        minX = -10; maxX = 10;
        maxY = 1 / (sigma * Math.sqrt(2 * Math.PI)); // El pico más alto
        if (maxY < 0.3) maxY = 0.4; // Zoom dinámico
        
        for (let x = minX; x <= maxX; x += 0.1) {
            let y = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
            points.push({x, y});
        }
    } 
    else if (distType === 'binomial') {
        const n = parseInt(document.getElementById('sl-n').value);
        const p = parseFloat(document.getElementById('sl-p-bin').value);
        document.getElementById('val-n').innerText = n;
        document.getElementById('val-p-bin').innerText = p.toFixed(2);

        minX = 0; maxX = n; maxY = 0;
        for (let k = 0; k <= n; k++) {
            let y = combinatoria(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
            points.push({x: k, y});
            if (y > maxY) maxY = y;
        }
    }
    else if (distType === 'poisson') {
        const lambda = parseInt(document.getElementById('sl-lambda-poi').value);
        document.getElementById('val-lambda-poi').innerText = lambda;

        minX = 0; maxX = Math.max(20, lambda * 2); maxY = 0;
        for (let k = 0; k <= maxX; k++) {
            let y = (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
            points.push({x: k, y});
            if (y > maxY) maxY = y;
        }
    }
    else if (distType === 'geometrica') {
        const p = parseFloat(document.getElementById('sl-p-geo').value);
        document.getElementById('val-p-geo').innerText = p.toFixed(2);

        minX = 1; maxX = 15; maxY = p; 
        for (let k = 1; k <= maxX; k++) {
            let y = Math.pow(1 - p, k - 1) * p;
            points.push({x: k, y});
        }
    }
    else if (distType === 'exponencial') {
        const lambda = parseFloat(document.getElementById('sl-lambda-exp').value);
        document.getElementById('val-lambda-exp').innerText = lambda.toFixed(1);

        minX = 0; maxX = 5; maxY = lambda;
        for (let x = 0; x <= maxX; x += 0.05) {
            let y = lambda * Math.exp(-lambda * x);
            points.push({x, y});
        }
    }

    // Funciones de escala para dibujar
    maxY = maxY * 1.1; // Margen superior
    if (maxY === 0) maxY = 1;
    const scaleX = (val) => padL + ((val - minX) / (maxX - minX)) * plotW;
    const scaleY = (val) => padT + plotH - (val / maxY) * plotH;

    // --- RENDERIZADO VISUAL ---
    
    // 1. Ejes Y (Valores)
    ctx.fillStyle = '#9ca3af'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
    for(let i=0; i<=5; i++) {
        let valY = (maxY / 5) * i;
        ctx.fillText(valY.toFixed(2), padL - 10, padT + plotH - i*(plotH/5) + 4);
    }

    // 2. Dibujar las gráficas (Continua vs Discreta)
    ctx.strokeStyle = '#f97316'; // Naranja vibrante
    ctx.fillStyle = 'rgba(249, 115, 22, 0.4)'; // Naranja transparente para relleno

    if (distType === 'normal' || distType === 'exponencial') {
        // Área rellena continua
        ctx.beginPath();
        ctx.moveTo(scaleX(points[0].x), scaleY(0));
        for (let pt of points) {
            ctx.lineTo(scaleX(pt.x), scaleY(pt.y));
        }
        ctx.lineTo(scaleX(points[points.length-1].x), scaleY(0));
        ctx.fill();

        // Línea superior
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let pt of points) {
            ctx.lineTo(scaleX(pt.x), scaleY(pt.y));
        }
        ctx.stroke();
    } else {
        // Gráfico de barras / bastones para discretas
        const barWidth = plotW / (maxX - minX + 1) * 0.6;
        for (let pt of points) {
            const x = scaleX(pt.x);
            const y = scaleY(pt.y);
            
            ctx.fillStyle = 'rgba(249, 115, 22, 0.8)';
            ctx.fillRect(x - barWidth/2, y, barWidth, scaleY(0) - y);
            
            // Punto en la cima
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI*2);
            ctx.fillStyle = '#f97316';
            ctx.fill();
        }
    }

    // 3. Ejes X (Etiquetas)
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center';
    let stepX = Math.ceil((maxX - minX) / 20); // No amontonar números
    for(let i=Math.ceil(minX); i<=maxX; i+=stepX) {
        ctx.fillText(i, scaleX(i), H - 15);
    }
}

// Escuchar cambios en todos los controles de la Pestaña 4
function initDistributions() {
    document.getElementById('distSel').addEventListener('change', drawDistribution);
    document.getElementById('sl-mu').addEventListener('input', drawDistribution);
    document.getElementById('sl-sigma').addEventListener('input', drawDistribution);
    document.getElementById('sl-n').addEventListener('input', drawDistribution);
    document.getElementById('sl-p-bin').addEventListener('input', drawDistribution);
    document.getElementById('sl-lambda-poi').addEventListener('input', drawDistribution);
    document.getElementById('sl-p-geo').addEventListener('input', drawDistribution);
    document.getElementById('sl-lambda-exp').addEventListener('input', drawDistribution);
}

// AGREGAR AL FINAL DE TU FUNCIÓN openTab() EXISTENTE:
// if(tabId === 'prob4') {
//     drawDistribution();
// }
window.onload = init;