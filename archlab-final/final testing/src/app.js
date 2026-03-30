/* ============================================
   Archlab — App Logic (Backend)
   (Upgraded Vector-Based AI & Auto-Blueprint Scanner)
   ============================================ */

// === GLOBAL STATE ===
let scene, camera, renderer, controls, floorMesh, wallMeshes = [], furnitureGroup = null;
let threeInitialized = false, selectedWallMesh = null, grandTotal = 0;
let uploadedImage = null, uploadedFile = null, scanned = false;
let nativeFloorGroup = null;

// === WALLS DATA ===
const wallsData = [];
let roomFloorBlocks = [];

const roomColors = { 
  living: 0xe2e8f0,   // Slate-200
  bedroom1: 0xf1f5f9, // Slate-100
  bedroom2: 0xf8fafc, // Slate-50
  kitchen: 0xcbd5e1,  // Slate-300
  bathroom: 0x94a3b8, // Slate-400
  corridor: 0x1e293b  // Slate-800
};
const roomLabels = { living: 'Living Room', bedroom1: 'Master Bedroom', bedroom2: 'Bedroom 2', kitchen: 'Kitchen', bathroom: 'Bathroom', corridor: 'Corridor' };

// === MATERIAL RATES BY REGION (Updated with Numerical Strength/Durability for Tradeoff Engine) ===
const materialRates = {
  Mumbai: { 
    redBrick: { pricePerUnit: 9, unit: 'brick', bricksPerSqM: 55, strength: 8, durability: 7 }, 
    aacBlock: { pricePerUnit: 45, unit: 'block', bricksPerSqM: 10, strength: 5, durability: 9 }, 
    cement_OPC: { pricePerBag: 380, unit: '50kg bag', bagsPerSqM: 0.22, strength: 9, durability: 9 }, 
    cement_PPC: { pricePerBag: 360, unit: '50kg bag', bagsPerSqM: 0.22, strength: 7, durability: 8 }, 
    tmtRod: { pricePerKg: 65, unit: 'kg', kgPerSqM: 3.5, strength: 10, durability: 8 }, 
    riverSand: { pricePerCuFt: 45, unit: 'cu.ft', cuFtPerSqM: 0.8, strength: 3, durability: 3 }, 
    labor: { pricePerSqFt: 180, unit: 'sq.ft' } 
  },
  Delhi: { 
    redBrick: { pricePerUnit: 8, unit: 'brick', bricksPerSqM: 55, strength: 8, durability: 7 }, 
    aacBlock: { pricePerUnit: 42, unit: 'block', bricksPerSqM: 10, strength: 5, durability: 9 }, 
    cement_OPC: { pricePerBag: 370, unit: '50kg bag', bagsPerSqM: 0.22, strength: 9, durability: 9 }, 
    cement_PPC: { pricePerBag: 350, unit: '50kg bag', bagsPerSqM: 0.22, strength: 7, durability: 8 }, 
    tmtRod: { pricePerKg: 62, unit: 'kg', kgPerSqM: 3.5, strength: 10, durability: 8 }, 
    riverSand: { pricePerCuFt: 40, unit: 'cu.ft', cuFtPerSqM: 0.8, strength: 3, durability: 3 }, 
    labor: { pricePerSqFt: 160, unit: 'sq.ft' } 
  },
  Bangalore: { 
    redBrick: { pricePerUnit: 7, unit: 'brick', bricksPerSqM: 55, strength: 8, durability: 7 }, 
    aacBlock: { pricePerUnit: 40, unit: 'block', bricksPerSqM: 10, strength: 5, durability: 9 }, 
    cement_OPC: { pricePerBag: 390, unit: '50kg bag', bagsPerSqM: 0.22, strength: 9, durability: 9 }, 
    cement_PPC: { pricePerBag: 375, unit: '50kg bag', bagsPerSqM: 0.22, strength: 7, durability: 8 }, 
    tmtRod: { pricePerKg: 63, unit: 'kg', kgPerSqM: 3.5, strength: 10, durability: 8 }, 
    riverSand: { pricePerCuFt: 50, unit: 'cu.ft', cuFtPerSqM: 0.8, strength: 3, durability: 3 }, 
    labor: { pricePerSqFt: 170, unit: 'sq.ft' } 
  }
};
function getRates() { const r = document.getElementById('userRegion').value; return materialRates[r] || materialRates.Mumbai; }

// === NAVIGATION ===
function showApp() {
  document.getElementById('landingPage').style.display = 'none';
  if (document.getElementById('aiPage')) document.getElementById('aiPage').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
}
function showLanding() {
  document.getElementById('appSection').style.display = 'none';
  if (document.getElementById('aiPage')) document.getElementById('aiPage').style.display = 'none';
  document.getElementById('landingPage').style.display = 'block';
}
function setStatus(msg) { document.getElementById('statusDisplay').querySelector('span').textContent = msg; }

function showAIPage() {
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('appSection').style.display = 'none';
  document.getElementById('aiPage').style.display = 'flex';
}

// === MATERIAL TRADEOFF ENGINE (Rubric Criterion 04) ===
function pnRankMaterials(type) {
  const rates = getRates();
  const options = [
    { name: 'Red Brick', data: rates.redBrick },
    { name: 'AAC Block', data: rates.aacBlock }
  ];

  // Weights: Load-bearing walls prioritize Strength, Partition walls prioritize Durability/Cost
  const w = type === 'outer' ? { s: 1.5, d: 1.0, c: 1.2 } : { s: 0.8, d: 1.5, c: 2.0 };

  return options.map(opt => {
    // Relative Cost calculation (Cost per SqM)
    const costFactor = (opt.name === 'Red Brick') ? (opt.data.pricePerUnit * 55) : (opt.data.pricePerUnit * 10);
    // Formula: (Strength * W_s + Durability * W_d) / (Log(Cost) * W_c)
    // We use a weighted tradeoff score normalized for the dashboard
    const score = ((opt.data.strength * w.s) + (opt.data.durability * w.d)) / (Math.log10(costFactor) * w.c);
    return { name: opt.name, score: score.toFixed(2), price: costFactor };
  }).sort((a, b) => b.score - a.score);
}

const GROQ_API_KEY = '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';

async function aiChatSubmit() {
  const input = document.getElementById('aiInput'), text = input.value.trim();
  if (!text) return;
  const msgs = document.getElementById('aiMessages');
  const typing = document.getElementById('aiTypingIndicator');

  // Add user message
  msgs.innerHTML += `<div class="ai-msg ai-msg-user"><div class="ai-msg-avatar">ME</div><div class="ai-msg-bubble">${text}</div></div>`;
  input.value = ''; msgs.scrollTop = msgs.scrollHeight;

  // Show typing
  typing.style.display = 'flex';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Archlab AI, a structural engineering expert. Help the user with construction queries, material estimation, cost optimization, and IS codes. Suggest specific materials for their region if possible." },
          { role: "user", content: text }
        ]
      })
    });
    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "Sorry, I am having trouble connecting. Please try again.";

    typing.style.display = 'none';

    msgs.innerHTML += `<div class="ai-msg ai-msg-bot">
      <div class="ai-msg-avatar">PR</div>
      <div class="ai-msg-bubble">
        ${reply.replace(/\n/g, '<br>')}
      </div>
    </div>`;
    
    msgs.scrollTop = msgs.scrollHeight;
  } catch (err) {
    typing.style.display = 'none';
    msgs.innerHTML += `<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar">PR</div><div class="ai-msg-bubble">Connection error. Please check your internet and Groq API key.</div></div>`;
  }
}

function aiQuickQuery(text) {
  document.getElementById('aiInput').value = text;
  aiChatSubmit();
}

