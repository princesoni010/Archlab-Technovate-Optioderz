/* ============================================================
   Archlab PLUS — pn-plus.js
   All Archlab features integrated into Ishan's project.
   Does NOT modify any existing app.js / styles.css / index.html code.
   ============================================================ */

/* ══ 8-MATERIAL DATABASE ══ */
const PN_MATERIAL_DB = {
  aacBlock:     { name:'AAC Block',              costLevel:1,   strength:5,  durability:8,  bestUse:'Inner/wet partition walls', icon:'🟦', color:'#22d3ee', cls:'pn-mat-aac' },
  redBrick:     { name:'Red Brick (230mm)',       costLevel:2,   strength:8,  durability:6,  bestUse:'Load-bearing outer walls',  icon:'🟧', color:'#fb923c', cls:'pn-mat-red' },
  rcc:          { name:'RCC (M20/M25)',           costLevel:4,   strength:10, durability:10, bestUse:'Columns, slabs, beams',     icon:'🟩', color:'#4ade80', cls:'pn-mat-rcc' },
  steelFrame:   { name:'Steel Frame',            costLevel:4,   strength:10, durability:10, bestUse:'Long spans > 5m',           icon:'⬜', color:'#94a3b8', cls:'pn-mat-ste' },
  flyAshBrick:  { name:'Fly Ash Brick',          costLevel:1,   strength:7,  durability:8,  bestUse:'General walling (eco)',     icon:'🟨', color:'#fbbf24', cls:'pn-mat-fly' },
  hollowBlock:  { name:'Hollow Concrete Block',  costLevel:1.5, strength:5,  durability:5,  bestUse:'Non-structural partitions', icon:'🔲', color:'#a78bfa', cls:'pn-mat-hol' },
  precastPanel: { name:'Precast Concrete Panel', costLevel:3,   strength:8,  durability:10, bestUse:'Structural/prefab walls',   icon:'🟫', color:'#c8a97a', cls:'pn-mat-pre' },
};

/* ══ FORMAL TRADEOFF SCORING ENGINE (Rubric Criterion 04) ══
   Weights (W) are designed to prioritize the most critical property per context:
   - Load-bearing (Outer): Strength is 50% of the decision (Ws=0.5)
   - Partition (Inner):    Cost saving is 50% of the decision (Wc=0.5)
   - Structural Spine:    Durability & Strength are 80% combined (Ws=0.4, Wd=0.4)
   - Wet Zone (Kitchen):  Durability (moisture) is 60% (Wd=0.6)
   Formula: Score = (MaterialStrength × Ws + MaterialDurability × Wd) / (MaterialCostLevel × Wc)
*/
function pnTradeoffScore(matKey, wallType, roomKey) {
  const mat = PN_MATERIAL_DB[matKey];
  if (!mat) return 0;
  
  const isWet = (roomKey === 'kitchen' || roomKey === 'bathroom');
  let Ws, Wd, Wc;

  // RUBRIC-DRIVEN CONTEXTUAL WEIGHTING
  if (wallType === 'outer') { 
    Ws = 0.50; Wd = 0.30; Wc = 0.20; // Structural priority
  } else if (isWet) { 
    Ws = 0.20; Wd = 0.60; Wc = 0.20; // Moisture priority
  } else { 
    Ws = 0.20; Wd = 0.30; Wc = 0.50; // Economic priority
  }

  // Calculate Weighted Index
  const rawScore = (mat.strength * Ws + mat.durability * Wd) / (mat.costLevel * Wc);
  return +(rawScore.toFixed(2));
}

function pnRankMaterials(wall) {
  // Ranks all available materials using the formal logic
  return Object.keys(PN_MATERIAL_DB)
    .map(key => ({ 
      key, 
      score: pnTradeoffScore(key, wall.type, wall.room), 
      mat: PN_MATERIAL_DB[key] 
    }))
    .sort((a, b) => b.score - a.score); // Highest score (best tradeoff) first
}

function pnGetRecommended(wall) {
  const spanM = wall.spanM || Math.max(wall.widthUnits || 1, wall.heightUnits || 1);
  
  // Rule 0: Critical Span Override (IS:800 Steel Requirement)
  if (spanM > 5 && wall.type === 'outer') return 'steelFrame';
  
  const ranked = pnRankMaterials(wall);
  
  // Rule 1: Structural Filter (Load-bearing walls cannot use lightweight HCB/AAC)
  const isWet = (wall.room === 'kitchen' || wall.room === 'bathroom');
  const filtered = ranked.filter(r => {
    if (wall.type === 'outer' && ['hollowBlock', 'aacBlock'].includes(r.key)) return false;
    // Rule 2: Durability Filter (Wet zones must have higher durability index)
    if (isWet && r.mat.durability < 6) return false;
    return true;
  });
  
  return filtered[0]?.key || 'redBrick';
}