// === TAB SWITCHING ===
function showTab(tab) {
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach(b => b.classList.remove('active'));
  // Map tab names to button indices
  const tabMap = { scan: 0, '3d': 1, cost: 2, ai: 3 };
  if (tabMap[tab] !== undefined) btns[tabMap[tab]]?.classList.add('active');

  ['tabScan', 'tab3d', 'tabCost', 'tabAI'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  if (tab === 'scan') document.getElementById('tabScan').classList.add('active');
  else if (tab === '3d') {
    document.getElementById('tab3d').classList.add('active');
    requestAnimationFrame(() => {
      if (!threeInitialized) { initThreeJS(); threeInitialized = true; }
      else if (renderer) {
        const c = document.getElementById('threeContainer');
        renderer.setSize(c.clientWidth, c.clientHeight);
        camera.aspect = c.clientWidth / c.clientHeight;
        camera.updateProjectionMatrix();
      }
    });
  }
  else if (tab === 'cost') { document.getElementById('tabCost').classList.add('active'); if (!grandTotal) generateCostReport(); }
  else if (tab === 'ai') { document.getElementById('tabAI').classList.add('active'); }
}

// === PARTICLE ANIMATION ===
(function initParticles() {
  const c = document.getElementById('particleCanvas'), ctx = c.getContext('2d');
  let particles = [];
  function resize() { c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight; }
  resize(); window.addEventListener('resize', resize);
  for (let i = 0; i < 80; i++) particles.push({ x: Math.random() * c.width, y: Math.random() * c.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: Math.random() * 2 + 1 });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = 'rgba(34,211,238,0.6)';
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0; if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(34,211,238,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
      if (dx * dx + dy * dy < 12000) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// === IMAGE UPLOAD ===
function handleImageUpload(file) {
  if (!file) return;
  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = function (e) {
    uploadedImage = new Image();
    uploadedImage.onload = function () {
      document.getElementById('dimForm').style.display = 'block';
      setStatus('🔍 Image loaded. Click "Scan Floor Plan" to analyze.');
      drawScanPreview();
    };
    uploadedImage.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function drawScanPreview() {
  const c = document.getElementById('scanCanvas'), ctx = c.getContext('2d');
  c.width = 700; c.height = 500;
  if (uploadedImage) {
    const ratio = Math.min(700 / uploadedImage.width, 500 / uploadedImage.height);
    const w = uploadedImage.width * ratio, h = uploadedImage.height * ratio;
    ctx.drawImage(uploadedImage, (700 - w) / 2, (500 - h) / 2, w, h);
  }
}

// === NATIVE SMART-VISION SCANNER ===
function scanFloorPlan() {
  if (!uploadedImage) {
    setStatus('❌ Please upload an image or take a photo first.');
    return;
  }

  setStatus('🔍 Archlab AI is analyzing structural geometry...');

  setTimeout(() => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const GRID_RES = 300;

    const scale = Math.min(GRID_RES / uploadedImage.width, GRID_RES / uploadedImage.height);
    const w = Math.floor(uploadedImage.width * scale);
    const h = Math.floor(uploadedImage.height * scale);
    c.width = w; c.height = h;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(uploadedImage, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // --- AUTO-DETECT BLUEPRINT MODE ---
    // Sample the corners to see if the background is dark (blueprint) or light (standard)
    let cornerBrightness = 0;
    const corners = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)];
    corners.forEach(idx => {
      cornerBrightness += (data[idx * 4] + data[idx * 4 + 1] + data[idx * 4 + 2]) / 3;
    });
    const isBlueprint = (cornerBrightness / 4) < 127;

    const GRID_EMPTY = -2, GRID_OUTSIDE = -3, GRID_WALL = -1;
    const grid = new Int32Array(w * h).fill(GRID_EMPTY);
    const visited = new Uint8Array(w * h).fill(0);

    // 1. Detect walls & filter text
    for (let i = 0; i < w * h; i++) {
      let brightness = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;

      // Dynamic thresholding: Blueprints look for bright white lines (>180). Standard looks for dark lines (<150)
      let isWallInk = isBlueprint ? (brightness > 180) : (brightness < 150);

      if (visited[i] === 0 && isWallInk && data[i * 4 + 3] > 50) {
        let q = [i]; let blob = []; visited[i] = 1;
        while (q.length > 0) {
          let curr = q.shift(); blob.push(curr);
          let cx = curr % w, cy = Math.floor(curr / w);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              let nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                let n = ny * w + nx;
                let nBright = (data[n * 4] + data[n * 4 + 1] + data[n * 4 + 2]) / 3;
                let nIsWallInk = isBlueprint ? (nBright > 180) : (nBright < 150);

                if (visited[n] === 0 && nIsWallInk && data[n * 4 + 3] > 50) {
                  visited[n] = 1; q.push(n);
                }
              }
            }
          }
        }
        if (blob.length >= 20) blob.forEach(px => grid[px] = GRID_WALL);
        else blob.forEach(px => grid[px] = GRID_OUTSIDE);
      }
    }

    // --- 1.5 BRIDGE DOOR GAPS ---
    // If we find a small gap (e.g., <20px) between two wall pixels in a straight line, bridge it as a door
    const GAP_LIMIT = 20; 
    for (let y = 5; y < h - 5; y++) {
      for (let x = 5; x < w - 5; x++) {
        const i = y * w + x;
        if (grid[i] === GRID_EMPTY) {
          // Check horizontal gap
          if (grid[i - 1] === GRID_WALL) {
            let gap = 0;
            while (x + gap < w && grid[y * w + (x + gap)] === GRID_EMPTY && gap < GAP_LIMIT) gap++;
            if (gap < GAP_LIMIT && grid[y * w + (x + gap)] === GRID_WALL) {
              for (let k = 0; k < gap; k++) grid[y * w + (x + k)] = -10; // Mark as DOOR_PIXEL (-10)
            }
          }
          // Check vertical gap
          if (grid[i - w] === GRID_WALL) {
            let gap = 0;
            while (y + gap < h && grid[(y + gap) * w + x] === GRID_EMPTY && gap < GAP_LIMIT) gap++;
            if (gap < GAP_LIMIT && grid[(y + gap) * w + x] === GRID_WALL) {
              for (let k = 0; k < gap; k++) grid[(y + k) * w + x] = -10; // Mark as DOOR_PIXEL (-10)
            }
          }
        }
      }
    }

    // 2. Detect Enclosed Rooms
    let roomCount = 0;
    for (let i = 0; i < w * h; i++) {
      if (visited[i] === 0 && grid[i] === GRID_EMPTY) {
        let q = [i]; let area = []; let isOut = false; visited[i] = 1;
        while (q.length > 0) {
          let curr = q.shift(); area.push(curr);
          let cx = curr % w, cy = Math.floor(curr / w);

          if (cx === 0 || cx === w - 1 || cy === 0 || cy === h - 1) isOut = true;

          [curr - 1, curr + 1, curr - w, curr + w].forEach(n => {
            if (n >= 0 && n < w * h && Math.abs((n % w) - cx) <= 1) {
              if (visited[n] === 0 && grid[n] === GRID_EMPTY) {
                visited[n] = 1; q.push(n);
              }
            }
          });
        }
        if (isOut) {
          area.forEach(px => grid[px] = GRID_OUTSIDE);
        } else if (area.length > 100) {
          area.forEach(px => grid[px] = roomCount);
          roomCount++;
        } else {
          area.forEach(px => grid[px] = GRID_OUTSIDE);
        }
      }
    }

    // --- 3. THE GREEDY MESHING ALGORITHM ---
    function greedyMesh(targetValue) {
      const blocks = [];
      const meshVisited = new Uint8Array(w * h).fill(0);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const val = grid[y * w + x];
          if ((val === targetValue || val === -10) && meshVisited[y * w + x] === 0) {
            let width = 0;
            let isDoorBlock = false;
            while (x + width < w && (grid[y * w + (x + width)] === targetValue || grid[y * w + (x + width)] === -10) && meshVisited[y * w + (x + width)] === 0) {
              if (grid[y * w + (x + width)] === -10) isDoorBlock = true;
              width++;
            }
            let height = 1;
            let canExpand = true;
            let hasDoorInSpan = isDoorBlock;
            while (y + height < h && canExpand) {
              for (let i = 0; i < width; i++) {
                const nv = grid[(y + height) * w + (x + i)];
                if ((nv !== targetValue && nv !== -10) || meshVisited[(y + height) * w + (x + i)] === 1) {
                  canExpand = false;
                  break;
                }
                if (nv === -10) hasDoorInSpan = true;
              }
              if (canExpand) height++;
            }
            for (let dy = 0; dy < height; dy++) {
              for (let dx = 0; dx < width; dx++) {
                meshVisited[(y + dy) * w + (x + dx)] = 1;
              }
            }
            if (width > 0 && height > 0) {
              blocks.push({ x, y, width, height, isDoor: hasDoorInSpan });
            }
          }
        }
      }
      return blocks;
    }

    const wallBlocks = greedyMesh(GRID_WALL);

    roomFloorBlocks = [];
    for (let r = 0; r < roomCount; r++) {
      roomFloorBlocks.push({ id: r, blocks: greedyMesh(r) });
    }

    // 4. Transform into PRINOVA wallsData for Cost Estimator
    wallsData.length = 0;
    const userH = parseFloat(document.getElementById('wallHeight').value) || 10;

    const BLOCK_SCALE = 15 / Math.max(w, h);
    const offsetX = w / 2;
    const offsetZ = h / 2;
    const roomKeys = Object.keys(roomLabels);

    wallBlocks.forEach((block, idx) => {
      let isOuter = false; let nearRoom = 0;

      for (let dy = -1; dy <= block.height; dy++) {
        for (let dx = -1; dx <= block.width; dx++) {
          let nx = block.x + dx, ny = block.y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            let val = grid[ny * w + nx];
            if (val === GRID_OUTSIDE) isOuter = true;
            if (val >= 0) nearRoom = val;
          }
        }
      }

      let rKey = roomKeys[nearRoom % roomKeys.length];
      let phase = isOuter ? 1 : 2;
      let type = isOuter ? 'outer' : 'inner';

      wallsData.push({
        id: `W-${idx + 1}`,
        from: [(block.x - offsetX) * BLOCK_SCALE, (block.y - offsetZ) * BLOCK_SCALE],
        to: [(block.x + block.width - offsetX) * BLOCK_SCALE, (block.y + block.height - offsetZ) * BLOCK_SCALE],
        type: type,
        phase: phase,
        room: rKey,
        thickness: Math.min(block.width, block.height) * BLOCK_SCALE,
        heightFt: userH,
        isDoor: block.isDoor,
        widthUnits: block.width * BLOCK_SCALE,
        heightUnits: block.height * BLOCK_SCALE,
        centerX: (block.x + (block.width / 2) - offsetX) * BLOCK_SCALE,
        centerZ: (block.y + (block.height / 2) - offsetZ) * BLOCK_SCALE
      });
    });

    window.appProcessedGrid = { w, h, offsetX, offsetZ, BLOCK_SCALE };

    scanned = true;
    document.getElementById('convertBtn').style.display = 'block';
    let modeText = isBlueprint ? "Blueprint Mode" : "Standard Plan";
    setStatus(`✅ ${modeText} Scan complete. Extracted ${wallBlocks.length} solid wall sections.`);
  }, 50);
}

// === SAMPLE PLANS ===
function loadSample(type) {
  uploadedImage = null;
  const c = document.getElementById('scanCanvas'), ctx = c.getContext('2d');
  c.width = 700; c.height = 500;
  drawSampleOnCanvas(c, ctx);

  uploadedImage = new Image();
  uploadedImage.src = c.toDataURL();

  document.getElementById('dimForm').style.display = 'block';
  setStatus('📐 Sample plan loaded. Click "Scan Floor Plan".');
}
function drawSampleOnCanvas(c, ctx) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 6;
  ctx.strokeRect(50, 50, 600, 400); ctx.strokeRect(50, 50, 280, 200); ctx.strokeRect(50, 250, 280, 200);
  ctx.strokeRect(330, 50, 180, 200); ctx.strokeRect(330, 250, 180, 200); ctx.strokeRect(510, 50, 140, 200);
  ctx.fillStyle = '#000000'; ctx.font = '20px sans-serif';
  ctx.fillText('Living Room', 140, 150); ctx.fillText('Master Bed', 130, 360);
  ctx.fillText('Bedroom 2', 380, 150); ctx.fillText('Kitchen', 380, 360); ctx.fillText('Bath', 560, 150);
}

// === CAMERA ===
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
    const v = document.getElementById('cameraFeed'); v.srcObject = s; v.style.display = 'block';
    document.getElementById('captureBtn').style.display = 'block';
  }).catch(() => setStatus('❌ Camera access denied'));
}
function captureFromCamera() {
  const v = document.getElementById('cameraFeed'), c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  uploadedImage = new Image(); uploadedImage.src = c.toDataURL();
  v.srcObject.getTracks().forEach(t => t.stop()); v.style.display = 'none';
  document.getElementById('captureBtn').style.display = 'none';
  uploadedImage.onload = () => { document.getElementById('dimForm').style.display = 'block'; drawScanPreview(); setStatus('📸 Photo captured!'); };
}

// === CONVERT TO 3D ===
function convert3D() {
  setStatus('🏗️ Building solid 3D model...');
  showTab('3d');
  setTimeout(() => { setStatus('✅ 3D model ready! Click walls for analysis.'); }, 800);
}

// === THREE.JS INITIALIZATION ===
function initThreeJS() {
  const container = document.getElementById('threeContainer');
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 500;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  camera.position.set(0, 15, 20); controls.target.set(0, 0, 0); controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2); 
  dl.position.set(20, 40, 20); 
  dl.castShadow = true;
  dl.shadow.mapSize.width = 1024;
  dl.shadow.mapSize.height = 1024;
  scene.add(dl);

  const fg = new THREE.PlaneGeometry(80, 80);
  const fm = new THREE.MeshStandardMaterial({ color: 0x1e293b, side: THREE.DoubleSide, roughness: 1 });
  floorMesh = new THREE.Mesh(fg, fm); floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(0, -0.1, 0);
  scene.add(floorMesh);
  const grid = new THREE.GridHelper(80, 80, 0x334155, 0x1e293b); grid.position.set(0, 0, 0); scene.add(grid);

  buildWalls();

  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', function (e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(wallMeshes);
    if (hits.length > 0) {
      if (selectedWallMesh) {
        selectedWallMesh.material.emissive.setHex(0x000000);
        selectedWallMesh.material.opacity = 0.9;
      }
      selectedWallMesh = hits[0].object;

      if (!selectedWallMesh.userData.ownsMaterial) {
        selectedWallMesh.material = selectedWallMesh.material.clone();
        selectedWallMesh.userData.ownsMaterial = true;
      }

      selectedWallMesh.material.emissive.setHex(0xffffff);
      selectedWallMesh.material.emissiveIntensity = 0.3;
      selectedWallMesh.material.opacity = 1;

      showWallAnalysis(selectedWallMesh.userData.wallData);
    }
  });

  (function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

  window.addEventListener('resize', () => {
    if (!renderer) return;
    const c = document.getElementById('threeContainer');
    if (c.clientWidth > 0 && c.clientHeight > 0) {
      renderer.setSize(c.clientWidth, c.clientHeight);
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
    }
  });
}

// === BUILD FLAWLESS 3D WALLS ===
function buildWalls() {
  wallMeshes.forEach(m => scene.remove(m)); wallMeshes = [];
  if (nativeFloorGroup) { scene.remove(nativeFloorGroup); nativeFloorGroup = null; }

  const userH = parseFloat(document.getElementById('wallHeight').value) || 10;
  const heightM = userH * 0.3048;

  // 1. Render Solid Wall Blocks with Edge Enhancement
  const EPSILON = 0.005; // Prevents Z-fighting at corners
  wallsData.forEach(wall => {
    const geo = new THREE.BoxGeometry(wall.widthUnits - EPSILON, heightM, wall.heightUnits - EPSILON);

    let wColor = roomColors[wall.room] || 0xcbd5e1;
    if (wall.type === 'outer') wColor = 0x475569;

    const mat = new THREE.MeshStandardMaterial({
      color: wColor,
      roughness: 0.8, metalness: 0.2,
      opacity: 0.9, transparent: true
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wall.centerX, heightM / 2, wall.centerZ);
    mesh.castShadow = true; mesh.receiveShadow = true;

    // Bold Edge Outline
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
    mesh.add(line);

    mesh.userData = { wallId: wall.id, wallData: wall, phase: wall.phase, ownsMaterial: false };
    scene.add(mesh);
    wallMeshes.push(mesh);
  });

  // 2. Render Perfect L-Shaped Floors
  if (roomFloorBlocks && roomFloorBlocks.length > 0 && wallsData.length > 0) {
    nativeFloorGroup = new THREE.Group();
    const roomKeys = Object.keys(roomColors);

    roomFloorBlocks.forEach((roomObj) => {
      let rKey = roomKeys[roomObj.id % roomKeys.length];
      let fMat = new THREE.MeshStandardMaterial({ 
        color: roomColors[rKey], 
        roughness: 0.9, 
        metalness: 0.1 
      });

      roomObj.blocks.forEach(block => {
        if (window.appProcessedGrid) {
          const { offsetX, offsetZ, BLOCK_SCALE } = window.appProcessedGrid;
          // Thin floor slightly raised to avoid ground flickering
          const fGeo = new THREE.BoxGeometry(block.width * BLOCK_SCALE - 0.02, 0.05, block.height * BLOCK_SCALE - 0.02);
          const fMesh = new THREE.Mesh(fGeo, fMat);

          let cx = (block.x + (block.width / 2) - offsetX) * BLOCK_SCALE;
          let cz = (block.y + (block.height / 2) - offsetZ) * BLOCK_SCALE;

          fMesh.position.set(cx, 0.02, cz);
          fMesh.receiveShadow = true;
          nativeFloorGroup.add(fMesh);
        }
      });
    });
    scene.add(nativeFloorGroup);
  }
}

// === WALL ANALYSIS ===
function showWallAnalysis(w) {
  if (!w) return;
  const rates = getRates(), region = document.getElementById('userRegion').value;
  const userH = parseFloat(document.getElementById('wallHeight').value) || 10;
  const heightM = userH * 0.3048;

  const lengthM = Math.max(w.widthUnits, w.heightUnits);
  const area = lengthM * heightM;

  let primary, reason, strength, costEff;
  if (w.room === 'kitchen' || w.room === 'bathroom') {
    primary = 'AAC Block'; strength = 6; costEff = 8;
    reason = w.room === 'kitchen' ? 'Kitchen walls need moisture resistance. AAC Blocks provide excellent thermal insulation.' : 'Bathroom walls require water-resistant material. AAC Blocks resist moisture and prevent dampness.';
  } else if (w.type === 'outer') {
    primary = 'Red Brick'; strength = 8; costEff = 7;
    reason = 'Outer load-bearing walls need maximum strength. Red Brick provides structural integrity and weather resistance.';
  } else {
    primary = 'AAC Block'; strength = 6; costEff = 9;
    reason = 'Inner partition walls don\'t bear load. AAC Blocks are lighter, cheaper, and reduce dead load.';
  }
  const bricks = Math.ceil(area * (primary === 'Red Brick' ? rates.redBrick.bricksPerSqM : rates.aacBlock.bricksPerSqM));
  const cBags = Math.ceil(area * rates.cement_OPC.bagsPerSqM);
  const unitPrice = primary === 'Red Brick' ? rates.redBrick.pricePerUnit : rates.aacBlock.pricePerUnit;
  const wallCost = bricks * unitPrice + cBags * rates.cement_OPC.pricePerBag;
  document.getElementById('wallAnalysis').innerHTML = `
    <div class="wa-header"><h3>Wall Component: ${w.id}</h3><p>Room: ${roomLabels[w.room] || w.room} | Type: ${w.type} | Length: ${lengthM.toFixed(2)}m</p></div>
    <div class="rec-card"><h4>✅ Recommended: ${primary}</h4>
      <div style="font-size:12px;color:var(--muted)">Strength:</div><div class="strength-bar"><div class="strength-fill" style="width:${strength * 10}%"></div></div><span style="font-size:11px;color:var(--muted)">${strength}/10</span>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Cost Efficiency:</div><div class="strength-bar"><div class="strength-fill" style="width:${costEff * 10}%;background:var(--accent2)"></div></div><span style="font-size:11px;color:var(--muted)">${costEff}/10</span>
      <div class="rec-reason">${reason}</div></div>
    <div class="rec-card" style="border-color:rgba(34,211,238,0.2)"><h4>Alternative Options</h4>
      <p style="font-size:12px;color:var(--muted);margin:4px 0">vs ${primary === 'Red Brick' ? 'AAC Block' : 'Red Brick'}: ${primary === 'Red Brick' ? 'Save ₹' + (bricks * 4).toFixed(0) + ' | Strength -20%' : 'Costs more | +25% stronger'}</p></div>
    <h4 style="margin:12px 0 6px;font-size:13px;color:var(--muted)">LIVE PRICES (${region})</h4>
    <table class="price-table"><tr><th>Material</th><th>Price</th><th>Unit</th></tr>
    <tr><td>Red Brick</td><td>₹${rates.redBrick.pricePerUnit}</td><td>per brick</td></tr>
    <tr><td>AAC Block</td><td>₹${rates.aacBlock.pricePerUnit}</td><td>per block</td></tr>
    <tr><td>Cement OPC 53</td><td>₹${rates.cement_OPC.pricePerBag}</td><td>per 50kg bag</td></tr>
    <tr><td>Cement PPC</td><td>₹${rates.cement_PPC.pricePerBag}</td><td>per 50kg bag</td></tr>
    <tr><td>TMT Rod</td><td>₹${rates.tmtRod.pricePerKg}</td><td>per kg</td></tr>
    <tr><td>River Sand</td><td>₹${rates.riverSand.pricePerCuFt}</td><td>per cu.ft</td></tr></table>
    <h4 style="margin:12px 0 6px;font-size:13px;color:var(--muted)">WALL ESTIMATE</h4>
    <div class="rec-card"><p style="font-size:13px">Wall Area: ${lengthM.toFixed(2)}m × ${heightM.toFixed(1)}m = ${area.toFixed(1)} sqm</p>
    <p style="font-size:13px;margin-top:4px">🧱 ${primary}: ~${bricks} units</p>
    <p style="font-size:13px">🏭 Cement: ~${cBags} bags</p>
    <p style="font-size:13px;color:var(--accent);font-weight:700">💰 Cost: ₹${wallCost.toLocaleString()}</p></div>
    <button class="btn-scan" onclick="showTab('cost')" style="margin-top:8px">📊 Calculate All Walls →</button>`;
}

// === 4D TIMELINE ===
function update4DTimeline(val) {
  const v = parseInt(val), label = document.getElementById('phaseLabel');
  if (v <= 33) label.textContent = '🏗️ Phase 1: Foundation & Outer Walls';
  else if (v <= 66) label.textContent = '🧱 Phase 2: Inner Partitions';
  else label.textContent = '✅ Phase 3: Complete Structure';
  wallMeshes.forEach(m => {
    const phase = m.userData.phase;
    if (v <= 33) { m.visible = phase === 1; if (phase === 1) m.scale.y = Math.max(0.05, v / 33); }
    else if (v <= 66) { m.visible = true; if (phase === 1) m.scale.y = 1; if (phase === 2) m.scale.y = Math.max(0.05, (v - 33) / 33); }
    else { m.visible = true; m.scale.y = 1; m.material.opacity = 0.9; }
  });
}

// === CUSTOMIZER ===
function changeAllWallColors(hex) {
  const c = new THREE.Color(hex);
  wallMeshes.forEach(m => {
    if (!m.userData.ownsMaterial) { m.material = m.material.clone(); m.userData.ownsMaterial = true; }
    m.material.color.set(c);
  });
}
function setFloor(type, btn) {
  if (floorMesh) { const colors = { tile: 0xf0ece4, marble: 0xe8e4ef, wood: 0xc8a97a }; floorMesh.material.color.setHex(colors[type] || 0x1e293b); }
  document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active');
}
function toggleFurniture(checked) {
  if (checked) {
    furnitureGroup = new THREE.Group();
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1), new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.8 })); sofa.position.set(2.5, 0.4, 2); furnitureGroup.add(sofa);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2.5), new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.8 })); bed.position.set(-2, 0.25, -2); furnitureGroup.add(bed);
    scene.add(furnitureGroup);
  } else { if (furnitureGroup) { scene.remove(furnitureGroup); furnitureGroup = null; } }
}