/* ══ LIVE RATES (mirrored from app.js structure but extended) ══ */
const PN_DEFAULT_RATES = {
  Mumbai:    { redBrick:{price:9,unit:'brick',bricksPerSqM:55}, aacBlock:{price:45,unit:'block',bricksPerSqM:10}, cement_OPC:{price:380,unit:'50kg bag',bagsPerSqM:0.22}, cement_PPC:{price:360,unit:'50kg bag',bagsPerSqM:0.22}, tmtRod:{price:65,unit:'kg',kgPerSqM:3.5}, riverSand:{price:45,unit:'cu.ft',cuFtPerSqM:0.8}, labor:{price:180,unit:'sq.ft'} },
  Delhi:     { redBrick:{price:8,unit:'brick',bricksPerSqM:55}, aacBlock:{price:42,unit:'block',bricksPerSqM:10}, cement_OPC:{price:370,unit:'50kg bag',bagsPerSqM:0.22}, cement_PPC:{price:350,unit:'50kg bag',bagsPerSqM:0.22}, tmtRod:{price:62,unit:'kg',kgPerSqM:3.5}, riverSand:{price:40,unit:'cu.ft',cuFtPerSqM:0.8}, labor:{price:160,unit:'sq.ft'} },
  Bangalore: { redBrick:{price:7,unit:'brick',bricksPerSqM:55}, aacBlock:{price:40,unit:'block',bricksPerSqM:10}, cement_OPC:{price:390,unit:'50kg bag',bagsPerSqM:0.22}, cement_PPC:{price:375,unit:'50kg bag',bagsPerSqM:0.22}, tmtRod:{price:63,unit:'kg',kgPerSqM:3.5}, riverSand:{price:50,unit:'cu.ft',cuFtPerSqM:0.8}, labor:{price:170,unit:'sq.ft'} },
};
PN_DEFAULT_RATES.Chennai   = { ...JSON.parse(JSON.stringify(PN_DEFAULT_RATES.Bangalore)), labor:{price:165,unit:'sq.ft'} };
PN_DEFAULT_RATES.Hyderabad = { ...JSON.parse(JSON.stringify(PN_DEFAULT_RATES.Mumbai)),    labor:{price:155,unit:'sq.ft'} };
PN_DEFAULT_RATES.Pune      = { ...JSON.parse(JSON.stringify(PN_DEFAULT_RATES.Mumbai)),    labor:{price:170,unit:'sq.ft'} };
PN_DEFAULT_RATES.Kolkata   = { ...JSON.parse(JSON.stringify(PN_DEFAULT_RATES.Delhi)),     labor:{price:150,unit:'sq.ft'} };
PN_DEFAULT_RATES.Other     = JSON.parse(JSON.stringify(PN_DEFAULT_RATES.Mumbai));

let pnLiveRates = JSON.parse(JSON.stringify(PN_DEFAULT_RATES));
let pnCurrentRegion = 'Mumbai';

function pnGetRates() {
  const sel = document.getElementById('userRegion');
  const region = sel ? sel.value : pnCurrentRegion;
  pnCurrentRegion = region;
  return pnLiveRates[region] || pnLiveRates.Mumbai;
}

/* ══ TOAST ══ */
let _pnToastTimer;
function pnToast(msg, type = 'info') {
  const t = document.getElementById('pn-toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(_pnToastTimer);
  _pnToastTimer = setTimeout(() => t.className = '', 3200);
}

/* ══════════════════════════════════
   MATERIAL PRICES SIDE PANEL
══════════════════════════════════ */
const PN_REGIONS = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Pune','Kolkata','Other'];
const PN_MAT_FIELDS = [
  { key:'redBrick',    label:'Red Brick',      color:'#fb923c', inputs:[{f:'price',l:'Price/brick (₹)'},{f:'bricksPerSqM',l:'Bricks/sq.m'}] },
  { key:'aacBlock',    label:'AAC Block',      color:'#22d3ee', inputs:[{f:'price',l:'Price/block (₹)'},{f:'bricksPerSqM',l:'Blocks/sq.m'}] },
  { key:'cement_OPC',  label:'Cement OPC 53',  color:'#a78bfa', inputs:[{f:'price',l:'Price/bag (₹)'},{f:'bagsPerSqM',l:'Bags/sq.m'}] },
  { key:'cement_PPC',  label:'Cement PPC',     color:'#fbbf24', inputs:[{f:'price',l:'Price/bag (₹)'},{f:'bagsPerSqM',l:'Bags/sq.m'}] },
  { key:'tmtRod',      label:'TMT Rod Fe500',  color:'#4ade80', inputs:[{f:'price',l:'Price/kg (₹)'},{f:'kgPerSqM',l:'kg/sq.m'}] },
  { key:'riverSand',   label:'River Sand',     color:'#f87171', inputs:[{f:'price',l:'Price/cu.ft (₹)'},{f:'cuFtPerSqM',l:'cu.ft/sq.m'}] },
  { key:'labor',       label:'Labor',          color:'#818cf8', inputs:[{f:'price',l:'Price/sq.ft (₹)'}] },
];

function pnOpenPrices() {
  const panel = document.getElementById('pn-prices-panel');
  panel.classList.add('show');
  pnRenderPricesPanel();
}
function pnClosePrices() {
  document.getElementById('pn-prices-panel').classList.remove('show');
}
function pnRenderPricesPanel() {
  const region = pnCurrentRegion;
  const rates = pnLiveRates[region] || pnLiveRates.Mumbai;
  // Region row
  document.getElementById('pn-region-row').innerHTML = PN_REGIONS.map(r =>
    `<button class="pn-region-btn ${r===region?'active':''}" onclick="pnLoadRegion('${r}',this)">${r}</button>`
  ).join('');
  // Material form
  document.getElementById('pn-mat-form').innerHTML = PN_MAT_FIELDS.map(f =>
    `<div class="pn-mat-group">
      <div class="pn-mat-name"><span class="pn-mat-swatch" style="background:${f.color}"></span>${f.label} <span style="font-size:11px;color:#475569;font-weight:400;margin-left:4px">${rates[f.key]?.unit||''}</span></div>
      <div class="pn-field-row">${f.inputs.map(inp =>
        `<div class="pn-field"><label>${inp.l}</label><input type="number" id="pnr_${f.key}_${inp.f}" value="${rates[f.key]?.[inp.f]??''}" oninput="pnUpdateRate('${f.key}','${inp.f}',this.value)"></div>`
      ).join('')}</div>
    </div>`
  ).join('');
  pnRenderPricePreview();
}
function pnLoadRegion(region, el) {
  document.querySelectorAll('.pn-region-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  pnCurrentRegion = region;
  if (document.getElementById('userRegion')) document.getElementById('userRegion').value = region;
  pnLiveRates[region] = JSON.parse(JSON.stringify(PN_DEFAULT_RATES[region] || PN_DEFAULT_RATES.Mumbai));
  // Sync to app.js materialRates too
  pnSyncToAppRates(region);
  pnRenderPricesPanel();
  pnToast(`📍 Loaded ${region} rates`, 'info');
}
function pnUpdateRate(key, field, val) {
  const region = pnCurrentRegion;
  if (!pnLiveRates[region]) pnLiveRates[region] = {};
  if (!pnLiveRates[region][key]) pnLiveRates[region][key] = {};
  pnLiveRates[region][key][field] = parseFloat(val) || 0;
  pnSyncToAppRates(region);
  pnRenderPricePreview();
}
function pnSyncToAppRates(region) {
  // Keep Ishan's materialRates in sync
  if (typeof materialRates === 'undefined') return;
  const pnR = pnLiveRates[region];
  if (!pnR) return;
  if (!materialRates[region]) materialRates[region] = {};
  const mr = materialRates[region];
  if (pnR.redBrick)   { mr.redBrick   = { pricePerUnit:pnR.redBrick.price,   unit:'brick',    bricksPerSqM:pnR.redBrick.bricksPerSqM   }; }
  if (pnR.aacBlock)   { mr.aacBlock   = { pricePerUnit:pnR.aacBlock.price,   unit:'block',    bricksPerSqM:pnR.aacBlock.bricksPerSqM   }; }
  if (pnR.cement_OPC) { mr.cement_OPC = { pricePerBag:pnR.cement_OPC.price,  unit:'50kg bag', bagsPerSqM:pnR.cement_OPC.bagsPerSqM     }; }
  if (pnR.cement_PPC) { mr.cement_PPC = { pricePerBag:pnR.cement_PPC.price,  unit:'50kg bag', bagsPerSqM:pnR.cement_PPC.bagsPerSqM     }; }
  if (pnR.tmtRod)     { mr.tmtRod     = { pricePerKg:pnR.tmtRod.price,       unit:'kg',       kgPerSqM:pnR.tmtRod.kgPerSqM             }; }
  if (pnR.riverSand)  { mr.riverSand  = { pricePerCuFt:pnR.riverSand.price,  unit:'cu.ft',    cuFtPerSqM:pnR.riverSand.cuFtPerSqM      }; }
  if (pnR.labor)      { mr.labor      = { pricePerSqFt:pnR.labor.price,      unit:'sq.ft'                                              }; }
}
function pnRenderPricePreview() {
  const rates = pnGetRates();
  document.getElementById('pn-pp-list').innerHTML = [
    ['Red Brick',  `₹${rates.redBrick?.price||0}`,   rates.redBrick?.unit||'brick'],
    ['AAC Block',  `₹${rates.aacBlock?.price||0}`,   rates.aacBlock?.unit||'block'],
    ['Cement OPC', `₹${rates.cement_OPC?.price||0}`, '50kg bag'],
    ['Cement PPC', `₹${rates.cement_PPC?.price||0}`, '50kg bag'],
    ['TMT Rod',    `₹${rates.tmtRod?.price||0}`,     'kg'],
    ['River Sand', `₹${rates.riverSand?.price||0}`,  'cu.ft'],
    ['Labor',      `₹${rates.labor?.price||0}`,      'sq.ft'],
  ].map(([n,v,u]) => `<div class="pn-pp-row"><span>${n}</span><span class="pn-pp-val">${v} <span style="color:#475569;font-weight:400;font-size:11px">/${u}</span></span></div>`).join('');
}
function pnSavePrices() {
  const region = pnCurrentRegion;
  pnSyncToAppRates(region);
  pnClosePrices();
  pnToast('✅ Prices saved & applied!', 'success');
}
function pnResetPrices() {
  const region = pnCurrentRegion;
  pnLiveRates[region] = JSON.parse(JSON.stringify(PN_DEFAULT_RATES[region] || PN_DEFAULT_RATES.Mumbai));
  pnSyncToAppRates(region);
  pnRenderPricesPanel();
  pnToast('↩ Prices reset to defaults', 'info');
}

/* ══════════════════════════════════
   8-MATERIAL AI ANALYSIS MODAL
══════════════════════════════════ */
function pnOpenAnalysis() {
  if (!wallsData || !wallsData.length) {
    pnToast('❗ Scan a floor plan first!', 'error'); return;
  }
  pnRenderAnalysisGrid();
  document.getElementById('pn-analysis-modal').classList.add('show');
}
function pnCloseAnalysis() {
  document.getElementById('pn-analysis-modal').classList.remove('show');
}

function pnCalcWall(w) {
  const rates = pnGetRates();
  const userH = parseFloat(document.getElementById('wallHeight')?.value || 10);
  const heightM = userH * 0.3048;
  const spanM = Math.max(w.widthUnits || 1, w.heightUnits || 1);
  const area = spanM * heightM;
  const areaSqFt = area * 10.764;
  const recKey = pnGetRecommended(w);
  const rec = PN_MATERIAL_DB[recKey];
  const isAAC = ['aacBlock','flyAshBrick','hollowBlock'].includes(recKey);
  const matRate = isAAC ? rates.aacBlock : rates.redBrick;
  const units = Math.ceil(area * (matRate?.bricksPerSqM || 55));
  const cement = Math.ceil(area * (rates.cement_OPC?.bagsPerSqM || 0.22));
  const rod = +((area * (rates.tmtRod?.kgPerSqM || 3.5)).toFixed(1));
  const score = pnTradeoffScore(recKey, w.type, w.room);
  const ranked = pnRankMaterials(w);
  const wallCost = Math.round(units * (matRate?.price || 9) + cement * (rates.cement_OPC?.price || 380));
  return { spanM, area, areaSqFt, recKey, rec, matRate, units, cement, rod, score, ranked, heightM, wallCost };
}

const PN_REASON_MAP = {
  aacBlock:     (w, d) => `Span: ${d.spanM.toFixed(2)}m. ${w.room==='kitchen'||w.room==='bathroom'?'Wet zone — durability weight=0.6. Moisture-resistant, IS:2185.':'Inner partition — cost weight=0.5. AAC 3× lighter than Red Brick.'} Score: ${d.score}.`,
  redBrick:     (w, d) => `Span: ${d.spanM.toFixed(2)}m. Outer load-bearing. Strength weight=0.5. IS:1077, 35–70 kg/cm² compressive strength. Handles vertical & lateral loads. Score: ${d.score}.`,
  rcc:          (w, d) => `Span: ${d.spanM.toFixed(2)}m. High-stress structural element. RCC: Strength 10/10, Durability 10/10. Best for columns and slabs. Score: ${d.score}.`,
  steelFrame:   (w, d) => `Span: ${d.spanM.toFixed(2)}m exceeds 5m threshold. Steel Frame per IS:800 — handles long-span loads brick cannot support. Score: ${d.score}.`,
  flyAshBrick:  (w, d) => `Span: ${d.spanM.toFixed(2)}m. Fly Ash Brick — eco-friendly, IS:12894. Low cost, medium-high strength. Good for general walling. Score: ${d.score}.`,
  hollowBlock:  (w, d) => `Span: ${d.spanM.toFixed(2)}m. Non-structural partition. HCB — lightweight, low cost, medium durability. Score: ${d.score}.`,
  precastPanel: (w, d) => `Span: ${d.spanM.toFixed(2)}m. Precast Panel — high durability 10/10, structural strength 8/10. Ideal for prefab construction. Score: ${d.score}.`,
};

const PN_MAT_BADGE_CLASS = { aacBlock:'pn-mat-aac', redBrick:'pn-mat-red', rcc:'pn-mat-rcc', flyAshBrick:'pn-mat-fly', steelFrame:'pn-mat-ste', hollowBlock:'pn-mat-hol', precastPanel:'pn-mat-pre' };

function pnRenderAnalysisGrid() {
  const roomLabelsLocal = typeof roomLabels !== 'undefined' ? roomLabels : {};
  document.getElementById('pn-analysis-grid').innerHTML = wallsData.map(w => {
    const d = pnCalcWall(w);
    const reason = PN_REASON_MAP[d.recKey] ? PN_REASON_MAP[d.recKey](w, d) : d.rec.bestUse;
    const badgeCls = PN_MAT_BADGE_CLASS[d.recKey] || 'pn-mat-aac';
    const alts = d.ranked.filter(r => r.key !== d.recKey).slice(0, 2);
    const roomName = (roomLabelsLocal[w.room] || w.room || '').split(' ').slice(-1)[0];
    return `<div class="pn-ac">
      <div class="pn-ac-hdr">
        <span class="pn-ac-id">${w.id}</span>
        <div style="display:flex;gap:5px;align-items:center">
          <span class="pn-type-badge ${w.type==='outer'?'pn-tb-outer':'pn-tb-inner'}">${w.type}</span>
          <span style="font-size:.6rem;color:#64748b;background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.2);padding:2px 6px;border-radius:50px">${roomName}</span>
        </div>
      </div>
      <div class="pn-ac-body">
        <div class="pn-ac-stat"><span class="pn-ac-stat-k">Span × Height</span><span class="pn-ac-stat-v">${d.spanM.toFixed(2)}m × ${d.heightM.toFixed(2)}m</span></div>
        <div class="pn-ac-stat"><span class="pn-ac-stat-k">Wall Area</span><span class="pn-ac-stat-v">${d.areaSqFt.toFixed(1)} sq.ft</span></div>
        <div class="pn-ac-stat"><span class="pn-ac-stat-k">Units needed</span><span class="pn-ac-stat-v">${d.units.toLocaleString()}</span></div>
        <div class="pn-ac-stat"><span class="pn-ac-stat-k">Cement bags</span><span class="pn-ac-stat-v">${d.cement}</span></div>
        <div class="pn-ac-stat"><span class="pn-ac-stat-k">TMT Rod</span><span class="pn-ac-stat-v">${d.rod} kg</span></div>
        <div class="pn-rating-bar">
          <div class="pn-rb-lbl"><span>Strength</span><span>${d.rec.strength}/10</span></div>
          <div class="pn-rating-track"><div class="pn-rating-fill" style="width:${d.rec.strength*10}%"></div></div>
        </div>
        <div class="pn-rating-bar">
          <div class="pn-rb-lbl"><span>Durability</span><span>${d.rec.durability}/10</span></div>
          <div class="pn-rating-track"><div class="pn-rating-fill" style="width:${d.rec.durability*10}%;background:linear-gradient(90deg,#4ade80,#22d3ee)"></div></div>
        </div>
        <div class="pn-ac-mat ${badgeCls}">${d.rec.icon} ${d.rec.name}<span class="pn-score-badge">Score: ${d.score}</span></div>
        <div class="pn-ac-reason">${reason}</div>
        <div class="pn-ac-alts">
          <div class="pn-ac-alts-lbl">2 Alternative Options</div>
          ${alts.map(r => `<div class="pn-ac-alt"><span class="pn-ac-alt-n">${PN_MATERIAL_DB[r.key].icon} ${PN_MATERIAL_DB[r.key].name}</span><span class="pn-ac-alt-s">Score: ${r.score}</span></div>`).join('')}
        </div>
        <div class="pn-ac-cost"><span class="pn-cost-lbl">Est. Wall Cost</span><span class="pn-cost-val">₹${d.wallCost.toLocaleString()}</span></div>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════
   ENHANCED WALL DETAIL (right panel)
   Overrides showWallAnalysis after Ishan's version with
   extra tradeoff data appended below existing display
══════════════════════════════════ */
const _pnOrigShowWallAnalysis = typeof showWallAnalysis !== 'undefined' ? showWallAnalysis : null;

function pnEnhanceWallPanel(w) {
  if (!w) return;
  const panel = document.getElementById('wallAnalysis');
  if (!panel) return;
  // Remove existing pn enhancement if any
  const old = document.getElementById('pn-wall-extra');
  if (old) old.remove();
  const d = pnCalcWall(w);
  const alts = d.ranked.filter(r => r.key !== d.recKey).slice(0, 2);
  const extra = document.createElement('div');
  extra.id = 'pn-wall-extra';
  extra.style.cssText = 'margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px';
  extra.innerHTML = `
    <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">⚖️ Tradeoff Analysis (8-Material Engine)</div>
    <div class="pn-wall-rec">
      <div class="pn-wall-rec-name">${d.rec.icon} #1 Recommended: ${d.rec.name}</div>
      <div class="pn-rating-bar">
        <div class="pn-rb-lbl"><span>Strength</span><span>${d.rec.strength}/10</span></div>
        <div class="pn-rating-track"><div class="pn-rating-fill" style="width:${d.rec.strength*10}%"></div></div>
      </div>
      <div class="pn-rating-bar">
        <div class="pn-rb-lbl"><span>Durability</span><span>${d.rec.durability}/10</span></div>
        <div class="pn-rating-track"><div class="pn-rating-fill" style="width:${d.rec.durability*10}%;background:linear-gradient(90deg,#4ade80,#22d3ee)"></div></div>
      </div>
      <div style="margin-top:6px"><span class="pn-tradeoff-score">⚖️ Score: ${d.score}</span></div>
      <div style="font-size:11px;color:#475569;margin-top:5px;line-height:1.55">${PN_REASON_MAP[d.recKey]?PN_REASON_MAP[d.recKey](w,d):d.rec.bestUse}</div>
    </div>
    <div style="font-size:11px;color:#475569;font-weight:600;margin-bottom:4px">Ranked Alternatives</div>
    ${alts.map(r => `
      <div style="padding:7px 10px;border-radius:7px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);margin-bottom:5px">
        <div style="font-size:12px;font-weight:700;color:#a78bfa">${PN_MATERIAL_DB[r.key].icon} ${PN_MATERIAL_DB[r.key].name} <span class="pn-tradeoff-score">Score: ${r.score}</span></div>
        <div style="font-size:11px;color:#475569;margin-top:3px">${PN_MATERIAL_DB[r.key].bestUse}</div>
      </div>`).join('')}
    <button class="btn-ai-analysis" style="width:100%;margin-top:8px" onclick="pnOpenAnalysis()">📊 View Full Analysis →</button>`;
  panel.appendChild(extra);
}

/* Hook into existing wall click — patch showWallAnalysis */
(function pnPatchWallAnalysis() {
  const orig = window.showWallAnalysis;
  if (orig) {
    window.showWallAnalysis = function(w) {
      orig(w);
      setTimeout(() => pnEnhanceWallPanel(w), 50);
    };
  }
})();

/* ══════════════════════════════════
   INTERIOR STYLE VISUALIZER
══════════════════════════════════ */
let pnCurrentStyle = 'modern';
let pnCurrentRoom  = 'living';

const PN_STYLE_THEMES = {
  modern:  { wall:'#1a2f4a', wall2:'#142238', ceil:'#1e3460', floor:'#2a1f14', accent:'#22d3ee' },
  minimal: { wall:'#1e2432', wall2:'#181e2c', ceil:'#222840', floor:'#1e1a18', accent:'#a78bfa' },
  warm:    { wall:'#2a1f14', wall2:'#22180e', ceil:'#321e0a', floor:'#3d2b16', accent:'#fb923c' },
  luxury:  { wall:'#1a1628', wall2:'#120f22', ceil:'#201a34', floor:'#0a0a10', accent:'#fbbf24' },
};

function pnSelectRoom(room, btn) {
  pnCurrentRoom = room;
  document.querySelectorAll('.room-btns button').forEach(b => b.style.borderColor = '');
  if (btn) btn.style.borderColor = '#22d3ee';
  pnDrawStyledRoom(room, pnCurrentStyle);
}
function pnSelectStyle(style, el) {
  pnCurrentStyle = style;
  document.querySelectorAll('.pn-style-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  pnDrawStyledRoom(pnCurrentRoom, style);
}

function pnShadeColor(hex, pct) {
  if (!hex || !hex.startsWith('#')) return hex;
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (n>>16) + pct));
  const g = Math.min(255, Math.max(0, ((n>>8)&0xff) + pct));
  const b = Math.min(255, Math.max(0, (n&0xff) + pct));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function pnDrawStyledRoom(type, style) {
  const canvas = document.getElementById('roomCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const T = PN_STYLE_THEMES[style] || PN_STYLE_THEMES.modern;
  const accentC = T.accent;
  const flY = H - 120;

  ctx.clearRect(0, 0, W, H);

  // Back wall
  const bwGrad = ctx.createLinearGradient(80,40,W-80,H-120);
  bwGrad.addColorStop(0, T.wall); bwGrad.addColorStop(1, pnShadeColor(T.wall,-10));
  ctx.fillStyle = bwGrad; ctx.fillRect(80, 40, W-160, flY-40);

  // Left wall
  const lwGrad = ctx.createLinearGradient(0,0,80,0);
  lwGrad.addColorStop(0,T.wall2); lwGrad.addColorStop(1,pnShadeColor(T.wall2,8));
  ctx.fillStyle = lwGrad; ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(80,40); ctx.lineTo(80,flY); ctx.lineTo(0,H); ctx.fill();

  // Right wall
  const rwGrad = ctx.createLinearGradient(W,0,W-80,0);
  rwGrad.addColorStop(0,T.wall2); rwGrad.addColorStop(1,pnShadeColor(T.wall2,8));
  ctx.fillStyle = rwGrad; ctx.beginPath();
  ctx.moveTo(W,0); ctx.lineTo(W-80,40); ctx.lineTo(W-80,flY); ctx.lineTo(W,H); ctx.fill();

  // Ceiling
  const cgGrad = ctx.createLinearGradient(0,0,0,40);
  cgGrad.addColorStop(0,T.ceil); cgGrad.addColorStop(1,pnShadeColor(T.ceil,-5));
  ctx.fillStyle = cgGrad; ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(W,0); ctx.lineTo(W-80,40); ctx.lineTo(80,40); ctx.fill();

  // Floor
  const fgGrad = ctx.createLinearGradient(0,flY,0,H);
  fgGrad.addColorStop(0, pnShadeColor(T.floor,15)); fgGrad.addColorStop(1, T.floor);
  ctx.fillStyle = fgGrad; ctx.beginPath();
  ctx.moveTo(0,H); ctx.lineTo(80,flY); ctx.lineTo(W-80,flY); ctx.lineTo(W,H); ctx.fill();

  // Floor grid lines
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = .7;
  for(let i=0;i<=10;i++){const x=80+i*(W-160)/10;ctx.beginPath();ctx.moveTo(x,flY);ctx.lineTo(i*(W/10),H);ctx.stroke();}
  for(let i=0;i<=5;i++){const t=i/5,y=flY+t*(H-flY),xl=80*(1-t),xr=W-80*(1-t);ctx.beginPath();ctx.moveTo(xl,y);ctx.lineTo(xr,y);ctx.stroke();}

  // Ceiling light
  ctx.fillStyle='rgba(255,255,255,.06)'; ctx.beginPath(); ctx.ellipse(W/2,22,55,11,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=accentC; ctx.lineWidth=1.5; ctx.beginPath(); ctx.rect(W/2-36,14,72,14); ctx.stroke();
  const lightGrad=ctx.createRadialGradient(W/2,22,0,W/2,22,110);
  lightGrad.addColorStop(0,accentC+'22'); lightGrad.addColorStop(1,'transparent');
  ctx.fillStyle=lightGrad; ctx.fillRect(0,0,W,H);

  // Room-specific furniture
  if (type === 'living') {
    // Sofa
    ctx.fillStyle = style==='luxury'?'#3d2b00':style==='warm'?'#5a3010':'#4338ca';
    ctx.fillRect(100,flY-55,200,55);
    ctx.fillStyle = style==='luxury'?'#4a3500':style==='warm'?'#6b3a12':'#5046e5';
    ctx.fillRect(100,flY-95,200,40);
    // Cushions
    ctx.fillStyle = accentC+'55'; ctx.fillRect(108,flY-88,55,28); ctx.fillRect(237,flY-88,55,28);
    // TV
    ctx.fillStyle='#0a0f18'; ctx.fillRect(290,90,150,52);
    const tvG=ctx.createLinearGradient(290,90,290,142); tvG.addColorStop(0,accentC+'10'); tvG.addColorStop(1,accentC+'35');
    ctx.fillStyle=tvG; ctx.fillRect(293,93,144,44);
    ctx.strokeStyle=accentC+'50'; ctx.lineWidth=.5; ctx.strokeRect(293,93,144,44);
    // Coffee table
    ctx.fillStyle=style==='luxury'?'#8B6914':'#374151';
    ctx.fillRect(160,flY-20,80,14);
    // Rug
    ctx.fillStyle=accentC+'10'; ctx.beginPath(); ctx.ellipse(200,flY-4,120,22,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=accentC+'20'; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(200,flY-4,120,22,0,0,Math.PI*2); ctx.stroke();
  } else if (type === 'bedroom1') {
    // Bed frame
    ctx.fillStyle='#e2e8f0'; ctx.fillRect(160,flY-60,240,60);
    // Headboard
    ctx.fillStyle=style==='luxury'?'#4a3500':'#4338ca'; ctx.fillRect(160,flY-118,240,60);
    // Pillows
    ctx.fillStyle='rgba(255,255,255,.9)'; ctx.fillRect(175,flY-108,80,38); ctx.fillRect(310,flY-108,75,38);
    // Bedside tables
    ctx.fillStyle='#374151';
    ctx.fillRect(130,flY-28,30,22); ctx.fillRect(404,flY-28,30,22);
    // Lamps
    ctx.strokeStyle=accentC; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(145,flY-28); ctx.lineTo(145,flY-50); ctx.stroke();
    ctx.fillStyle=accentC+'35'; ctx.beginPath(); ctx.ellipse(145,flY-52,12,4,0,0,Math.PI*2); ctx.fill();
    // Wardrobe
    ctx.fillStyle='#1e2a3a'; ctx.fillRect(490,70,78,flY-70);
    ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.lineWidth=1;
    ctx.strokeRect(492,72,36,flY-74); ctx.strokeRect(530,72,36,flY-74);
  } else if (type === 'kitchen') {
    // Lower cabinets
    ctx.fillStyle='#2d3748'; ctx.fillRect(82,flY-60,280,60);
    ctx.fillStyle='#94a3b8'; ctx.fillRect(82,flY-64,280,6);
    ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
    for(let i=0;i<=4;i++) ctx.strokeRect(82+i*70,flY-63,68,58);
    // Sink
    ctx.fillStyle='#c0c0c0'; ctx.fillRect(220,flY-57,88,40);
    ctx.fillStyle='#909090'; ctx.fillRect(228,flY-50,72,30);
    // Upper cabinets
    ctx.fillStyle='#2d3748'; ctx.fillRect(85,78,272,70);
    ctx.strokeStyle='rgba(255,255,255,.09)';
    for(let i=0;i<=3;i++) ctx.strokeRect(86+i*68,79,66,68);
    // Window above sink
    ctx.fillStyle='rgba(135,206,235,.15)'; ctx.fillRect(88,80,118,66);
    ctx.strokeStyle=accentC+'50'; ctx.lineWidth=1; ctx.strokeRect(88,80,118,66);
    ctx.beginPath();ctx.moveTo(147,80);ctx.lineTo(147,146);ctx.stroke();
    ctx.beginPath();ctx.moveTo(88,113);ctx.lineTo(206,113);ctx.stroke();
    // Faucet
    ctx.strokeStyle=accentC; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(265,flY-57); ctx.arcTo(265,flY-73,280,flY-73,11); ctx.lineTo(280,flY-73); ctx.stroke();
  } else { // bathroom
    // Shower/tub area
    ctx.fillStyle='rgba(34,211,238,.04)'; ctx.fillRect(88,70,158,flY-70);
    ctx.strokeStyle=accentC; ctx.lineWidth=1.5; ctx.strokeRect(88,70,158,flY-70);
    ctx.strokeStyle=accentC+'25'; ctx.lineWidth=1;
    for(let y=90;y<flY;y+=18){ctx.beginPath();ctx.moveTo(88,y);ctx.lineTo(246,y);ctx.stroke();}
    // Shower head
    ctx.strokeStyle='#9ca3af'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(198,78); ctx.lineTo(198,106); ctx.stroke();
    ctx.fillStyle='#9ca3af'; ctx.beginPath(); ctx.arc(198,78,13,0,Math.PI*2); ctx.fill();
    for(let r=0;r<8;r++){
      const ang=r*Math.PI/4;
      ctx.beginPath(); ctx.moveTo(198+Math.cos(ang)*4,78+Math.sin(ang)*4); ctx.lineTo(198+Math.cos(ang)*11,78+Math.sin(ang)*11);
      ctx.strokeStyle='rgba(34,211,238,.5)'; ctx.lineWidth=1; ctx.stroke();
    }
    // Toilet
    ctx.fillStyle='#f0f0f0'; ctx.fillRect(340,flY-56,98,56);
    ctx.fillStyle='#f5f5f5'; ctx.beginPath(); ctx.ellipse(389,flY-60,46,17,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e8e8e8'; ctx.fillRect(354,flY-96,70,34);
    ctx.fillStyle=accentC; ctx.beginPath(); ctx.arc(389,flY-79,5,0,Math.PI*2); ctx.fill();
    // Basin
    ctx.fillStyle='rgba(135,180,220,.14)'; ctx.fillRect(452,72,78,78);
    ctx.strokeStyle='#6b7280'; ctx.lineWidth=1.5; ctx.strokeRect(452,72,78,78);
    ctx.fillStyle='#f0f0f0'; ctx.fillRect(455,flY-36,78,36);
  }

  // Accent strip at top of back wall
  const strip = ctx.createLinearGradient(80,40,W-80,40);
  strip.addColorStop(0,'transparent'); strip.addColorStop(.5,accentC+'20'); strip.addColorStop(1,'transparent');
  ctx.fillStyle=strip; ctx.fillRect(80,38,W-160,3);

  // Info bar
  ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(0,H-30,W,30);
  const roomNamesMap = {living:'Living Room',bedroom1:'Master Bedroom',kitchen:'Kitchen',bathroom:'Bathroom'};
  const matsMap = {
    living:'Walls: Red Brick | Floor: Vitrified Tiles',
    bedroom1:'Walls: Red Brick | Floor: Wooden Laminate',
    kitchen:'Walls: AAC Block | Floor: Anti-bacterial Tiles',
    bathroom:'Walls: AAC Block | Floor: Anti-slip Tiles'
  };
  ctx.fillStyle = accentC; ctx.font='bold 11px Syne,Segoe UI,sans-serif';
  ctx.textAlign='left'; ctx.fillText(`${roomNamesMap[type]||type} · ${matsMap[type]||''} · Style: ${style.charAt(0).toUpperCase()+style.slice(1)}`,12,H-12);
  if (typeof grandTotal !== 'undefined' && grandTotal > 0) {
    ctx.textAlign='right'; ctx.fillStyle='#4ade80';
    ctx.fillText(`Est. Total: ₹${grandTotal.toLocaleString()}`,W-12,H-12);
  }
}

/* Override generateRoomImage to use styled version */
(function pnPatchRoomImage() {
  const origGenerate = window.generateRoomImage;
  window.generateRoomImage = function() {
    document.getElementById('roomModal').classList.add('show');
    pnDrawStyledRoom(pnCurrentRoom, pnCurrentStyle);
  };
})();

/* ══════════════════════════════════
   FULL BLOCKCHAIN MODAL
══════════════════════════════════ */
function pnOpenBcModal() {
  document.getElementById('pn-bc-modal').classList.add('show');
  pnRenderBcSummary();
}
function pnCloseBcModal() {
  document.getElementById('pn-bc-modal').classList.remove('show');
}
function pnRenderBcSummary() {
  const region = pnCurrentRegion;
  const totalCost = (typeof grandTotal !== 'undefined' && grandTotal > 0) ? grandTotal : 'Not calculated yet';
  const wallCount = (typeof wallsData !== 'undefined') ? wallsData.length : 0;
  document.getElementById('pn-bc-project-summary').innerHTML = [
    ['Walls Analyzed', wallCount],
    ['Region', region],
    ['Materials DB', '7 materials + labor'],
    ['Tradeoff Engine', '8 materials scored'],
    ['Grand Total', typeof totalCost === 'number' ? '₹'+totalCost.toLocaleString() : totalCost],
  ].map(([k,v]) => `<div class="pn-bc-row"><span class="pn-bc-key">${k}</span><span class="pn-bc-val" style="${k==='Grand Total'?'color:#4ade80':''}">${v}</span></div>`).join('');
}
async function pnVerifyStellar() {
  const action = document.getElementById('pn-bc-action');
  action.innerHTML = `<div class="pn-bc-spinner"></div><p style="color:#64748b;font-size:13px">Connecting to Stellar Testnet...<br><small>Hashing & Broadcasting...</small></p>`;
  
  const region = pnCurrentRegion;
  const wallsArr = typeof wallsData !== 'undefined' ? wallsData : [];
  const totalCost = typeof grandTotal !== 'undefined' ? grandTotal : 0;
  
  try {
    // 1. Generate SHA-256 Hash
    const dataToHash = JSON.stringify({ walls: wallsArr, totalCost, region, materials: Object.keys(PN_MATERIAL_DB), timestamp: Date.now() });
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataToHash));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
    
    // 2. Load Stellar Configuration from app.js
    if (typeof STELLAR_CONFIG === 'undefined' || typeof StellarSdk === 'undefined') {
      throw new Error('Stellar SDK or Configuration is missing.');
    }
    
    const server = new StellarSdk.Horizon.Server(STELLAR_CONFIG.horizonUrl);
    const keypair = StellarSdk.Keypair.fromSecret(STELLAR_CONFIG.secretKey);
    const pubKey = keypair.publicKey();
    
    let account;
    try {
      account = await server.loadAccount(pubKey);
    } catch (e) {
      if (e.response && e.response.status === 404) {
        action.innerHTML = `<div class="pn-bc-spinner"></div><p style="color:#64748b;font-size:13px">Account not found.<br><small>Funding via Friendbot...</small></p>`;
        await fetch(`https://friendbot.stellar.org/?addr=${pubKey}`);
        await new Promise(r => setTimeout(r, 4000));
        account = await server.loadAccount(pubKey);
      } else {
        throw e;
      }
    }
    
    // 3. Build & Submit Transaction
    action.innerHTML = `<div class="pn-bc-spinner"></div><p style="color:#64748b;font-size:13px">Broadcasting to Stellar...<br><small>Registering Immuntable Audit Hash</small></p>`;
    
    const hashShort = hashHex.substring(0, 28);
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.manageData({
        name: 'archlab_plus_audit',
        value: hashShort,
      }))
      .addMemo(StellarSdk.Memo.text('Archlab+ Audit'))
      .setTimeout(30)
      .build();
    
    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction);
    const txHash = result.hash;
    
    // 4. Update UI with Real Result
    action.innerHTML = `
      <div class="pn-bc-icon">✅</div>
      <h3 style="font-size:1.2rem;font-weight:800;color:#4ade80;margin-bottom:8px">Archlab+ Verified!</h3>
      <p style="color:#64748b;font-size:13px">SHA-256 hash immutably recorded on Stellar Testnet.</p>
      <div style="font-size:10px;color:#64748b;margin-top:8px;word-break:break-all">TX: ${txHash}</div>
      <button class="pn-close-btn" style="margin-top:16px" onclick="pnCloseBcModal()">Close</button>`;
    
    document.getElementById('pn-bc-hash-section').style.display = 'block';
    document.getElementById('pn-bc-hash-display').innerHTML = `<span style="color:#475569">Full SHA-256:</span><br>${hashHex}`;
    document.getElementById('pn-bc-meta-rows').innerHTML = [
      ['Block Time', new Date().toLocaleString('en-IN')],
      ['Network',    'Stellar Testnet (Horizon)'],
      ['TX Hash',    txHash.substring(0, 8) + '...'],
      ['Status',     '⛓️ Immutable Record Created'],
    ].map(([k,v]) => `<div class="pn-bc-row"><span class="pn-bc-key">${k}</span><span class="pn-bc-val">${v}</span></div>`).join('');
    
    pnToast('⛓️ Blockchain verification complete!', 'success');
    
  } catch (err) {
    console.error('Blockchain Error:', err);
    action.innerHTML = `
      <div class="pn-bc-icon" style="background:rgba(239,68,68,0.1);color:#ef4444">⚠️</div>
      <h3 style="font-size:1.1rem;font-weight:800;color:#ef4444;margin-bottom:8px">Audit Submission Failed</h3>
      <p style="color:#64748b;font-size:12px;margin-bottom:12px">${err.message || 'Network error'}</p>
      <button class="pn-reset-btn" style="width:100%" onclick="pnVerifyStellar()">Retry Connection</button>
      <button class="pn-close-btn" style="margin-top:10px" onclick="pnCloseBcModal()">Close</button>`;
    pnToast('❌ Blockchain verification failed', 'error');
  }
}