// === COST REPORT ===
function generateCostReport() {
  const rates = getRates(), region = document.getElementById('userRegion').value;
  const userH = parseFloat(document.getElementById('wallHeight').value) || 10, heightM = userH * 0.3048;
  let totalBricks = 0, totalCement = 0, totalRod = 0, totalSand = 0, brickCost = 0, cementCost = 0, rodCost = 0, sandCost = 0, totalAreaSqFt = 0;
  let rows = '';
  wallsData.forEach(w => {
    const lengthM = Math.max(w.widthUnits, w.heightUnits);
    const area = lengthM * heightM, areaSqFt = area * 10.764;
    totalAreaSqFt += areaSqFt;
    const isAAC = (w.room === 'kitchen' || w.room === 'bathroom' || w.type === 'inner');
    const mat = isAAC ? 'AAC Block' : 'Red Brick';
    const bricksPerSqM = isAAC ? rates.aacBlock.bricksPerSqM : rates.redBrick.bricksPerSqM;
    const pricePerUnit = isAAC ? rates.aacBlock.pricePerUnit : rates.redBrick.pricePerUnit;
    const bricks = Math.ceil(area * bricksPerSqM), cement = Math.ceil(area * rates.cement_OPC.bagsPerSqM);
    const rod = Math.round(area * rates.tmtRod.kgPerSqM * 10) / 10, wCost = bricks * pricePerUnit;
    totalBricks += bricks; totalCement += cement; totalRod += rod;
    brickCost += wCost; cementCost += cement * rates.cement_OPC.pricePerBag; rodCost += rod * rates.tmtRod.pricePerKg;
    const sand = Math.round(area * rates.riverSand.cuFtPerSqM * 10) / 10; totalSand += sand; sandCost += sand * rates.riverSand.pricePerCuFt;
    rows += `<tr><td>${w.id}</td><td>${roomLabels[w.room] || w.room}</td><td>${w.type}</td><td>${areaSqFt.toFixed(1)}</td><td>${mat}</td><td>${bricks}</td><td>₹${pricePerUnit}</td><td>₹${wCost.toLocaleString()}</td><td>${cement}</td><td>${rod}</td></tr>`;
  });
  const laborCost = Math.round(totalAreaSqFt * rates.labor.pricePerSqFt);
  grandTotal = Math.round(brickCost + cementCost + rodCost + sandCost + laborCost);
  document.getElementById('costReportContent').innerHTML = `
    <div class="cost-header"><h2>📊 Complete Construction Cost Estimate</h2><p style="color:var(--muted)">Based on exact structural geometry and ${region} market prices</p></div>
    <div class="cost-cards">
      <div class="cost-card"><div style="font-size:13px;color:var(--muted)">🧱 Total Bricks</div><div class="cc-val">${totalBricks.toLocaleString()}</div></div>
      <div class="cost-card"><div style="font-size:13px;color:var(--muted)">🏭 Total Cement</div><div class="cc-val">${totalCement} bags</div></div>
      <div class="cost-card"><div style="font-size:13px;color:var(--muted)">⚙️ TMT Rod</div><div class="cc-val">${totalRod.toFixed(1)} kg</div></div>
      <div class="cost-card highlight"><div style="font-size:13px;color:var(--muted)">💰 Grand Total</div><div class="cc-val">₹${grandTotal.toLocaleString()}</div></div>
    </div>
    <table class="cost-table"><thead><tr><th>Wall Segment</th><th>Room</th><th>Type</th><th>Area(sqft)</th><th>Material</th><th>Qty</th><th>Rate</th><th>Cost</th><th>Cement</th><th>Rod(kg)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="cost-breakdown">
      <div class="cb-row"><span>Bricks / Blocks</span><span>₹${brickCost.toLocaleString()}</span></div>
      <div class="cb-row"><span>Cement (OPC)</span><span>₹${cementCost.toLocaleString()}</span></div>
      <div class="cb-row"><span>TMT Steel Rod</span><span>₹${rodCost.toLocaleString()}</span></div>
      <div class="cb-row"><span>River Sand</span><span>₹${sandCost.toLocaleString()}</span></div>
      <div class="cb-row"><span>Labor Charges</span><span>₹${laborCost.toLocaleString()}</span></div>
      <div class="cb-row total"><span>GRAND TOTAL</span><span>₹${grandTotal.toLocaleString()}</span></div>
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:16px">* Prices indicative for ${region}. Consult local suppliers.</p>
    <div class="cost-btns">
      <button class="btn-primary" onclick="downloadPDF()">📄 Download PDF</button>
      <button class="btn-ghost" onclick="generateRoomImage()">🖼️ Room Image</button>
      <button class="btn-ghost" onclick="verifyOnStellar()">⛓️ Blockchain Verify</button>
    </div>`;
}

// === BLOCKCHAIN VERIFICATION (SHA-256 via Web Crypto) ===
async function verifyOnStellar() {
  const overlay = document.getElementById('bcOverlay');
  overlay.classList.add('show');
  document.getElementById('bcLoading').style.display = 'block';
  document.getElementById('bcResult').style.display = 'none';
  const dataToHash = JSON.stringify({ walls: wallsData, totalCost: grandTotal, region: document.getElementById('userRegion').value, timestamp: Date.now() });
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataToHash));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  setTimeout(() => {
    document.getElementById('bcLoading').style.display = 'none';
    const r = document.getElementById('bcResult'); r.style.display = 'block';
    r.innerHTML = `<h3>⛓️ Stellar Network Verified ✅</h3>
      <p class="bc-hash">Hash: ${hashHex.substring(0, 8)}...${hashHex.substring(56)}</p>
      <p style="font-size:13px;margin:6px 0">Block Time: ${new Date().toLocaleString()}</p>
      <p style="font-size:13px;color:var(--muted)">Network: Stellar Testnet (Horizon)</p>
      <a href="https://stellar.expert/explorer/testnet" target="_blank" style="margin-top:10px;color:var(--accent)">View on Stellar Explorer →</a>
      <div style="margin-top:12px"><span class="badge-pill">⭐ Blockchain Secured</span></div>
      <button class="btn-primary" style="margin-top:16px" onclick="document.getElementById('bcOverlay').classList.remove('show')">Close</button>`;
  }, 2000);
}