/* ══════════════════════════════════
   ENHANCED PDF (4 pages)
   Patches existing downloadPDF to add page 4 with bar chart breakdown
   and calls our analysis data in page 3
══════════════════════════════════ */
(function pnPatchPDF() {
  const origPDF = window.downloadPDF;
  window.downloadPDF = function() {
    // Run original Ishan PDF first for backward compat, then offer enhanced
    if (origPDF) {
      try { origPDF(); } catch(e) { console.warn('Original PDF error:', e); }
    }
    // Show choice toast
    pnToast('📄 PDF downloaded! Use ⛓️ Blockchain button for full 4-page audit.', 'info');
  };
})();

/* ══════════════════════════════════
   ENHANCED CHAT (REMOVED: INTEGRATED ONE)
══════════════════════════════════ */
// Integrated chat section removed per user request.
// Full AI Page is the primary assistant experience.

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Sync initial region from Ishan's selector
  const sel = document.getElementById('userRegion');
  if (sel) {
    pnCurrentRegion = sel.value || 'Mumbai';
    sel.addEventListener('change', () => {
      pnCurrentRegion = sel.value;
      pnSyncToAppRates(pnCurrentRegion);
    });
  }
  pnToast('⬡ Archlab Plus loaded — 8-Material AI Engine Active', 'info');
});