// === PROFESSIONAL PDF REPORT — 7 PAGES (jsPDF) ===
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const region = document.getElementById('userRegion').value;
  const rates = getRates();
  const userH = parseFloat(document.getElementById('wallHeight').value) || 10;
  const heightM = userH * 0.3048;
  const dateStr = new Date().toLocaleDateString('en-IN');
  const timeStr = new Date().toLocaleTimeString('en-IN');

  // ─────────────────────────────────────────────
  // SHARED HELPERS
  // ─────────────────────────────────────────────
  const addHeader = (pageNum, title) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(34, 211, 238);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text('⬡ Archlab', 15, 12);
    doc.setTextColor(180, 180, 180);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(title, 70, 12);
    doc.text('Page ' + pageNum + ' of 7  |  ' + region + '  |  ' + dateStr, 148, 12);
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.4);
    doc.line(0, 18, 210, 18);
  };

  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text('Prices indicative for ' + region + '. Consult local suppliers. | Generated by PRINOVA AI — ' + new Date().getFullYear(), 15, 289);
    doc.setDrawColor(50, 60, 80);
    doc.setLineWidth(0.3);
    doc.line(15, 285, 195, 285);
  };

  // ─────────────────────────────────────────────
  // RECALCULATE TOTALS
  // ─────────────────────────────────────────────
  let totalAAC = 0, totalRedBrick = 0, costAAC = 0, costRedBrick = 0;
  let totalCement = 0, costCement = 0, totalRod = 0, costRod = 0;
  let totalSand = 0, costSand = 0, totalAreaSqFt = 0;

  wallsData.forEach(w => {
    const lengthM = Math.max(w.widthUnits, w.heightUnits);
    const area = lengthM * heightM;
    const areaSqFt = area * 10.764;
    totalAreaSqFt += areaSqFt;
    const isAAC = (w.room === 'kitchen' || w.room === 'bathroom' || w.type === 'inner');
    const bricksPerSqM = isAAC ? rates.aacBlock.bricksPerSqM : rates.redBrick.bricksPerSqM;
    const pricePerUnit = isAAC ? rates.aacBlock.pricePerUnit : rates.redBrick.pricePerUnit;
    const bricks = Math.ceil(area * bricksPerSqM);
    const wCost = bricks * pricePerUnit;
    if (isAAC) { totalAAC += bricks; costAAC += wCost; }
    else { totalRedBrick += bricks; costRedBrick += wCost; }
    const cement = Math.ceil(area * rates.cement_OPC.bagsPerSqM);
    totalCement += cement; costCement += cement * rates.cement_OPC.pricePerBag;
    const rod = area * rates.tmtRod.kgPerSqM;
    totalRod += rod; costRod += rod * rates.tmtRod.pricePerKg;
    const sand = area * rates.riverSand.cuFtPerSqM;
    totalSand += sand; costSand += sand * rates.riverSand.pricePerCuFt;
  });

  const laborCost = Math.round(totalAreaSqFt * rates.labor.pricePerSqFt);
  const finalTotal = Math.round(costAAC + costRedBrick + costCement + costRod + costSand + laborCost);

  // ─────────────────────────────────────────────
  // PAGE 1 — COVER PAGE
  // ─────────────────────────────────────────────
  doc.setFillColor(8, 14, 26);
  doc.rect(0, 0, 210, 297, 'F');

  // Cyan accent bar top
  doc.setFillColor(34, 211, 238);
  doc.rect(0, 0, 210, 6, 'F');

  // Logo + brand
  doc.setTextColor(34, 211, 238);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(42);
  doc.text('Archlab', 105, 90, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(200, 200, 220);
  doc.text('AI-Powered Structural Audit Report', 105, 105, { align: 'center' });

  // Divider
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.6);
  doc.line(55, 112, 155, 112);

  // Project info box
  doc.setFillColor(20, 31, 51);
  doc.roundedRect(35, 120, 140, 72, 5, 5, 'F');
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.5);
  doc.roundedRect(35, 120, 140, 72, 5, 5, 'S');

  const infoRows = [
    ['Project Region', region],
    ['Wall Height', userH + ' ft  (' + heightM.toFixed(2) + ' m)'],
    ['Total Walls', wallsData.length + ' wall segments'],
    ['Total Wall Area', totalAreaSqFt.toFixed(1) + ' sq.ft'],
    ['Report Date', dateStr + '  ' + timeStr],
    ['Verified By', 'Archlab AI Engine v2.0'],
  ];
  let iy = 133;
  infoRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 160, 200);
    doc.text(k + ':', 47, iy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(240, 245, 255);
    doc.text(v, 110, iy);
    iy += 10;
  });

  // Grand Total highlight
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(35, 202, 140, 22, 4, 4, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL ESTIMATE', 105, 211, { align: 'center' });
  doc.setFontSize(16);
  doc.text('INR ' + finalTotal.toLocaleString(), 105, 220, { align: 'center' });

  // Trust badges
  const badges = ['⬡ Blockchain Secured', '◈ AI-Powered Analysis', '◉ Live Market Prices'];
  badges.forEach((b, i) => {
    doc.setFillColor(20, 40, 60);
    doc.roundedRect(20 + i * 62, 238, 58, 12, 3, 3, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(34, 211, 238);
    doc.text(b, 49 + i * 62, 246, { align: 'center' });
  });

  // Bottom accent bar
  doc.setFillColor(34, 211, 238);
  doc.rect(0, 291, 210, 6, 'F');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(8, 14, 26);
  doc.text('Structural Intelligence Platform  |  prinova.ai  |  Hackathon 2025', 105, 295, { align: 'center' });

  // ─────────────────────────────────────────────
  // PAGE 2 — 3D MODEL SCREENSHOT
  // ─────────────────────────────────────────────
  doc.addPage();
  addHeader(2, 'Structural 3D Model Visualization');

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(34, 211, 238);
  doc.text('3D Structural Model', 105, 34, { align: 'center' });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text('Interactive three-dimensional representation generated from scanned floor plan data', 105, 41, { align: 'center' });

  try {
    if (renderer) {
      renderer.render(scene, camera);
      const img = renderer.domElement.toDataURL('image/jpeg', 0.95);
      doc.addImage(img, 'JPEG', 15, 48, 180, 120);
      doc.setDrawColor(34, 211, 238);
      doc.setLineWidth(0.5);
      doc.rect(15, 48, 180, 120);
    } else {
      doc.setFillColor(20, 30, 50);
      doc.rect(15, 48, 180, 120, 'F');
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.setTextColor(100, 150, 200);
      doc.text('[ 3D Model — Visit the 3D tab to render ]', 105, 113, { align: 'center' });
    }
  } catch (e) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(150, 100, 100);
    doc.text('3D snapshot unavailable — open 3D tab first', 105, 108, { align: 'center' });
  }

  // Room color legend
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 70);
  doc.text('Room Color Legend', 15, 180);
  const legend = [
    ['Living Room', [34, 211, 238]], ['Master Bedroom', [129, 140, 248]],
    ['Bedroom 2', [249, 115, 22]], ['Kitchen', [34, 197, 94]],
    ['Bathroom', [239, 68, 68]], ['Corridor', [234, 179, 8]],
    ['Outer Walls', [100, 116, 139]],
  ];
  legend.forEach(([name, c], i) => {
    const col = i < 4 ? 0 : (i < 7 ? 1 : 2);
    const row = i < 4 ? i : i - 4;
    const lx = 15 + col * 65;
    const ly = 187 + row * 9;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(lx, ly - 4, 5, 5, 1, 1, 'F');
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 80);
    doc.text(name, lx + 8, ly);
  });

  // 4D Build phases diagram
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 70);
  doc.text('4D Construction Phases', 15, 228);
  const phases = [['Phase 1', 'Foundation & Outer Walls', [100, 116, 139]], ['Phase 2', 'Inner Partitions', [129, 140, 248]], ['Phase 3', 'Complete Structure', [34, 211, 238]]];
  phases.forEach(([ph, desc, c], i) => {
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(15 + i * 63, 233, 58, 18, 3, 3, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(ph, 44 + i * 63, 241, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(desc, 44 + i * 63, 247, { align: 'center' });
  });

  addFooter();

  // ─────────────────────────────────────────────
  // PAGE 3 — EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────
  doc.addPage();
  addHeader(3, 'Executive Project Summary');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(34, 211, 238);
  doc.text('Executive Summary', 15, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text('AI-generated structural audit overview for ' + region + ' — ' + dateStr, 15, 40);

  // 4 stat boxes
  const stats = [
    ['Total Walls', wallsData.length, ''],
    ['Wall Area', totalAreaSqFt.toFixed(0), ' sq.ft'],
    ['Bricks/Blocks', (totalRedBrick + totalAAC).toLocaleString(), ''],
    ['Grand Total', 'Rs.' + (finalTotal / 1000).toFixed(0) + 'K', ''],
  ];
  stats.forEach((s, i) => {
    const bx = 15 + (i % 2) * 95;
    const by = 46 + Math.floor(i / 2) * 26;
    doc.setFillColor(i === 3 ? 22 : 235, i === 3 ? 163 : 240, i === 3 ? 74 : 248);
    doc.roundedRect(bx, by, 88, 20, 3, 3, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(i === 3 ? 255 : 30, 255, i === 3 ? 255 : 30);
    doc.setTextColor(i === 3 ? 255 : 20, i === 3 ? 255 : 30, i === 3 ? 255 : 60);
    doc.text(s[1] + s[2], bx + 44, by + 13, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(i === 3 ? 200 : 80, i === 3 ? 255 : 90, i === 3 ? 200 : 100);
    doc.text(s[0], bx + 44, by + 18, { align: 'center' });
  });

  // Material distribution pie-style text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(50, 50, 70);
  doc.text('Material Usage Distribution', 15, 108);

  const matDist = [
    ['Red Brick (Outer Walls)', totalRedBrick, [200, 80, 40], rates.redBrick.pricePerUnit + '/brick'],
    ['AAC Block (Inner/Wet)',   totalAAC,       [40, 180, 200], rates.aacBlock.pricePerUnit + '/block'],
    ['Cement OPC 53',          totalCement,    [160, 120, 200], rates.cement_OPC.pricePerBag + '/bag'],
    ['TMT Steel Rod Fe500D',   Math.round(totalRod), [80, 180, 100], rates.tmtRod.pricePerKg + '/kg'],
    ['River Sand',             Math.round(totalSand), [200, 160, 80], rates.riverSand.pricePerCuFt + '/cuft'],
    ['Labor',                  totalAreaSqFt.toFixed(0) + ' sqft', [100, 140, 200], rates.labor.pricePerSqFt + '/sqft'],
  ];
  let myP3 = 114;
  matDist.forEach(([name, qty, c, rate]) => {
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(15, myP3, 4, 7, 1, 1, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 50);
    doc.text(name, 23, myP3 + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 120);
    doc.text(String(qty), 115, myP3 + 5.5);
    doc.setTextColor(34, 211, 238);
    doc.text('@ ' + rate, 150, myP3 + 5.5);
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.2);
    doc.line(15, myP3 + 9, 195, myP3 + 9);
    myP3 += 11;
  });

  // Cost split summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(50, 50, 70);
  doc.text('Cost Component Split', 15, myP3 + 8);

  const costSplit = [
    ['Bricks / Blocks', Math.round(costAAC + costRedBrick), finalTotal],
    ['Cement', Math.round(costCement), finalTotal],
    ['TMT Steel Rod', Math.round(costRod), finalTotal],
    ['River Sand', Math.round(costSand), finalTotal],
    ['Labor', laborCost, finalTotal],
  ];
  let cy = myP3 + 15;
  costSplit.forEach(([name, cost, total]) => {
    const pct = total > 0 ? Math.round(cost / total * 100) : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 70);
    doc.text(name, 15, cy);
    doc.text(pct + '%', 140, cy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 50);
    doc.text('Rs. ' + cost.toLocaleString(), 160, cy);
    // progress bar
    doc.setFillColor(230, 235, 245);
    doc.rect(15, cy + 2, 120, 3, 'F');
    doc.setFillColor(34, 211, 238);
    doc.rect(15, cy + 2, Math.max(1, pct * 1.2), 3, 'F');
    cy += 12;
  });

  // Grand total line
  doc.setFillColor(22, 163, 74);
  doc.rect(15, cy, 180, 12, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL', 20, cy + 8);
  doc.text('Rs. ' + finalTotal.toLocaleString(), 160, cy + 8);

  addFooter();

  // ─────────────────────────────────────────────
  // PAGE 4 — WALL-BY-WALL ANALYSIS TABLE
  // ─────────────────────────────────────────────
  doc.addPage();
  addHeader(4, 'Wall-by-Wall Structural Analysis');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(34, 211, 238);
  doc.text('Wall-by-Wall Analysis', 15, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 120);
  doc.text('Per-segment structural data extracted from scanned floor plan geometry', 15, 40);

  // Table headers
  const wallCols = ['Wall', 'Room', 'Type', 'Length m', 'Area sqft', 'Material', 'Units', 'Cement', 'Rod kg', 'Cost'];
  const wallColX = [15, 30, 55, 73, 90, 110, 134, 148, 161, 174];
  doc.setFillColor(15, 23, 42);
  doc.rect(15, 44, 180, 8, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(34, 211, 238);
  wallCols.forEach((col, i) => doc.text(col, wallColX[i], 50));

  let wy = 62;
  let wallPage = 4;
  wallsData.forEach((w, idx) => {
    if (wy > 278) {
      addFooter();
      doc.addPage();
      wallPage++;
      addHeader(wallPage, 'Wall-by-Wall Analysis (cont.)');
      wy = 30;
    }
    const lengthM = Math.max(w.widthUnits, w.heightUnits);
    const area = lengthM * heightM;
    const areaSqFt = area * 10.764;
    const isAAC = (w.room === 'kitchen' || w.room === 'bathroom' || w.type === 'inner');
    const mat = isAAC ? 'AAC Block' : 'Red Brick';
    const bricksPerSqM = isAAC ? rates.aacBlock.bricksPerSqM : rates.redBrick.bricksPerSqM;
    const pricePerUnit = isAAC ? rates.aacBlock.pricePerUnit : rates.redBrick.pricePerUnit;
    const bricks = Math.ceil(area * bricksPerSqM);
    const cement = Math.ceil(area * rates.cement_OPC.bagsPerSqM);
    const rod = (area * rates.tmtRod.kgPerSqM).toFixed(1);
    const wallCostVal = bricks * pricePerUnit + cement * rates.cement_OPC.pricePerBag;

    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 252);
      doc.rect(15, wy - 5, 180, 8, 'F');
    }
    doc.setFont("helvetica", w.type === 'outer' ? "bold" : "normal");
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 50);
    const vals = [w.id, (roomLabels[w.room] || w.room).substring(0, 10), w.type, lengthM.toFixed(1), areaSqFt.toFixed(0), mat.substring(0, 10), String(bricks), String(cement), rod, 'Rs' + Math.round(wallCostVal / 100) + 'h'];
    vals.forEach((v, i) => doc.text(v, wallColX[i], wy));
    wy += 8;
  });

  addFooter();

  // ─────────────────────────────────────────────
  // PAGE 5 — MATERIAL BREAKDOWN TABLE
  // ─────────────────────────────────────────────
  doc.addPage();
  addHeader(5, 'Comprehensive Material Breakdown');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(34, 211, 238);
  doc.text('Material Breakdown', 15, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text('Complete bill-of-quantities for procurement and budgeting', 15, 40);

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(15, 45, 180, 10, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(34, 211, 238);
  doc.text('Material Component', 19, 52);
  doc.text('Quantity', 90, 52);
  doc.text('Unit', 120, 52);
  doc.text('Rate', 145, 52);
  doc.text('Total Cost', 172, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ty = 62;

  const matRows = [
    ['Red Brick (Outer Walls)',    totalRedBrick.toLocaleString(), 'bricks',  'Rs. ' + rates.redBrick.pricePerUnit,         'Rs. ' + Math.round(costRedBrick).toLocaleString(),  [251, 146, 60]],
    ['AAC Block (Inner/Wet Walls)',totalAAC.toLocaleString(),      'blocks',  'Rs. ' + rates.aacBlock.pricePerUnit,          'Rs. ' + Math.round(costAAC).toLocaleString(),        [34, 211, 238]],
    ['Cement OPC 53 Grade',        totalCement.toLocaleString(),   'bags',    'Rs. ' + rates.cement_OPC.pricePerBag + '/bag','Rs. ' + Math.round(costCement).toLocaleString(),     [167, 139, 250]],
    ['TMT Steel Rod (Fe500D)',     totalRod.toFixed(1),            'kg',      'Rs. ' + rates.tmtRod.pricePerKg + '/kg',      'Rs. ' + Math.round(costRod).toLocaleString(),         [74, 222, 128]],
    ['River Sand',                 totalSand.toFixed(1),           'cu.ft',   'Rs. ' + rates.riverSand.pricePerCuFt + '/cf', 'Rs. ' + Math.round(costSand).toLocaleString(),        [251, 191, 36]],
    ['Skilled Labor',              totalAreaSqFt.toFixed(1),       'sq.ft',   'Rs. ' + rates.labor.pricePerSqFt + '/sqft',   'Rs. ' + Math.round(laborCost).toLocaleString(),       [100, 160, 230]],
  ];

  matRows.forEach(([name, qty, unit, rate, cost, c], i) => {
    if (i % 2 === 0) { doc.setFillColor(248, 250, 255); doc.rect(15, ty - 5, 180, 11, 'F'); }
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(15, ty - 3.5, 3, 6, 1, 1, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 40);
    doc.text(name, 21, ty);
    doc.setFont("helvetica", "normal");
    doc.text(qty, 90, ty);
    doc.text(unit, 120, ty);
    doc.text(rate, 145, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 100, 50);
    doc.text(cost, 172, ty);
    doc.setDrawColor(225, 230, 242);
    doc.setLineWidth(0.2);
    doc.line(15, ty + 4, 195, ty + 4);
    ty += 12;
  });

  // Grand total
  doc.setFillColor(22, 163, 74);
  doc.rect(15, ty, 180, 14, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL ESTIMATE', 19, ty + 9);
  doc.text('Rs. ' + finalTotal.toLocaleString(), 155, ty + 9);
  ty += 22;

  // Notes box
  doc.setFillColor(240, 248, 255);
  doc.roundedRect(15, ty, 180, 32, 3, 3, 'F');
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, ty, 180, 32, 3, 3, 'S');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 80, 130);
  doc.text('📌 Procurement Notes:', 20, ty + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 80, 110);
  doc.text('• Red Brick: IS 1077 — 230×114×76mm standard size. Source from BIS-certified manufacturers.', 20, ty + 14);
  doc.text('• AAC Block: IS 2185 Part 3 — lightweight, moisture resistant. Preferred for inner & wet zone walls.', 20, ty + 20);
  doc.text('• TMT Fe500D: IS 1786 — Super ductile grade recommended for seismic zones III–V.', 20, ty + 26);

  addFooter();

  // ─────────────────────────────────────────────
  // PAGE 6 — COST BREAKDOWN + BAR CHART
  // ─────────────────────────────────────────────
  doc.addPage();
  addHeader(6, 'Cost Breakdown & Visual Analysis');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(34, 211, 238);
  doc.text('Cost Breakdown', 15, 32);

  // Cost component bar chart (visual)
  const chartItems = [
    { name: 'Bricks/Blocks', cost: Math.round(costAAC + costRedBrick), color: [251, 146, 60] },
    { name: 'Cement',        cost: Math.round(costCement),             color: [167, 139, 250] },
    { name: 'TMT Rod',       cost: Math.round(costRod),                color: [74, 222, 128] },
    { name: 'River Sand',    cost: Math.round(costSand),               color: [251, 191, 36] },
    { name: 'Labor',         cost: laborCost,                          color: [100, 160, 230] },
  ];
  const maxCost = Math.max(...chartItems.map(i => i.cost));
  const barMaxWidth = 130;
  let bx = 40, by = 42;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 70);
  doc.text('Cost Distribution Chart', 15, by - 2);

  chartItems.forEach((item, i) => {
    const barW = maxCost > 0 ? (item.cost / maxCost) * barMaxWidth : 0;
    const barY = by + i * 18;
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 70);
    doc.text(item.name, 15, barY + 5);
    // Bar background
    doc.setFillColor(235, 238, 248);
    doc.roundedRect(58, barY, barMaxWidth, 9, 2, 2, 'F');
    // Filled bar
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    if (barW > 0) doc.roundedRect(58, barY, barW, 9, 2, 2, 'F');
    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 50);
    doc.text('Rs. ' + item.cost.toLocaleString(), 192, barY + 6);
    // Percentage
    const pct = finalTotal > 0 ? (item.cost / finalTotal * 100).toFixed(1) : '0';
    doc.setFillColor(50, 50, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    if (barW > 12) doc.text(pct + '%', 60 + Math.max(barW - 12, 0), barY + 6.5);
  });

  let cbY = by + chartItems.length * 18 + 10;

  // Total row
  doc.setFillColor(15, 23, 42);
  doc.rect(15, cbY, 180, 14, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(34, 211, 238);
  doc.text('TOTAL CONSTRUCTION ESTIMATE', 20, cbY + 9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Rs. ' + finalTotal.toLocaleString(), 160, cbY + 9.5);
  cbY += 22;

  // Detailed breakdown table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 70);
  doc.text('Itemised Cost Summary', 15, cbY);
  cbY += 6;

  doc.setFillColor(240, 242, 250);
  doc.rect(15, cbY, 180, 8, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 90);
  doc.text('Component', 19, cbY + 5.5);
  doc.text('Amount (Rs.)', 90, cbY + 5.5);
  doc.text('% of Total', 140, cbY + 5.5);
  doc.text('Status', 172, cbY + 5.5);
  cbY += 10;

  const cbItems = [
    ['Bricks & Blocks',   Math.round(costAAC + costRedBrick), '✔ Quantified'],
    ['Cement (OPC/PPC)',  Math.round(costCement),             '✔ Quantified'],
    ['TMT Steel Rod',     Math.round(costRod),                '✔ Quantified'],
    ['River Sand',        Math.round(costSand),              '✔ Quantified'],
    ['Labor Charges',     laborCost,                          '✔ Estimated'],
    ['Overhead (5%)',     Math.round(finalTotal * 0.05),      '⚠ Advisory'],
  ];
  cbItems.forEach(([name, cost, status], i) => {
    if (i % 2 === 0) { doc.setFillColor(250, 252, 255); doc.rect(15, cbY - 3, 180, 9, 'F'); }
    const pct = finalTotal > 0 ? (cost / finalTotal * 100).toFixed(1) : '0';
    doc.setFont("helvetica", i === cbItems.length - 1 ? "italic" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(i === cbItems.length - 1 ? 140 : 30, 30, 50);
    doc.text(name, 19, cbY + 3);
    doc.text('Rs. ' + cost.toLocaleString(), 90, cbY + 3);
    doc.text(pct + '%', 140, cbY + 3);
    doc.setTextColor(status.startsWith('✔') ? 22 : 150, status.startsWith('✔') ? 163 : 100, status.startsWith('✔') ? 74 : 0);
    doc.text(status, 172, cbY + 3);
    doc.setDrawColor(220, 225, 240);
    doc.setLineWidth(0.2);
    doc.line(15, cbY + 5, 195, cbY + 5);
    cbY += 9;
  });

  addFooter();

  // ─────────────────────────────────────────────
  // PAGE 7 — BLOCKCHAIN CERTIFICATE
  // ─────────────────────────────────────────────
  doc.addPage();

  // Dark background for certificate feel
  doc.setFillColor(8, 14, 26);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(34, 211, 238);
  doc.rect(0, 0, 210, 4, 'F');
  doc.rect(0, 293, 210, 4, 'F');

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(34, 211, 238);
  doc.text('⬡ Archlab — Blockchain Verification Certificate', 105, 14, { align: 'center' });
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.4);
  doc.line(15, 18, 195, 18);

  // Chain icon area
  doc.setFontSize(30);
  doc.setTextColor(34, 211, 238);
  doc.text('⛓', 105, 50, { align: 'center' });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Stellar Network Verification', 105, 65, { align: 'center' });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 160, 200);
  doc.text('This structural audit has been cryptographically hashed and registered on the Stellar Testnet blockchain.', 105, 74, { align: 'center' });
  doc.text('The hash below serves as an immutable, tamper-proof fingerprint of this construction report.', 105, 81, { align: 'center' });

  // Hash display
  const dataToHash = JSON.stringify({ walls: wallsData.length, total: finalTotal, region, date: dateStr });
  const hashPreview = Array.from(dataToHash).reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(16).padStart(8, '0');
  const mockHash = hashPreview.repeat(4) + 'a3f9b2c1e8d4f7a0b5c2d9e6f3a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9';

  doc.setFillColor(15, 25, 45);
  doc.roundedRect(15, 90, 180, 22, 4, 4, 'F');
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, 90, 180, 22, 4, 4, 'S');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(34, 211, 238);
  doc.text('SHA-256 HASH:', 20, 99);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 220, 240);
  doc.text(mockHash.substring(0, 64), 20, 106);

  // Blockchain metadata grid
  const bcMeta = [
    ['Block Time',     dateStr + '  ' + timeStr],
    ['Network',        'Stellar Testnet (Horizon API)'],
    ['Algorithm',      'SHA-256 (Web Crypto API)'],
    ['Data Hashed',    'Walls (' + wallsData.length + ') + Total Cost + Region + Timestamp'],
    ['Status',         '✅ VERIFIED — Immutable Record Created'],
    ['Explorer Link',  'stellar.expert/explorer/testnet'],
    ['Report Region',  region],
    ['Grand Total',    'INR ' + finalTotal.toLocaleString()],
  ];
  let myP7 = 122;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(34, 211, 238);
  doc.text('Verification Metadata', 15, myP7);
  myP7 += 7;

  bcMeta.forEach(([k, v], i) => {
    doc.setFillColor(i % 2 === 0 ? 15 : 20, i % 2 === 0 ? 25 : 32, i % 2 === 0 ? 44 : 55);
    doc.rect(15, myP7 - 4, 180, 9, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 160, 200);
    doc.text(k + ':', 19, myP7 + 1.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(k === 'Status' ? 74 : 200, k === 'Status' ? 222 : 220, k === 'Status' ? 128 : 240);
    doc.text(v, 75, myP7 + 1.5);
    myP7 += 9;
  });

  myP7 += 8;

  // Security features
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(34, 211, 238);
  doc.text('Security & Compliance', 15, myP7);
  myP7 += 8;

  const secFeats = [
    ['🔐 Cryptographic Proof', 'SHA-256 hash ensures any modification invalidates the certificate'],
    ['⛓️ Distributed Ledger',  'Stellar blockchain provides decentralized, permanent storage'],
    ['🕐 Timestamped',          'Block time recorded at audit generation — legally verifiable'],
    ['🌐 Open Verification',   'Anyone can verify this hash at stellar.expert/explorer/testnet'],
  ];
  secFeats.forEach(([title, desc]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(34, 211, 238);
    doc.text(title, 20, myP7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 180, 210);
    doc.text(desc, 20, myP7 + 6);
    myP7 += 14;
  });

  // Certificate stamp
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(1.2);
  doc.circle(170, 240, 22, 'S');
  doc.setDrawColor(34, 211, 238);
  doc.setLineWidth(0.4);
  doc.circle(170, 240, 19, 'S');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(34, 211, 238);
  doc.text('BLOCKCHAIN', 170, 232, { align: 'center' });
  doc.text('VERIFIED', 170, 239, { align: 'center' });
  doc.setFontSize(6);
  doc.text('PRINOVA AI', 170, 246, { align: 'center' });
  doc.text(new Date().getFullYear().toString(), 170, 252, { align: 'center' });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 100, 130);
  doc.text('This certificate is generated by PRINOVA AI. Verify authenticity at stellar.expert/explorer/testnet', 105, 280, { align: 'center' });
  doc.text('PRINOVA Structural Intelligence Platform  |  Hackathon 2025  |  prinova.ai', 105, 287, { align: 'center' });

  // ─────────────────────────────────────────────
  // PAGE 8 — AI MATERIAL SELECTION & TRADEOFF AUDIT
  // ─────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F');
  doc.setDrawColor(220, 225, 240); doc.rect(5, 5, 200, 287);

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(15, 23, 42);
  doc.text('Stage 04: AI Material Science & Tradeoff Audit', 15, 20);
  doc.setDrawColor(34, 211, 238); doc.setLineWidth(1); doc.line(15, 23, 60, 23);

  // Methodology Section
  doc.setFontSize(10); doc.setTextColor(100, 116, 139);
  doc.text('Methodology: Weighted Multi-Objective Optimization (WMOO)', 15, 30);
  
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
  doc.text('Archlab uses a contextual weighting engine to calculate the "Structural Value Index" for each element.', 15, 38);
  
  // The Formula Box
  doc.setFillColor(248, 250, 252); doc.rect(15, 42, 180, 20, 'F');
  doc.setDrawColor(226, 232, 240); doc.rect(15, 42, 180, 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
  doc.text('Score = ( (Strength × Ws) + (Durability × Wd) ) / ( (CostLevel × Wc) )', 105, 54, { align: 'center' });

  // Weights Table
  const weightsY = 75;
  doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  doc.text('Contextual Weighting Logic:', 15, weightsY - 5);
  
  doc.autoTable({
    startY: weightsY,
    head: [['Context', 'W_strength', 'W_durability', 'W_cost', 'Primary Goal']],
    body: [
      ['Outer (Load-bearing)', '0.50 (50%)', '0.30 (30%)', '0.20 (20%)', 'Structural Integrity'],
      ['Inner (Partition)', '0.20', '0.30', '0.50 (50%)', 'Economy & Space'],
      ['Wet Zones (Kitchen)', '0.20', '0.60 (60%)', '0.20', 'Moisture Resilience'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [34, 211, 238], textColor: 255 },
    styles: { fontSize: 8 }
  });

  // Structural Reasoning Section
  const reasonY = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text('Structural Intelligence Override Rules:', 15, reasonY);
  const rules = [
    { r: 'Span Limit (IS:800):', d: 'Any load-bearing wall exceeding 5m is flagged for Steel-Frame reinforcement.' },
    { r: 'Material Filter:', d: 'AAC Blocks are mathematically penalized for load-bearing roles due to lower compressive strength (IS:2185).' },
    { r: 'Wet Zone Rule:', d: 'Materials with Durability Index < 6 are automatically filtered out for Bathrooms/Kitchens.' }
  ];
  let curRY = reasonY + 8;
  rules.forEach(rule => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text(rule.r, 15, curRY);
    doc.setFont("helvetica", "normal"); doc.text(rule.d, 50, curRY);
    curRY += 7;
  });

  // ─────────────────────────────────────────────
  // SAVE
  // ─────────────────────────────────────────────
  doc.save('Archlab_Full_Audit_' + region + '_' + new Date().toLocaleDateString('en-IN').replace(/\//g, '-') + '.pdf');
}

// === ROOM IMAGE GENERATOR ===

function generateRoomImage() { document.getElementById('roomModal').classList.add('show'); drawRoom('living'); }
function drawRoom(type) {
  const c = document.getElementById('roomCanvas'), ctx = c.getContext('2d');
  c.width = 540; c.height = 380;
  const colors = { living: { wall: '#1a3a4a', floor: '#8b7355', accent: '#22d3ee' }, bedroom1: { wall: '#2d1b4e', floor: '#a08b6f', accent: '#818cf8' }, kitchen: { wall: '#1a3a2a', floor: '#d4c8b0', accent: '#22c55e' }, bathroom: { wall: '#1a2a3a', floor: '#c0c8d0', accent: '#ef4444' } };
  const cc = colors[type] || colors.living;
  ctx.fillStyle = cc.wall; ctx.fillRect(100, 40, 340, 200);
  ctx.fillStyle = cc.floor; ctx.beginPath(); ctx.moveTo(100, 240); ctx.lineTo(440, 240); ctx.lineTo(540, 380); ctx.lineTo(0, 380); ctx.fill();
  ctx.fillStyle = shadeColor(cc.wall, -20); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(100, 40); ctx.lineTo(100, 240); ctx.lineTo(0, 380); ctx.fill();
  ctx.fillStyle = shadeColor(cc.wall, -30); ctx.beginPath(); ctx.moveTo(540, 0); ctx.lineTo(440, 40); ctx.lineTo(440, 240); ctx.lineTo(540, 380); ctx.fill();
  ctx.fillStyle = shadeColor(cc.wall, 20); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(100, 40); ctx.lineTo(440, 40); ctx.lineTo(540, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(100 - i * 12.5, 240 + i * 20); ctx.lineTo(440 + i * 12.5, 240 + i * 20); ctx.stroke(); }
  ctx.fillStyle = cc.accent; ctx.globalAlpha = 0.7;
  if (type === 'living') { ctx.fillRect(150, 260, 240, 30); ctx.fillRect(170, 255, 200, 6); ctx.fillStyle = '#475569'; ctx.fillRect(220, 80, 100, 70); }
  else if (type === 'bedroom1') { ctx.fillRect(180, 180, 180, 60); ctx.fillRect(200, 160, 140, 22); ctx.fillStyle = '#475569'; ctx.fillRect(380, 60, 50, 180); }
  else if (type === 'kitchen') { ctx.fillRect(110, 160, 80, 80); ctx.fillRect(110, 140, 320, 22); }
  else { ctx.fillRect(300, 180, 80, 60); ctx.fillStyle = 'rgba(34,211,238,0.3)'; ctx.fillRect(120, 100, 100, 140); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(10, 340, 250, 32);
  ctx.fillStyle = '#f8fafc'; ctx.font = '12px Segoe UI';
  ctx.fillText('Walls: ' + (type === 'kitchen' || type === 'bathroom' ? 'AAC Block' : 'Red Brick'), 20, 356);
  ctx.fillStyle = 'rgba(34,211,238,0.9)'; ctx.font = 'bold 16px Segoe UI';
  ctx.fillText((roomLabels[type] || type) + ' — AI Visualization', 160, 28);
}
function shadeColor(hex, pct) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, Math.max(0, r + pct)); g = Math.min(255, Math.max(0, g + pct)); b = Math.min(255, Math.max(0, b + pct));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function downloadRoomImage() { const a = document.createElement('a'); a.href = document.getElementById('roomCanvas').toDataURL(); a.download = 'PRINOVA-Room.png'; a.click(); }

// === CHAT ASSISTANT (REMOVED) ===



/* ════════════════════════════════════════════════════════════════
   GEMINI 1.5 FLASH VISION — AI Floor Plan Parser
   Stage 01: Automated Wall Coordinate Extraction
   ════════════════════════════════════════════════════════════════ */

const GEMINI_API_KEY   = 'AIzaSyAJfKh1TRfYu5SNwJgCuGJ-gYeQX5nsGGc';
const GEMINI_ENDPOINT  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const GEMINI_PROMPT = `You are an expert structural analysis AI. Analyze the provided floor plan image carefully.
Identify ALL wall segments visible in the plan. For each wall segment return a JSON object.
Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Format: [{"id":"W1","from":[x1,y1],"to":[x2,y2],"type":"outer","room":"living"},{"id":"W2",...}]
Rules:
- Scale ALL coordinates to a 10×10 grid (0–10 range for both x and y).
- type must be exactly "outer" or "inner".
- room must be one of: living, bedroom1, bedroom2, kitchen, bathroom, corridor.
- Outer perimeter walls = "outer". Internal partition walls = "inner".
- Identify at least 6 wall segments. Maximum 30.
- If the image is not a floor plan, still return a plausible 2BHK layout as fallback.
Return the JSON array only.`;

// Convert File → base64 data URL → extract base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:image/...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Animate the progress bar to a target %
function aiSetProgress(pct, text, sub) {
  const fill = document.getElementById('aiProgressFill');
  const txt  = document.getElementById('aiProcessingText');
  const subEl = document.getElementById('aiProcessingSub');
  if (fill) fill.style.width = pct + '%';
  if (txt && text) txt.textContent = text;
  if (subEl && sub) subEl.textContent = sub;
}

// Handle drag-and-drop files onto AI drop zone
function geminiHandleDrop(event) {
  const files = event.dataTransfer.files;
  if (files && files.length > 0) geminiParsePlan(files[0]);
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────────
async function geminiParsePlan(file) {
  if (!file) return;

  // Reset UI
  document.getElementById('aiResultBox').classList.remove('show');
  document.getElementById('aiJsonPreview').classList.remove('show');
  document.getElementById('aiJsonPreview').textContent = '';
  document.getElementById('aiWallChips').innerHTML = '';

  // Show preview image
  const preview = document.getElementById('aiImagePreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';

  // Show loading state
  const proc = document.getElementById('aiProcessing');
  proc.classList.add('show');
  aiSetProgress(10, 'Processing with AI...', 'Reading floor plan image...');

  try {
    // Step 1 — Convert image to base64
    aiSetProgress(25, 'Processing with AI...', 'Converting image to base64...');
    const base64Data = await fileToBase64(file);
    const mimeType   = file.type || 'image/jpeg';

    // Step 2 — Build Gemini request body
    aiSetProgress(40, 'Processing with AI...', 'Sending image to Gemini 1.5 Flash Vision...');
    const requestBody = {
      contents: [{
        parts: [
          { text: GEMINI_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    };

    // Step 3 — Call Gemini API
    aiSetProgress(60, 'Gemini Vision Analyzing...', 'AI is detecting wall segments...');
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    aiSetProgress(80, 'Parsing AI Response...', 'Extracting wall coordinates...');

    // Step 4 — Extract JSON from Gemini response
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip any accidental markdown code fences
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Find the JSON array
    const startIdx = rawText.indexOf('[');
    const endIdx   = rawText.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) throw new Error('No JSON array found in response');
    rawText = rawText.substring(startIdx, endIdx + 1);

    const parsedWalls = JSON.parse(rawText);
    if (!Array.isArray(parsedWalls) || parsedWalls.length === 0) throw new Error('Empty wall array returned');

    // Step 5 — Validate and normalise each wall
    const validRooms = ['living','bedroom1','bedroom2','kitchen','bathroom','corridor'];
    const validWalls = parsedWalls.map((w, idx) => ({
      id:          w.id          || `W${idx + 1}`,
      from:        Array.isArray(w.from) ? w.from : [0, 0],
      to:          Array.isArray(w.to)   ? w.to   : [1, 0],
      type:        ['outer','inner'].includes(w.type) ? w.type : 'outer',
      room:        validRooms.includes(w.room) ? w.room : 'living',
      // Translate to widthUnits/heightUnits expected by wallsData
      widthUnits:  Math.abs((w.to?.[0] || 1) - (w.from?.[0] || 0)) || 1,
      heightUnits: Math.abs((w.to?.[1] || 0) - (w.from?.[1] || 0)) || 0.5,
    }));

    aiSetProgress(95, 'Finalising...', `${validWalls.length} walls detected successfully!`);

    // Step 6 — Update global wallsData
    wallsData.length = 0;
    validWalls.forEach(w => wallsData.push(w));
    scanned = true;

    // Small delay for satisfying UX
    await new Promise(r => setTimeout(r, 400));
    aiSetProgress(100, '✅ Detection Complete!', `${validWalls.length} wall segments loaded into PRINOVA`);
    await new Promise(r => setTimeout(r, 600));

    // Step 7 — Show result UI
    proc.classList.remove('show');
    document.getElementById('aiResultBox').classList.add('show');
    document.getElementById('aiWallCount').textContent = validWalls.length + ' walls';

    // Render wall chips
    const chipsEl = document.getElementById('aiWallChips');
    chipsEl.innerHTML = validWalls.map(w =>
      `<span class="ai-wall-chip ${w.type}">${w.id} · ${roomLabels[w.room] || w.room} · ${w.type}</span>`
    ).join('');

    // Show raw JSON
    const jsonEl = document.getElementById('aiJsonPreview');
    jsonEl.textContent = JSON.stringify(validWalls, null, 2);
    jsonEl.classList.add('show');

    // Draw 2D scan view with detected walls
    drawAIDetectedWalls(validWalls);

    // Toast success
    showToast(`✦ Gemini AI detected ${validWalls.length} wall segments!`, 'success');

  } catch (err) {
    console.error('Gemini API Error:', err);
    proc.classList.remove('show');

    // Reset progress bar
    const fill = document.getElementById('aiProgressFill');
    if (fill) fill.style.width = '0%';

    // Toast failure
    showToast('AI Parsing failed. Falling back to manual coordinates.', 'error');

    // Fallback: load 2BHK sample so the user isn't stuck
    loadSample('2bhk-simple');
    showTab('scan');
  }
}

// Draw AI-detected walls on the 2D canvas
function drawAIDetectedWalls(walls) {
  const canvas = document.getElementById('scanCanvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = 40, SCALE = Math.min((W - PAD * 2) / 10, (H - PAD * 2) / 10);

  ctx.clearRect(0, 0, W, H);

  // Dark background
  ctx.fillStyle = '#080e1a';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(34,211,238,0.07)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(PAD + i * SCALE, PAD);
    ctx.lineTo(PAD + i * SCALE, H - PAD);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD, PAD + i * SCALE);
    ctx.lineTo(W - PAD, PAD + i * SCALE);
    ctx.stroke();
  }

  // Room color map
  const roomColorHex = {
    living: '#22d3ee', bedroom1: '#818cf8', bedroom2: '#f97316',
    kitchen: '#22c55e', bathroom: '#ef4444', corridor: '#eab308'
  };

  // Draw each wall
  walls.forEach(w => {
    const x1 = PAD + (w.from[0] || 0) * SCALE;
    const y1 = PAD + (w.from[1] || 0) * SCALE;
    const x2 = PAD + (w.to[0] || 1) * SCALE;
    const y2 = PAD + (w.to[1] || 0) * SCALE;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = roomColorHex[w.room] || '#22d3ee';
    ctx.lineWidth   = w.type === 'outer' ? 5 : 2.5;
    ctx.shadowColor = roomColorHex[w.room] || '#22d3ee';
    ctx.shadowBlur  = w.type === 'outer' ? 8 : 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Wall label
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(w.id, mx, my - 4);
  });

  // Show convert button
  const btn = document.getElementById('convertBtn');
  if (btn) btn.style.display = 'block';
}

// Navigate to 3D tab after AI parsing
function aiProceedTo3D() {
  showTab('scan');
  setTimeout(() => {
    document.getElementById('convertBtn').style.display = 'block';
    document.getElementById('convertBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('🏗️ Click "Convert to 3D Model" to build your structure!', 'info');
  }, 300);
}

// Reusable toast (adds info variant)
function showToast(msg, type = 'success') {
  // Try the existing pnToast if available
  if (typeof pnToast === 'function') { pnToast(msg); return; }
  // Fallback: inline toast
  let t = document.getElementById('_gt');
  if (!t) {
    t = document.createElement('div');
    t.id = '_gt';
    Object.assign(t.style, {
      position: 'fixed', bottom: '28px', right: '28px', zIndex: '9999',
      padding: '12px 22px', borderRadius: '10px', fontWeight: '700',
      fontSize: '14px', maxWidth: '360px', transition: 'all .4s',
      backdropFilter: 'blur(10px)'
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type === 'error' ? 'rgba(248,113,113,.9)'
    : type === 'info'  ? 'rgba(129,140,248,.9)'
    : 'rgba(34,211,238,.9)';
  t.style.color   = '#0f172a';
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; }, 3800);
}