/* FREEBOUND – Spiellogik (Singleplayer, Three.js r160).
 * Wird von build.js zusammen mit three.min.js in dist/index.html eingebettet. */
(function () {
'use strict';

const T = window.THREE;
if (!T) {
  document.body.innerHTML = '<p style="color:#fff;padding:24px;font-family:sans-serif">Three.js konnte nicht geladen werden.</p>';
  return;
}

/* ============================================================
 * 1. Konstanten und Einstellungen
 * ============================================================ */
const SAVE_KEY = 'freebound.save.v1';
const SET_KEY = 'freebound.settings.v1';
const BLOCK = 60;            // Abstand der Straßenmitten
const LOT_HALF = 25;         // halbe Blockgröße zwischen den Straßen
const ROAD_HALF = 5;
const LAND_LIMIT = 290;      // Spielfeldgrenze an Land
const LAND_EDGE = 236;       // Strand endet hier
const SEA_X = 240;           // ab hier Wasser
const SEA_FLOOR = -0.85;     // Brusttiefe beim Schwimmen
const GRAV = 26;
const PR = 0.4;              // Charakter-Radius
const STEP = 0.45;           // maximale Stufenhöhe
const CLOCK_SPEED = 1.6;     // Spielminuten pro echter Sekunde
const RING_R = 120;          // Rennstrecke
const PED_R = 22.5;          // Gehweg-Radius im Block
const HOUSE_PRICE = 65000;
const INT = { house: { ox: 1000, oz: 0 }, shop: { ox: 1000, oz: 120 } };

const VEH = {
  car:     { name: 'Auto',        body: 'car',  max: 27, accel: 12, brake: 24, rev: 8, turn: 1.9, drag: 0.7, r: 1.25, price: 4500 },
  taxi:    { name: 'Taxi',        body: 'car',  max: 26, accel: 12, brake: 24, rev: 8, turn: 1.9, drag: 0.7, r: 1.25 },
  racer:   { name: 'Rennwagen',   body: 'car',  max: 40, accel: 20, brake: 30, rev: 8, turn: 2.2, drag: 0.5, r: 1.3 },
  van:     { name: 'Transporter', body: 'van',  max: 22, accel: 9,  brake: 18, rev: 6, turn: 1.5, drag: 0.7, r: 1.5 },
  moto:    { name: 'Motorrad',    body: 'two',  max: 30, accel: 15, brake: 22, rev: 6, turn: 2.7, drag: 0.6, r: 0.8, price: 2800 },
  scooter: { name: 'Roller',      body: 'two',  max: 18, accel: 10, brake: 20, rev: 4, turn: 2.4, drag: 0.7, r: 0.7 },
  bike:    { name: 'Fahrrad',     body: 'two',  max: 9,  accel: 6,  brake: 12, rev: 3, turn: 2.9, drag: 0.9, r: 0.6, price: 350 },
  boat:    { name: 'Boot',        body: 'boat', max: 17, accel: 6,  brake: 8,  rev: 4, turn: 1.1, drag: 0.5, r: 1.6, price: 7500, water: true },
};

const OUTFITS = [
  { id: 'basic',  name: 'Basis-Outfit',  price: 0,   shirt: 0x3b82f6, pants: 0x1f2937, hat: null },
  { id: 'red',    name: 'Rot & Jeans',   price: 120, shirt: 0xdc2626, pants: 0x1e3a8a, hat: null },
  { id: 'hoodie', name: 'Grauer Hoodie', price: 180, shirt: 0x6b7280, pants: 0x111827, hat: 0x111827 },
  { id: 'cap',    name: 'Gelbe Kappe',   price: 150, shirt: 0xfacc15, pants: 0x44403c, hat: 0xf97316 },
  { id: 'chef',   name: 'Koch-Outfit',   price: 300, shirt: 0xffffff, pants: 0x0f172a, hat: 0xffffff },
  { id: 'suit',   name: 'Anzug',         price: 450, shirt: 0xf5f5f4, pants: 0x1c1917, hat: 0x1c1917, tie: 0x7f1d1d },
];

const SETTINGS = Object.assign(
  { volume: 0.6, sens: 1.0, invertY: false, quality: 'hoch' },
  loadJSON(SET_KEY)
);

function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
function storeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignoriert */ } }

/* ============================================================
 * 2. Zustand
 * ============================================================ */
const S = {
  money: 250, coins: 0, coinsTaken: [], clothes: ['basic'], outfit: 'basic',
  house: false, stats: { pkg: 0, rides: 0, laps: 0 }, bestLap: null,
};
const clock = { min: 7 * 60, day: 1 };
const weather = { name: 'klar', timer: 90, cloud: 0, fog: 0.0028 };
let zone = 'city';
let elapsed = 0;
let screen = 'title';
let settingsFrom = 'title';
let job = null;
let autosaveTimer = 0;

const cam = { yaw: 0, pitch: 0.38, dist: 7 };
const input = { keyFwd: 0, keyRight: 0, joyX: 0, joyY: 0, fwd: 0, right: 0, sprint: false, jumpQ: false, actQ: false, throwQ: false };
const keysDown = new Set();

const p = {
  x: 0, y: 0, z: 12, vx: 0, vy: 0, vz: 0, h: 0, grounded: true,
  state: 'walk', ragT: 0, rot: { x: 0, z: 0 }, carry: null, inVeh: null,
  climb: null, outfit: 'basic', swim: false, fallTop: 0,
  exitX: 0, exitZ: 0, ch: null,
};

/* colliders je Zone: AABB mit top (Höhe) */
const colliders = { city: [], house: [], shop: [] };
const vehicles = [];
const traffic = [];
const peds = [];
const coins = [];
const props = [];
const propSpawn = [];
const doors = {};
const interactables = [];
const interiorGroups = { house: new T.Group(), shop: new T.Group() };
const interiorLights = [];
const facadeMats = [];
let defaultVehicles = [];
let vid = 1;

/* ============================================================
 * 3. Hilfsfunktionen
 * ============================================================ */
function mulberry(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(1337);
const rndAny = Math.random;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
const fmtEur = (n) => Math.round(n).toLocaleString('de-DE') + ' €';
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = 'b' + w + '_' + h + '_' + d;
  let g = geoCache.get(k);
  if (!g) { g = new T.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}
function cylGeo(r, h, seg) {
  const k = 'c' + r + '_' + h + '_' + seg;
  let g = geoCache.get(k);
  if (!g) { g = new T.CylinderGeometry(r, r, h, seg || 12); geoCache.set(k, g); }
  return g;
}
const matCache = new Map();
function mat(color, rough, metal) {
  rough = rough === undefined ? 0.85 : rough;
  metal = metal || 0;
  const k = color + '_' + rough + '_' + metal;
  let m = matCache.get(k);
  if (!m) { m = new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); matCache.set(k, m); }
  return m;
}
function addMesh(geo, m, x, y, z, parent, cast) {
  const me = new T.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = cast !== false;
  me.receiveShadow = true;
  (parent || worldGroup).add(me);
  return me;
}
function box(w, h, d, color, x, y, z, parent, cast) {
  return addMesh(boxGeo(w, h, d), mat(color), x, y, z, parent, cast);
}
/* Massiver Quader mit Kollision */
function solid(zoneKey, cx, cz, w, d, h, color, parent) {
  const m = box(w, h, d, color, cx, h / 2, cz, parent);
  const b = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top: h, mesh: m };
  colliders[zoneKey].push(b);
  return b;
}

/* Kreis gegen AABB: liefert Verschiebung oder null */
function pushOutOfBox(o, r, b) {
  const cx = clamp(o.x, b.minX, b.maxX);
  const cz = clamp(o.z, b.minZ, b.maxZ);
  const dx = o.x - cx, dz = o.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2), pen = r - d;
    return { nx: (dx / d) * pen, nz: (dz / d) * pen };
  }
  const left = o.x - b.minX, right = b.maxX - o.x, back = o.z - b.minZ, front = b.maxZ - o.z;
  const m = Math.min(left, right, back, front);
  if (m === left) return { nx: -(left + r), nz: 0 };
  if (m === right) return { nx: right + r, nz: 0 };
  if (m === back) return { nx: 0, nz: -(back + r) };
  return { nx: 0, nz: front + r };
}
function circlePush(a, ra, b, rb) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const d = Math.hypot(dx, dz), R = ra + rb;
  if (d >= R) return null;
  if (d < 1e-6) return { nx: R, nz: 0 };
  const pen = R - d;
  return { nx: (dx / d) * pen, nz: (dz / d) * pen };
}
/* Höchster begehbarer Untergrund an (x,z) bis zur Höhe y */
function floorAt(zoneKey, x, z, y, r, exclude) {
  let f = 0;
  for (const b of colliders[zoneKey]) {
    if (b === exclude || b.top <= f) continue;
    if (b.top > y + STEP) continue;
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) f = Math.max(f, b.top);
  }
  return f;
}
/* Umlauf-Punkt auf einem Rechteck um den Mittelpunkt (Radius R) */
function perimPoint(R, s) {
  const E = 2 * R, L = 4 * E;
  s = ((s % L) + L) % L;
  if (s < E) return { x: -R + s, z: -R, dx: 1, dz: 0 };
  if (s < 2 * E) return { x: R, z: -R + (s - E), dx: 0, dz: 1 };
  if (s < 3 * E) return { x: R - (s - 2 * E), z: R, dx: -1, dz: 0 };
  return { x: -R, z: R - (s - 3 * E), dx: 0, dz: -1 };
}
function blockCenter(b) { return -150 + BLOCK * b; }
function randomSpot(rand) {
  const r = rand || rndAny;
  const bx = Math.floor(r() * 6), bz = Math.floor(r() * 6);
  const pp = perimPoint(PED_R - 1, r() * 8 * (PED_R - 1));
  return { x: blockCenter(bx) + pp.x, z: blockCenter(bz) + pp.z };
}

/* ============================================================
 * 4. Renderer, Szene, Licht
 * ============================================================ */
const canvas = document.getElementById('scene');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;

const scene = new T.Scene();
const SKY_DAY = new T.Color(0x8fcbff), SKY_DUSK = new T.Color(0xf0966a), SKY_NIGHT = new T.Color(0x060a1c);
const SKY_GREY = new T.Color(0x9aa3ad), INTERIOR_BG = new T.Color(0x18181d);
const skyNow = SKY_DAY.clone();
scene.background = skyNow.clone();
scene.fog = new T.FogExp2(skyNow.clone(), 0.0028);
const camera = new T.PerspectiveCamera(62, 1, 0.1, 1500);

const hemi = new T.HemisphereLight(0xdcefff, 0x3f5d31, 0.9);
scene.add(hemi);
const sun = new T.DirectionalLight(0xfff4e0, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 420 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);

const worldGroup = new T.Group();
scene.add(worldGroup);
scene.add(interiorGroups.house, interiorGroups.shop);
interiorGroups.house.visible = false;
interiorGroups.shop.visible = false;

/* Gemeinsame Materialien */
const roofMat = mat(0x5c5f66, 0.9);
const asphalt = mat(0x3a3d42, 0.95);
const concrete = mat(0xbdb8ad, 0.95);
const lampMat = new T.MeshStandardMaterial({ color: 0xfff2c2, emissive: 0xffe49a, emissiveIntensity: 0 });
const waterMat = new T.MeshStandardMaterial({ color: 0x2b7bb9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 });

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const facadeBase = (() => {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2d3e50';
  for (let y = 10; y < 118; y += 32) for (let x = 8; x < 118; x += 30) g.fillRect(x, y, 18, 16);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  return t;
})();
const facadeEm = (() => {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#000000'; g.fillRect(0, 0, 128, 128);
  for (let y = 10; y < 118; y += 32) for (let x = 8; x < 118; x += 30) {
    if (rnd() < 0.55) { g.fillStyle = rnd() < 0.5 ? '#ffd27a' : '#ffe9b0'; g.fillRect(x, y, 18, 16); }
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  return t;
})();

function facadeMaterial(w, h, d, tint) {
  const tex = facadeBase.clone();
  tex.repeat.set(Math.max(1, (w + d) / 8), Math.max(1, h / 3.2));
  tex.needsUpdate = true;
  const em = facadeEm.clone();
  em.repeat.copy(tex.repeat);
  em.needsUpdate = true;
  const m = new T.MeshStandardMaterial({ color: tint, map: tex, emissiveMap: em, emissive: 0xffd58a, emissiveIntensity: 0, roughness: 0.75 });
  facadeMats.push(m);
  return m;
}

/* ============================================================
 * 5. Stadtbau: Grundstücke, Gebäude, Parks, Strand
 * ============================================================ */
function lotGround(cx, cz, m) {
  const me = new T.Mesh(new T.PlaneGeometry(LOT_HALF * 2, LOT_HALF * 2), m || concrete);
  me.rotation.x = -Math.PI / 2;
  me.position.set(cx, 0.03, cz);
  me.receiveShadow = true;
  worldGroup.add(me);
}
function building(cx, cz, w, d, h, tint) {
  const f = facadeMaterial(w, h, d, tint);
  const mats = [f, f, roofMat, roofMat, f, f];
  const me = new T.Mesh(boxGeo(w, h, d), mats);
  me.position.set(cx, h / 2, cz);
  me.castShadow = true;
  me.receiveShadow = true;
  worldGroup.add(me);
  const b = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top: h, mesh: me };
  colliders.city.push(b);
  return b;
}
function tree(x, z) {
  const trunk = addMesh(cylGeo(0.28, 3, 6), mat(0x6b4a2b), x, 1.5, z, worldGroup);
  const leaves = addMesh(new T.IcosahedronGeometry(1.9, 0), mat(0x2f7d32, 0.9), x, 4.1, z, worldGroup);
  leaves.scale.set(1, 1.1, 1);
  colliders.city.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, top: 3, mesh: trunk });
}
function lamp(x, z) {
  box(0.16, 6, 0.16, 0x333840, x, 3, z, worldGroup);
  addMesh(new T.SphereGeometry(0.4, 10, 8), lampMat, x, 6.1, z, worldGroup, false);
}
function randomCarColor() {
  const cols = [0x2563eb, 0xdc2626, 0x16a34a, 0x6b7280, 0xf5f5f4, 0x7c3aed, 0x0f766e];
  return cols[Math.floor(rnd() * cols.length)];
}
function parkBlock(cx, cz) {
  lotGround(cx, cz, mat(0x5a9b48, 0.95));
  for (let i = 0; i < 5; i++) {
    const tx = cx + (rnd() - 0.5) * 34, tz = cz + (rnd() - 0.5) * 34;
    if (Math.abs(tx - cx) < 3 && Math.abs(tz - cz) < 3) continue;
    tree(tx, tz);
  }
  // Weg durch den Park
  const path = new T.Mesh(new T.PlaneGeometry(4, LOT_HALF * 2), mat(0xd7c9a6, 0.95));
  path.rotation.x = -Math.PI / 2; path.position.set(cx, 0.05, cz); worldGroup.add(path);
}
function parkingBlock(cx, cz) {
  lotGround(cx, cz, asphalt);
  defaultVehicles.push({ type: 'car', color: randomCarColor(), x: cx - 9, z: cz - 14, h: 0, owned: false });
  defaultVehicles.push({ type: 'car', color: randomCarColor(), x: cx + 9, z: cz + 14, h: Math.PI, owned: false });
}
function randomBlock(cx, cz, bx, bz) {
  lotGround(cx, cz);
  const w = 14 + rnd() * 16, d = 14 + rnd() * 16;
  const ox = (rnd() - 0.5) * (2 * (20 - w / 2));
  const oz = (rnd() - 0.5) * (2 * (20 - d / 2));
  const dc = Math.hypot(bx - 2.5, bz - 2.5);
  const h = (8 + rnd() * 22) * (1.25 - dc * 0.07);
  const tints = [0xf1ede6, 0xd8d4cc, 0xe8dcc8, 0xbfd3e0, 0xdcc9b6];
  building(cx + ox, cz + oz, w, d, Math.max(7, h), tints[Math.floor(rnd() * tints.length)]);
  // Laterne an der Ecke
  lamp(cx + LOT_HALF - 2, cz + LOT_HALF - 2);
}

/* Spezialgebäude mit Eingang */
const SPECIAL = {
  jobcenter: { bx: 2, bz: 2, w: 24, d: 20, h: 16, color: 0xe9e2cf, sign: 0x2563eb },
  depot:     { bx: 0, bz: 2, w: 26, d: 20, h: 12, color: 0x9c8a6a, sign: 0x92400e },
  shop:      { bx: 3, bz: 2, w: 20, d: 16, h: 9,  color: 0xf4b9cc, sign: 0xdb2777, interior: 'shop' },
  dealer:    { bx: 2, bz: 4, w: 26, d: 18, h: 8,  color: 0x8e2d2d, sign: 0x111827 },
  pizza:     { bx: 4, bz: 3, w: 16, d: 14, h: 7,  color: 0xd9542b, sign: 0xfacc15 },
  house:     { bx: 1, bz: 4, w: 18, d: 16, h: 10, color: 0xdcb98e, sign: 0x16a34a, interior: 'house' },
};
const PARKS = ['1,1', '4,5', '0,5', '3,0', '5,1'];

function specialBlock(key, cx, cz) {
  const s = SPECIAL[key];
  lotGround(cx, cz);
  building(cx, cz, s.w, s.d, s.h, s.color);
  const frontZ = cz + s.d / 2;
  // Tür und Schild
  box(2.2, 2.4, 0.15, 0x3b2a1a, cx, 1.2, frontZ + 0.05, worldGroup);
  box(s.w * 0.7, 1.6, 0.2, s.sign, cx, s.h - 1.6, frontZ + 0.1, worldGroup);
  doors[key] = { x: cx, z: frontZ + 1.4, outX: cx, outZ: frontZ + 3.2, interior: s.interior || null };
  if (key === 'jobcenter') {
    // Geheimer Dachcoin, nur über Klettern erreichbar
    coins.push({ id: 'roof', x: cx, z: cz, y: s.h + 0.7, bonus: 500, mesh: null, secret: true });
  }
  if (key === 'dealer') {
    lamp(cx + 13, cz + 10); lamp(cx - 13, cz + 10);
  }
}

function buildCityBlocks() {
  for (let bx = 0; bx < 6; bx++) {
    for (let bz = 0; bz < 6; bz++) {
      const cx = blockCenter(bx), cz = blockCenter(bz);
      const key = bx + ',' + bz;
      if (PARKS.includes(key)) { parkBlock(cx, cz); continue; }
      const sp = Object.keys(SPECIAL).find((k) => SPECIAL[k].bx === bx && SPECIAL[k].bz === bz);
      if (sp) { specialBlock(sp, cx, cz); continue; }
      const r = rnd();
      if (r < 0.16) parkingBlock(cx, cz);
      else randomBlock(cx, cz, bx, bz);
    }
  }
}

function buildRoads() {
  const roadMat = asphalt;
  for (let k = -3; k <= 3; k++) {
    const v = new T.Mesh(new T.PlaneGeometry(ROAD_HALF * 2, 370), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(k * BLOCK, 0.02, 0); v.receiveShadow = true; worldGroup.add(v);
    const hz = new T.Mesh(new T.PlaneGeometry(370, ROAD_HALF * 2), roadMat);
    hz.rotation.x = -Math.PI / 2; hz.position.set(0, 0.02, k * BLOCK); hz.receiveShadow = true; worldGroup.add(hz);
  }
  // Gestrichelte Mittellinien: alle Striche in EINER Geometrie (wenige Draw-Calls)
  const quads = [];
  for (let k = -3; k <= 3; k++) {
    for (let t = -170; t < 170; t += 14) {
      quads.push([k * BLOCK, t, 0.3, 6]);
      quads.push([t, k * BLOCK, 6, 0.3]);
    }
  }
  const lines = new T.Mesh(quadsGeo(quads), mat(0xf5f5f5, 0.6));
  lines.position.y = 0.04;
  lines.receiveShadow = true;
  worldGroup.add(lines);
}
/* Viele flache Rechtecke (x, z, Breite, Tiefe) zu einer Geometrie zusammenfassen */
function quadsGeo(list) {
  const pos = new Float32Array(list.length * 18);
  let o = 0;
  for (const [cx, cz, w, d] of list) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    pos.set([x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1], o);
    o += 18;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function buildLandscape() {
  // Festland (Gras) bis zur Küste
  const grass = new T.Mesh(new T.PlaneGeometry(840, 1200), mat(0x5b8f45, 0.95));
  grass.rotation.x = -Math.PI / 2; grass.position.set(-180, -0.05, 0); grass.receiveShadow = true;
  worldGroup.add(grass);
  // Strand
  const sand = new T.Mesh(new T.PlaneGeometry(40, 1200), mat(0xe9d7a6, 0.95));
  sand.rotation.x = -Math.PI / 2; sand.position.set(LAND_EDGE - 20, 0.02, 0); sand.receiveShadow = true;
  worldGroup.add(sand);
  // Promenade-Palmen
  for (let i = 0; i < 9; i++) {
    const z = -180 + i * 45;
    addMesh(cylGeo(0.3, 5, 6), mat(0x7a5a33), 215, 2.5, z, worldGroup);
    addMesh(new T.IcosahedronGeometry(2.2, 0), mat(0x3f8f3c, 0.9), 215, 5.4, z, worldGroup);
  }
  // Meeresboden und Wasser
  const seabed = new T.Mesh(new T.PlaneGeometry(1400, 1400), mat(0x1f4e5f, 1));
  seabed.rotation.x = -Math.PI / 2; seabed.position.set(SEA_X + 700, -4, 0);
  worldGroup.add(seabed);
  const water = new T.Mesh(new T.PlaneGeometry(1400, 1400), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(SEA_X + 700, 0, 0); water.receiveShadow = true;
  worldGroup.add(water);
  // Steg für Boote
  box(4, 0.3, 26, 0x8b6a45, SEA_X - 2, 0.15, 0, worldGroup);
  // Berge hinter dem Festland (nur Kulisse)
  const mountainMat = mat(0x4f6b4a, 0.95);
  for (let i = 0; i < 14; i++) {
    const h = 90 + rnd() * 120;
    const m = new T.Mesh(new T.ConeGeometry(80 + rnd() * 60, h, 7), mountainMat);
    m.position.set(-650 - rnd() * 40, h / 2, -560 + i * 80);
    worldGroup.add(m);
  }
}

function buildCity() {
  buildLandscape();
  buildRoads();
  buildCityBlocks();
  // Ein paar Bäume am Straßenrand
  for (let i = 0; i < 26; i++) {
    const bx = Math.floor(rnd() * 6), bz = Math.floor(rnd() * 6);
    if (PARKS.includes(bx + ',' + bz)) continue;
    const pp = perimPoint(PED_R + 1.5, rnd() * 8 * (PED_R + 1.5));
    tree(blockCenter(bx) + pp.x, blockCenter(bz) + pp.z);
  }
}

/* ============================================================
 * 6. Innenräume (Haus, Kleiderladen)
 * ============================================================ */
function buildInterior(key) {
  const { ox, oz } = INT[key];
  const g = interiorGroups[key];
  const W = 10, D = 8, H = 3.2;
  const floor = new T.Mesh(new T.PlaneGeometry(W * 2, D * 2), mat(key === 'house' ? 0xb08a5a : 0xe9e4dc, 0.7));
  floor.rotation.x = -Math.PI / 2; floor.position.set(ox, 0.01, oz); floor.receiveShadow = true; g.add(floor);
  const ceil = new T.Mesh(new T.PlaneGeometry(W * 2, D * 2), mat(0xf2f2f2, 0.9));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(ox, H, oz); g.add(ceil);
  const wall = (cx, cz, w, d, col) => {
    box(w, H, d, col, cx, H / 2, cz, g);
    colliders[key].push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top: H });
  };
  const wc = key === 'house' ? 0xf4efe6 : 0xfaf7f2;
  wall(ox, oz + D, W * 2 + 0.4, 0.4, wc);        // Nord
  wall(ox - W, oz, 0.4, D * 2, wc);              // West
  wall(ox + W, oz, 0.4, D * 2, wc);              // Ost
  wall(ox - 5.75, oz - D, 8.5, 0.4, wc);         // Süd links
  wall(ox + 5.75, oz - D, 8.5, 0.4, wc);         // Süd rechts (Tür in der Mitte)

  const light = new T.PointLight(0xfff0d6, 30, 34, 2);
  light.position.set(ox, H - 0.4, oz);
  g.add(light);
  interiorLights.push(light);

  if (key === 'house') {
    solid(key, ox - 6, oz + 4, 2.2, 3.4, 0.6, 0x6e8fb8, g);     // Bett
    solid(key, ox - 6, oz + 4.4, 2.0, 0.8, 0.25, 0xffffff, g);  // Kissen
    solid(key, ox + 5, oz + 5, 4.2, 1.4, 0.9, 0x7a4b2a, g);     // Sofa
    solid(key, ox + 3, oz - 2, 1.8, 1.8, 0.9, 0x9c7a4e, g);     // Tisch
    solid(key, ox + 7, oz - 6.5, 3, 0.8, 0.8, 0x222222, g);     // TV-Schrank
    box(2.4, 1.4, 0.1, 0x111111, ox + 7, 1.6, oz - 6.9, g);     // Bildschirm
    solid(key, ox + 8.6, oz + 6.6, 1.2, 1.2, 2.0, 0xd9dde2, g); // Kühlschrank
    solid(key, ox - 8, oz - 5.5, 2.6, 0.9, 2.2, 0x8b6a45, g);   // Schrank
    interactables.push({ zone: key, x: ox - 6, z: oz + 1.6, r: 2.2, label: () => 'Schlafen & Speichern', act: sleepAndSave });
  } else {
    solid(key, ox, oz + 3.5, 6, 1.4, 1.1, 0x5b3a1f, g);        // Theke
    box(6.2, 0.1, 1.6, 0xd8c7a6, ox, 1.16, oz + 3.5, g);
    for (let i = -1; i <= 1; i++) {
      solid(key, ox + i * 4, oz - 3, 0.7, 2.6, 1.8, 0x9ca3af, g);
      const cols = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7];
      for (let k = 0; k < 4; k++) box(0.5, 0.25, 0.5, cols[(k + i + 1) % cols.length], ox + i * 4, 1.95 + k * 0.1, oz - 3, g);
    }
    interactables.push({ zone: key, x: ox, z: oz + 1.8, r: 2.4, label: () => 'Kleidung kaufen', act: openClothesMenu });
  }
  // Tür-Ausgang
  interactables.push({ zone: key, x: ox, z: oz - D + 1, r: 2.2, label: () => 'Hinausgehen', act: exitInterior });
}

/* ============================================================
 * 7. Sammelobjekte, Gegenstände, Fußgänger, Verkehr
 * ============================================================ */
const coinGeo = new T.CylinderGeometry(0.35, 0.35, 0.08, 14);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new T.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.8, roughness: 0.25, emissive: 0x9a6b00, emissiveIntensity: 0.25 });

function buildCoins() {
  for (let i = 0; i < 22; i++) {
    const s = randomSpot(rnd); // seeded, damit gespeicherte Münz-IDs stimmen
    coins.push({ id: 'c' + i, x: s.x, z: s.z, y: 1.2, bonus: 10, mesh: null });
  }
  for (const c of coins) {
    c.mesh = new T.Mesh(coinGeo, coinMat);
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.castShadow = false;
    worldGroup.add(c.mesh);
  }
}

const crateGeo = boxGeo(1, 1, 1);
const crateMat = mat(0xb47a3e, 0.9);
const ballGeo = new T.SphereGeometry(0.45, 14, 10);
const ballMat = mat(0xef4444, 0.4);
/* Gegenstände: y ist die Unterkante, size die Kantenlänge */
function buildProps() {
  for (let i = 0; i < 16; i++) {
    const s = randomSpot(rnd);
    const isBall = i % 3 === 0;
    const pr = { x: s.x, y: 2, z: s.z, vx: 0, vy: 0, vz: 0, r: isBall ? 0.45 : 0.55, size: isBall ? 0.9 : 1.0, held: false, grounded: false, isBall };
    pr.mesh = new T.Mesh(isBall ? ballGeo : crateGeo, isBall ? ballMat : crateMat);
    pr.mesh.castShadow = true; pr.mesh.receiveShadow = true;
    worldGroup.add(pr.mesh);
    pr.box = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, top: -10, prop: pr };
    colliders.city.push(pr.box);
    props.push(pr);
    propSpawn.push({ x: s.x, y: 2, z: s.z });
  }
}

const PED_OUTFITS = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x0ea5e9];
function buildPeds() {
  for (let i = 0; i < 26; i++) {
    const cx = blockCenter(Math.floor(rndAny() * 6)), cz = blockCenter(Math.floor(rndAny() * 6));
    const ch = buildCharacter({ shirt: PED_OUTFITS[i % PED_OUTFITS.length], pants: 0x334155, hat: i % 4 === 0 ? 0x78350f : null });
    worldGroup.add(ch.group);
    const pe = { id: i, cx, cz, s: rndAny() * 8 * PED_R, speed: 1.4 + rndAny() * 1.2, ch };
    peds.push(pe);
  }
}

const TRAFFIC_LOOPS = [
  { h: 180, n: 9, speed: [9, 13] },
  { h: 60, n: 4, speed: [7, 10] },
];
function buildTraffic() {
  for (const L of TRAFFIC_LOOPS) {
    for (let i = 0; i < L.n; i++) {
      const color = randomCarColor();
      const mesh = buildVehicleMesh('car', color);
      worldGroup.add(mesh.group);
      traffic.push({
        h: L.h, s: (i / L.n) * 8 * L.h + rndAny() * 10,
        speed: L.speed[0] + rndAny() * (L.speed[1] - L.speed[0]),
        mesh, x: 0, z: 0, heading: 0, radius: 1.3,
      });
    }
  }
}

/* Charakter-Modell */
function buildCharacter(o) {
  const g = new T.Group();
  const skin = mat(0xf0c29b, 0.7), shirt = mat(o.shirt, 0.8), pants = mat(o.pants, 0.9), shoe = mat(0x161616, 0.6);
  const part = (w, h, d, m, x, y, z, parent) => {
    const me = new T.Mesh(boxGeo(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = true;
    (parent || g).add(me);
    return me;
  };
  const legL = new T.Group(), legR = new T.Group();
  legL.position.set(-0.17, 0.8, 0); legR.position.set(0.17, 0.8, 0);
  g.add(legL, legR);
  for (const leg of [legL, legR]) {
    part(0.28, 0.8, 0.3, pants, 0, -0.4, 0, leg);
    part(0.3, 0.14, 0.38, shoe, 0, -0.74, 0.04, leg);
  }
  part(0.6, 0.7, 0.34, shirt, 0, 1.15, 0, g);
  if (o.tie) part(0.1, 0.45, 0.05, mat(o.tie), 0, 1.2, 0.19, g);
  const armL = new T.Group(), armR = new T.Group();
  armL.position.set(-0.42, 1.45, 0); armR.position.set(0.42, 1.45, 0);
  g.add(armL, armR);
  for (const arm of [armL, armR]) {
    part(0.22, 0.7, 0.22, shirt, 0, -0.35, 0, arm);
    part(0.2, 0.18, 0.2, skin, 0, -0.8, 0, arm);
  }
  part(0.4, 0.4, 0.4, skin, 0, 1.72, 0, g);
  if (o.hat) {
    part(0.44, 0.12, 0.44, mat(o.hat), 0, 1.97, 0, g);
  }
  return { group: g, legL, legR, armL, armR, phase: 0 };
}
function poseCharacter(ch, dt, speed, grounded, carry, swim) {
  ch.phase += dt * (3 + speed * 1.1);
  const sw = grounded && !swim ? Math.sin(ch.phase) * clamp(speed / 5, 0, 1) * 0.9 : 0;
  ch.legL.rotation.x = sw;
  ch.legR.rotation.x = -sw;
  if (!grounded && !swim) { ch.legL.rotation.x = -0.4; ch.legR.rotation.x = 0.2; }
  if (carry) { ch.armL.rotation.x = -1.3; ch.armR.rotation.x = -1.3; }
  else if (!grounded && !swim) { ch.armL.rotation.x = -2.6; ch.armR.rotation.x = -2.6; }
  else { ch.armL.rotation.x = -sw * 0.8; ch.armR.rotation.x = sw * 0.8; }
}

/* Fahrzeug-Modelle */
function buildVehicleMesh(type, color) {
  const spec = VEH[type] || VEH.car;
  const g = new T.Group();
  const wheels = [];
  const body = mat(color, 0.35, 0.25), dark = mat(0x1d1f23, 0.8), glass = mat(0x8fc3e8, 0.15, 0.1), white = mat(0xf5f5f5, 0.5);
  const addWheel = (x, y, z, r) => {
    const wg = new T.Group();
    wg.position.set(x, y, z);
    const m = new T.Mesh(cylGeo(r, 0.26, 12), dark);
    m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    wg.add(m);
    g.add(wg);
    wheels.push({ g: wg, r });
  };
  const part = (w, h, d, m, x, y, z) => {
    const me = new T.Mesh(boxGeo(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = true;
    g.add(me);
    return me;
  };
  if (spec.body === 'car') {
    part(2.0, 0.7, 4.2, body, 0, 0.85, 0);
    part(1.75, 0.6, 2.2, dark, 0, 1.45, -0.2);
    part(1.6, 0.42, 1.9, glass, 0, 1.45, -0.2);
    part(0.35, 0.18, 0.05, white, 0.65, 0.9, 2.12);
    part(0.35, 0.18, 0.05, white, -0.65, 0.9, 2.12);
    if (type === 'taxi') part(0.7, 0.25, 0.35, mat(0xfff3a0), 0, 1.9, -0.2);
    if (type === 'racer') {
      part(2.1, 0.12, 0.5, dark, 0, 1.3, -2.1);
      part(2.0, 0.35, 4.0, body, 0, 0.7, 0);
    }
    addWheel(0.95, 0.36, 1.4, 0.36); addWheel(-0.95, 0.36, 1.4, 0.36);
    addWheel(0.95, 0.36, -1.4, 0.36); addWheel(-0.95, 0.36, -1.4, 0.36);
  } else if (spec.body === 'van') {
    part(2.1, 2.2, 4.6, body, 0, 1.6, -0.2);
    part(2.12, 0.7, 1.3, dark, 0, 1.2, 1.9);
    part(1.9, 0.5, 0.05, glass, 0, 1.9, 2.1);
    addWheel(1.0, 0.4, 1.5, 0.4); addWheel(-1.0, 0.4, 1.5, 0.4);
    addWheel(1.0, 0.4, -1.5, 0.4); addWheel(-1.0, 0.4, -1.5, 0.4);
  } else if (spec.body === 'two') {
    const big = type === 'moto';
    part(0.15, 0.2, 1.4, dark, 0, 0.6, 0);
    part(0.45, 0.3, 0.7, body, 0, 0.95, 0.2);
    part(0.4, 0.12, 0.7, dark, 0, 0.92, -0.45);
    part(0.6, 0.08, 0.1, dark, 0, 1.2, 0.65);
    const r = big ? 0.36 : type === 'scooter' ? 0.26 : 0.32;
    addWheel(0, r, 0.75, r); addWheel(0, r, -0.75, r);
  } else if (spec.body === 'boat') {
    part(2.2, 0.7, 4.4, body, 0, 0.0, 0);
    part(2.0, 0.1, 4.1, white, 0, 0.4, 0);
    part(1.2, 0.6, 1.4, white, 0, 0.8, -0.5);
    part(1.1, 0.4, 0.05, glass, 0, 0.9, 0.2);
  }
  return { group: g, wheels };
}

/* ============================================================
 * 8. Fahrzeuge (Logik)
 * ============================================================ */
function makeVehicle(type, color, x, z, h, owned, extra) {
  const spec = VEH[type];
  const mesh = buildVehicleMesh(type, color || 0x2563eb);
  worldGroup.add(mesh.group);
  const v = Object.assign({
    id: 'v' + (vid++), type, name: spec.name, x, z, h: h || 0, speed: 0,
    owned: !!owned, job: false, occupied: false, color: color || 0x2563eb,
    radius: spec.r, water: !!spec.water, mesh: mesh.group, wheels: mesh.wheels,
  }, extra || {});
  vehicles.push(v);
  placeVehicle(v);
  return v;
}
function placeVehicle(v) {
  v.mesh.position.set(v.x, v.water ? 0.05 : 0, v.z);
  v.mesh.rotation.y = v.h;
}
function removeVehicle(v) {
  const i = vehicles.indexOf(v);
  if (i >= 0) vehicles.splice(i, 1);
  worldGroup.remove(v.mesh);
}
function updateVehicle(v, dt, thr, steer) {
  const sp = VEH[v.type];
  const grip = weather.name === 'Regen' ? 0.85 : 1;
  if (thr > 0.05) v.speed = Math.min(sp.max, v.speed + sp.accel * grip * dt * thr);
  else if (thr < -0.05) {
    if (v.speed > 0.3) v.speed = Math.max(0, v.speed - sp.brake * dt);
    else v.speed = Math.max(-sp.rev, v.speed - sp.accel * 0.5 * dt);
  } else {
    v.speed *= Math.exp(-sp.drag * dt);
    if (Math.abs(v.speed) < 0.02) v.speed = 0;
  }
  const turnFactor = clamp(Math.abs(v.speed) / 4, 0, 1) * (v.speed < 0 ? -1 : 1);
  v.h += steer * sp.turn * dt * turnFactor;
  v.x += Math.sin(v.h) * v.speed * dt;
  v.z += Math.cos(v.h) * v.speed * dt;
  // Begrenzungen
  if (v.water) {
    if (v.x < SEA_X + 1.5) { v.x = SEA_X + 1.5; v.speed *= 0.2; }
    if (v.x > 1500) v.x = 1500;
  } else {
    if (v.x > LAND_EDGE) { v.x = LAND_EDGE; v.speed *= 0.2; }
  }
  v.z = clamp(v.z, -LAND_LIMIT, LAND_LIMIT);
  v.x = clamp(v.x, -LAND_LIMIT, 1500);
  // Kollision mit Gebäuden, Bäumen, Kisten
  for (const b of colliders.city) {
    if (b.top <= 0.5) continue;
    const pen = pushOutOfBox(v, v.radius, b);
    if (pen) {
      v.x += pen.nx; v.z += pen.nz;
      if (Math.abs(v.speed) > 4) { sfx('crash'); v.speed *= -0.15; } else v.speed *= 0.2;
    }
  }
  // Wagen mit Wagen
  for (const o of vehicles) {
    if (o === v || o.water !== v.water) continue;
    const pen = circlePush(v, v.radius, o, o.radius);
    if (pen) {
      v.x += pen.nx * 0.5; v.z += pen.nz * 0.5;
      o.x -= pen.nx * 0.5; o.z -= pen.nz * 0.5;
      if (Math.abs(v.speed) > 4) sfx('crash');
      v.speed *= 0.3;
    }
  }
  // Räder drehen
  for (const w of v.wheels) w.g.rotation.x += (v.speed * dt) / w.r;
  placeVehicle(v);
}

/* ============================================================
 * 9. Spieler: Bewegung, Kollision, Klettern, Ragdoll
 * ============================================================ */
p.ch = buildCharacter({ shirt: OUTFITS[0].shirt, pants: OUTFITS[0].pants, hat: null });
scene.add(p.ch.group);

function setCharacterOutfit(id) {
  const o = OUTFITS.find((x) => x.id === id) || OUTFITS[0];
  p.outfit = o.id;
  scene.remove(p.ch.group);
  p.ch = buildCharacter({ shirt: o.shirt, pants: o.pants, hat: o.hat, tie: o.tie });
  scene.add(p.ch.group);
  S.outfit = o.id;
}

function setZone(z) {
  zone = z;
  const inside = z !== 'city';
  worldGroup.visible = !inside;
  interiorGroups.house.visible = z === 'house';
  interiorGroups.shop.visible = z === 'shop';
  scene.background.copy(inside ? INTERIOR_BG : skyNow);
  scene.fog.density = inside ? 0 : weather.fog;
  cam.dist = inside ? 4.2 : 7;
}

function enterInterior(key) {
  const d = doors[key === 'house' ? 'house' : 'shop'];
  p.exitX = d.outX; p.exitZ = d.outZ;
  const at = INT[key === 'house' ? 'house' : 'shop'];
  p.x = at.ox; p.z = at.oz - 5; p.y = 0; p.vx = p.vz = p.vy = 0; p.h = 0;
  setZone(key === 'house' ? 'house' : 'shop');
  toast(key === 'house' ? 'Willkommen zu Hause' : 'Kleiderladen');
}
function exitInterior() {
  setZone('city');
  p.x = p.exitX; p.z = p.exitZ; p.y = 0; p.vx = p.vz = p.vy = 0;
}

function findWallAhead(dx, dz) {
  const probeX = p.x + dx * 0.9, probeZ = p.z + dz * 0.9;
  for (const b of colliders.city) {
    if (b.prop) continue;
    if (b.top - p.y < 0.9 || b.top - p.y > 16) continue;
    if (probeX > b.minX - 0.1 && probeX < b.maxX + 0.1 && probeZ > b.minZ - 0.1 && probeZ < b.maxZ + 0.1) return b;
  }
  return null;
}

function startRagdoll(vx, vz, t) {
  if (p.state === 'ragdoll') return;
  p.state = 'ragdoll';
  p.ragT = t || 2.4;
  p.vx = vx; p.vz = vz; p.vy = 6;
  p.grounded = false;
  sfx('crash');
}

function updatePlayerOnFoot(dt, inp) {
  // Kamera-relative Bewegung
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let dx = fx * inp.fwd + rx * inp.right;
  let dz = fz * inp.fwd + rz * inp.right;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const moving = len > 0.1;
  const inWater = p.x >= SEA_X - 0.3 && zone === 'city';
  p.swim = inWater;
  const sprint = inp.sprint && p.grounded && !inWater;
  const maxS = inWater ? 3 : sprint ? 8.5 : 5.2;
  const acc = p.grounded ? 14 : 4;
  p.vx += (dx * maxS - p.vx) * Math.min(1, dt * acc);
  p.vz += (dz * maxS - p.vz) * Math.min(1, dt * acc);
  if (moving) p.h = angleLerp(p.h, Math.atan2(dx, dz), Math.min(1, dt * 12));

  // Springen oder Klettern
  if (p.climb) {
    p.vx = 0; p.vz = 0;
    p.y = Math.min(p.climb.target, p.y + 3.2 * dt);
    if (p.y >= p.climb.target - 0.01) {
      p.y = p.climb.target;
      p.x += p.climb.dx * 1.1; p.z += p.climb.dz * 1.1;
      p.climb = null;
      p.vy = 0;
    }
  } else if (inp.jumpQ && !inWater) {
    if (p.grounded && moving) {
      const wall = findWallAhead(dx, dz);
      if (wall) {
        p.climb = { target: wall.top, dx, dz };
        sfx('ok');
      } else { p.vy = 8.4; sfx('jump'); }
    } else if (p.grounded) { p.vy = 8.4; sfx('jump'); }
  }

  if (!p.climb) {
    // Horizontale Bewegung mit Kollision
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    resolvePlayerHoriz();
  }

  // Vertikale Bewegung
  if (inWater) {
    // Schwimmen: der Charakter sinkt auf Brusttiefe
    p.grounded = false;
    p.vy = 0;
    p.y += (SEA_FLOOR - p.y) * Math.min(1, dt * 3);
    p.fallTop = 0;
  } else if (!p.climb) {
    p.vy -= GRAV * dt;
    p.y += p.vy * dt;
    const f = floorAt(zone, p.x, p.z, p.y, PR, null);
    if (p.y <= f) {
      if (p.vy < -7) {
        sfx('land');
        if (p.fallTop - f > 9) { startRagdoll(p.vx * 0.4, p.vz * 0.4, 1.8); }
      }
      p.y = f; p.vy = 0; p.grounded = true; p.fallTop = f;
    } else {
      p.grounded = false;
      p.fallTop = Math.max(p.fallTop, p.y);
    }
  }
  if (p.grounded && zone === 'city') p.fallTop = p.y;
  if (zone === 'city') {
    p.x = clamp(p.x, -LAND_LIMIT, 1500);
    p.z = clamp(p.z, -LAND_LIMIT, LAND_LIMIT);
  }
  // Fahrzeuge schieben den Charakter weg
  for (const v of vehicles) {
    if (v.occupied || zone !== 'city') continue;
    const pen = circlePush(p, PR, v, v.radius);
    if (pen) {
      p.x += pen.nx; p.z += pen.nz;
      if (Math.abs(v.speed) > 4 && p.state !== 'ragdoll') startRagdoll(v.x > p.x ? -4 : 4, v.z > p.z ? -4 : 4, 2.2);
    }
  }
  // Verkehr: Fahrzeug rammt Fußgänger
  if (zone === 'city' && p.state !== 'ragdoll') {
    for (const t of traffic) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < t.radius + PR + 0.2 && t.speed > 4) {
        startRagdoll((p.x - t.x) * 3, (p.z - t.z) * 3, 2.6);
        break;
      }
    }
  }
}

function resolvePlayerHoriz() {
  for (const b of colliders[zone]) {
    if (b.top <= p.y + STEP) continue;
    const pen = pushOutOfBox(p, PR, b);
    if (pen) {
      p.x += pen.nx; p.z += pen.nz;
      if (b.prop && p.grounded) {
        b.prop.x -= pen.nx * 0.35; b.prop.z -= pen.nz * 0.35;
      }
    }
  }
}

function updateRagdoll(dt) {
  p.ragT -= dt;
  p.vy -= GRAV * dt;
  p.x += p.vx * dt; p.z += p.vz * dt;
  const fr = Math.exp(-dt * 2.2);
  p.vx *= fr; p.vz *= fr;
  resolvePlayerHoriz();
  p.y += p.vy * dt;
  const f = floorAt(zone, p.x, p.z, p.y, PR, null);
  if (p.y <= f) { p.y = f; p.vy = 0; p.grounded = true; }
  else p.grounded = false;
  if (p.ragT <= 0 && p.grounded) {
    p.state = 'walk';
    p.vx = 0; p.vz = 0;
  }
  p.rot.x = Math.sin(p.ragT * 6) * 1.1 * (p.grounded ? 0.3 : 1);
  p.rot.z = Math.cos(p.ragT * 5) * 0.9 * (p.grounded ? 0.3 : 1);
}

function updatePlayerInVehicle(dt, inp) {
  const v = p.inVeh;
  const steer = -inp.right; // D = rechts
  updateVehicle(v, dt, inp.fwd, steer);
  p.x = v.x; p.z = v.z; p.y = v.water ? 0.05 : 0;
  if (inp.sprint) { /* Turbo-Taste ist beim Fahren nicht belegt */ }
}

function enterVehicle(v) {
  if (v.occupied) return;
  ensureAudio();
  p.inVeh = v;
  v.occupied = true;
  p.state = 'vehicle';
  p.carry = null;
  sfx('ok');
  toast(`${v.name} – Steuerung: W/S, A/D`);
}
function exitVehicle() {
  const v = p.inVeh;
  if (!v) return;
  const rx = Math.cos(v.h), rz = -Math.sin(v.h);
  p.x = v.x + rx * 2.2;
  p.z = v.z + rz * 2.2;
  p.y = v.water ? SEA_FLOOR * 0.2 : 0;
  if (v.water) p.y = SEA_FLOOR;
  p.vx = p.vz = p.vy = 0;
  v.occupied = false;
  v.speed = 0;
  p.inVeh = null;
  p.state = 'walk';
  p.grounded = !v.water;
  sfx('ok');
}

/* Gegenstände */
function pickProp(pr) {
  if (p.carry) return;
  pr.held = true;
  p.carry = pr;
  sfx('ok');
}
function dropProp() {
  const pr = p.carry;
  if (!pr) return;
  pr.held = false;
  pr.vx = Math.sin(p.h) * 1.5; pr.vz = Math.cos(p.h) * 1.5; pr.vy = 0;
  p.carry = null;
}
function throwProp() {
  const pr = p.carry;
  if (!pr) return;
  const dir = new T.Vector3().subVectors(cameraTarget, camera.position).normalize();
  pr.held = false;
  pr.vx = dir.x * 14; pr.vy = dir.y * 14 + 3; pr.vz = dir.z * 14;
  p.carry = null;
  sfx('jump');
}
function updateProps(dt) {
  for (const pr of props) {
    if (pr.held) {
      // Festgehalten: keine Physik, keine Kollision mit dem eigenen Charakter
      pr.x = p.x + Math.sin(p.h) * 0.9;
      pr.z = p.z + Math.cos(p.h) * 0.9;
      pr.y = p.y + 1.1;
      pr.vx = pr.vy = pr.vz = 0;
      pr.box.top = -10;
    } else {
      pr.vy -= GRAV * dt;
      const fr = Math.exp(-dt * (pr.grounded ? 5 : 0.3));
      pr.vx *= fr; pr.vz *= fr;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      for (const b of colliders.city) {
        if (b === pr.box || b.top <= pr.y + 0.1) continue;
        const pen = pushOutOfBox(pr, pr.r, b);
        if (pen) { pr.x += pen.nx; pr.z += pen.nz; pr.vx *= 0.6; pr.vz *= 0.6; }
      }
      const f = floorAt('city', pr.x, pr.z, pr.y, pr.r, pr.box);
      if (pr.y <= f) {
        if (pr.vy < -4) pr.vy = -pr.vy * 0.3; else pr.vy = 0;
        pr.y = f; pr.grounded = true;
      } else pr.grounded = false;
      if (pr.y < -20) { pr.x = 0; pr.z = 0; pr.y = 3; }
    }
    pr.box.minX = pr.x - pr.r; pr.box.maxX = pr.x + pr.r;
    pr.box.minZ = pr.z - pr.r; pr.box.maxZ = pr.z + pr.r;
    if (!pr.held) pr.box.top = pr.y + pr.size;
    pr.mesh.position.set(pr.x, pr.y + pr.size / 2, pr.z);
  }
}

/* ============================================================
 * 10. Fußgänger, Verkehr, Münzen
 * ============================================================ */
function updatePeds(dt) {
  const night = nightFactor > 0.5;
  for (const pe of peds) {
    pe.s += pe.speed * dt;
    const a = perimPoint(PED_R, pe.s);
    pe.ch.group.position.set(pe.cx + a.x, 0, pe.cz + a.z);
    pe.ch.group.rotation.y = Math.atan2(a.dx, a.dz);
    pe.ch.group.visible = !(night && pe.id % 2 === 0);
    poseCharacter(pe.ch, dt, pe.speed, true, false, false);
  }
}
function updateTraffic(dt) {
  for (const t of traffic) {
    t.s += t.speed * dt;
    const a = perimPoint(t.h, t.s);
    const ox = a.dz * 2.5, oz = -a.dx * 2.5;
    t.x = a.x + ox; t.z = a.z + oz;
    t.heading = Math.atan2(a.dx, a.dz);
    t.mesh.group.position.set(t.x, 0, t.z);
    t.mesh.group.rotation.y = t.heading;
    for (const w of t.mesh.wheels) w.g.rotation.x += (t.speed * dt) / w.r;
    t.mesh.group.visible = zone === 'city';
  }
}

function updateCoins(dt) {
  for (const c of coins) {
    if (!c.mesh) continue;
    c.mesh.rotation.z += dt * 2.2;
    if (S.coinsTaken.includes(c.id)) { c.mesh.visible = false; continue; }
    c.mesh.visible = zone === 'city';
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < 1.6 && Math.abs(c.y - (p.y + 1)) < 2.5 && zone === 'city') {
      S.coinsTaken.push(c.id);
      S.coins++;
      S.money += c.bonus;
      sfx('coin');
      toast(c.secret ? `Geheime Belohnung: +${c.bonus} €` : `Münze +${c.bonus} €`);
      c.mesh.visible = false;
    }
  }
}

/* ============================================================
 * 11. Interaktionen (E / Aktion)
 * ============================================================ */
function buildInteractables() {
  const jc = doors.jobcenter, dp = doors.depot, sh = doors.shop, dl = doors.dealer, pz = doors.pizza, hs = doors.house;
  interactables.push({ zone: 'city', x: jc.x, z: jc.z, r: 3, label: () => 'Jobcenter betreten', act: openJobMenu });
  interactables.push({ zone: 'city', x: sh.x, z: sh.z, r: 3, label: () => 'Kleiderladen betreten', act: () => enterInterior('shop') });
  interactables.push({ zone: 'city', x: dl.x, z: dl.z, r: 3, label: () => 'Autohaus betreten', act: openDealerMenu });
  interactables.push({
    zone: 'city', x: hs.x, z: hs.z, r: 3,
    label: () => (S.house ? 'Haus betreten' : `Haus kaufen (${fmtEur(HOUSE_PRICE)})`),
    act: () => (S.house ? enterInterior('house') : openHouseMenu()),
  });
  interactables.push({ zone: 'city', x: dp.x, z: dp.z, r: 3, label: () => 'Depot', act: () => toast('Paket-Depot: Auftrag im Jobcenter starten'), show: () => false });
  interactables.push({ zone: 'city', x: pz.x, z: pz.z, r: 3, label: () => 'Pizzeria', act: () => toast('Pizzeria: Auftrag im Jobcenter starten'), show: () => false });
  // Interieur-Ausgänge und Aktionen werden in buildInterior() ergänzt
}

function computePrompt() {
  const cands = [];
  if (p.inVeh) {
    cands.push({ d: 0, label: `Aussteigen (${p.inVeh.name})`, act: exitVehicle });
  } else {
    if (p.carry) cands.push({ d: 0, label: 'Ablegen', act: dropProp });
    if (zone === 'city') {
      for (const v of vehicles) {
        if (v.occupied) continue;
        const d = dist2(p, v);
        if (d < 3.4) cands.push({ d, label: `Einsteigen: ${v.name}`, act: () => enterVehicle(v) });
      }
      if (!p.carry) {
        for (const pr of props) {
          if (pr.held) continue;
          const d = Math.hypot(pr.x - p.x, pr.z - p.z);
          if (d < 2.2) cands.push({ d, label: pr.isBall ? 'Ball aufheben' : 'Kiste aufheben', act: () => pickProp(pr) });
        }
      }
    }
  }
  for (const it of interactables) {
    if (it.zone !== zone) continue;
    if (it.show && !it.show()) continue;
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (d < it.r) cands.push({ d, label: it.label(), act: it.act });
  }
  if (job && job.obj && job.obj.mode === 'press' && zone === 'city') {
    const d = Math.hypot(job.obj.x - p.x, job.obj.z - p.z);
    if (d < job.obj.r) cands.push({ d, label: job.obj.label, act: job.obj.onDone });
  }
  cands.sort((a, b) => a.d - b.d);
  return cands[0] || null;
}

/* ============================================================
 * 12. Jobs, Rennen, Missionen
 * ============================================================ */
const JOB_NAMES = { paket: 'Paketzusteller', taxi: 'Taxifahrer', pizza: 'Pizzalieferant', rennen: 'Rennen' };

function spawnJobVehicle(type, x, z, h, color) {
  const v = makeVehicle(type, color, x, z, h, false, { job: true });
  return v;
}
function addrObj(label, onDone, r) {
  const s = randomSpot();
  return { x: s.x, z: s.z, r: r || 4, mode: 'press', label, onDone };
}
function startJob(kind) {
  if (job) { toast('Du hast bereits einen Auftrag.'); return; }
  closeMenu();
  if (kind === 'paket') {
    job = { kind, total: 4, done: 0, pay: 55, bonus: 40 };
    jobPaketPickup();
  } else if (kind === 'taxi') {
    job = { kind, total: 3, done: 0, vehicle: spawnJobVehicle('taxi', -14, -12, Math.PI / 2, 0xf5c518) };
    taxiPassenger();
  } else if (kind === 'pizza') {
    job = { kind, total: 3, done: 0, pay: 35, vehicle: spawnJobVehicle('scooter', 96, 40, 0, 0xff7a00) };
    pizzaPickup();
  } else if (kind === 'rennen') {
    const g0 = raceGates()[0];
    job = { kind, total: 8, done: 0, gates: raceGates(), t0: 0, started: false, vehicle: spawnJobVehicle('racer', g0.x, g0.z, g0.h, 0xdc2626) };
    setRaceObj();
  }
  sfx('ok');
  updateHud();
}
function jobPaketPickup() {
  const d = doors.depot;
  job.obj = { x: d.x, z: d.z, r: 4, mode: 'press', label: 'Paket abholen', onDone: () => {
    job.obj = addrObj('Paket zustellen', () => {
      S.money += job.pay; S.stats.pkg++; job.done++;
      sfx('coin'); toast(`+${job.pay} € Paket zugestellt`);
      if (job.done >= job.total) finishJob(`Auftrag beendet – Bonus ${job.bonus} €`, true, job.bonus);
      else jobPaketPickup();
    });
  } };
}
function taxiPassenger() {
  const from = randomSpot();
  job.obj = { x: from.x, z: from.z, r: 4, mode: 'press', label: 'Fahrgast einsteigen lassen', onDone: () => {
    const to = randomSpot();
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    job.obj = { x: to.x, z: to.z, r: 7, mode: 'enter', label: 'Fahrgast ans Ziel bringen', onDone: () => {
      const pay = Math.round(len * 0.9 + 12);
      S.money += pay; S.stats.rides++; job.done++;
      sfx('coin'); toast(`Fahrt beendet: +${pay} €`);
      if (job.done >= job.total) finishJob('Alle Fahrten erledigt', true, 0);
      else taxiPassenger();
    } };
  } };
}
function pizzaPickup() {
  const d = doors.pizza;
  job.obj = { x: d.x, z: d.z, r: 4, mode: 'press', label: 'Pizza abholen', onDone: () => pizzaDeliver() };
}
function pizzaDeliver() {
  const s = randomSpot();
  const limit = 100;
  job.obj = { x: s.x, z: s.z, r: 5, mode: 'enter', label: `Pizza liefern (${job.done + 1}/${job.total})`,
    deadline: elapsed + limit, onDone: () => {
      const left = Math.max(0, job.obj.deadline - elapsed);
      const tip = Math.round(left / 4);
      S.money += job.pay + tip; job.done++;
      sfx('coin'); toast(`Pizza geliefert: +${job.pay + tip} € (Trinkgeld ${tip} €)`);
      if (job.done >= job.total) finishJob('Alle Pizzen geliefert', true, 0);
      else pizzaPickup();
    } };
}
function raceGates() {
  const gates = [];
  for (let i = 0; i < 8; i++) {
    const a = perimPoint(RING_R, i * (8 * RING_R) / 8);
    gates.push({ x: a.x, z: a.z, h: Math.atan2(a.dx, a.dz) });
  }
  return gates;
}
function setRaceObj() {
  const g = job.gates[job.done % 8];
  job.obj = { x: g.x, z: g.z, r: 7, mode: 'vehicle', label: `Tor ${job.done + 1}/8`, onDone: () => {
    if (!job.started) { job.started = true; job.t0 = elapsed; }
    job.done++;
    if (job.done >= job.total) {
      const time = elapsed - job.t0;
      const bonus = time < 75 ? 120 : 0;
      S.money += 150 + bonus; S.stats.laps++;
      if (!S.bestLap || time < S.bestLap) S.bestLap = time;
      finishJob(`Runde geschafft in ${time.toFixed(1)} s`, true, 150 + bonus);
    } else setRaceObj();
  } };
}
function finishJob(msg, ok, bonus) {
  if (job && job.vehicle) {
    if (p.inVeh === job.vehicle) exitVehicle();
    removeVehicle(job.vehicle);
  }
  // Paket-Bonus wird hier ausgezahlt; die übrigen Jobs zahlen beim Abschluss selbst
  if (ok && bonus && job && job.kind === 'paket') S.money += bonus;
  job = null;
  sfx(ok ? 'ok' : 'fail');
  toast(msg);
  autosave();
  updateHud();
}
function updateJob(dt) {
  if (!job || !job.obj) return;
  const o = job.obj;
  if (o.deadline && elapsed > o.deadline) { finishJob('Zu spät – Auftrag gescheitert', false); return; }
  const d = Math.hypot(o.x - p.x, o.z - p.z);
  if (zone !== 'city') return;
  if (o.mode === 'enter' && d < o.r) o.onDone();
  else if (o.mode === 'vehicle' && p.inVeh && d < o.r) o.onDone();
}

/* ============================================================
 * 13. Menüs und Kaufen
 * ============================================================ */
function openJobMenu() {
  const items = [
    { label: 'Paketzusteller', sub: `4 Pakete · je 55 € · Bonus 40 €`, onClick: () => startJob('paket') },
    { label: 'Taxifahrer', sub: '3 Fahrten · Entfernung bestimmt den Lohn', onClick: () => startJob('taxi') },
    { label: 'Pizzalieferant', sub: '3 Lieferungen unter Zeitdruck · Trinkgeld', onClick: () => startJob('pizza') },
    { label: 'Rennen', sub: '8 Tore auf der Ringstraße · Bonus unter 75 s', onClick: () => startJob('rennen') },
  ];
  if (job) items.unshift({ label: `Auftrag läuft: ${JOB_NAMES[job.kind]}`, sub: 'Aktiver Auftrag wird unten abgebrochen', disabled: true });
  if (job) items.push({ label: 'Auftrag abbrechen', sub: 'Keine Auszahlung', onClick: () => finishJob('Auftrag abgebrochen', false) });
  openMenu('Jobcenter', items);
}
function openDealerMenu() {
  const items = Object.keys(VEH).filter((k) => VEH[k].price).map((k) => {
    const sp = VEH[k];
    const owned = vehicles.filter((v) => v.owned && v.type === k).length;
    return {
      label: sp.name, sub: `${fmtEur(sp.price)}${owned ? ' · ' + owned + ' in deinem Besitz' : ''}`,
      onClick: () => purchase(sp.price, () => buyVehicle(k)),
    };
  });
  openMenu('Autohaus', items);
}
function buyVehicle(type) {
  const dealerDoor = doors.dealer;
  if (type === 'boat') {
    makeVehicle('boat', 0xf97316, SEA_X + 4, (Math.random() - 0.5) * 16, Math.PI / 2, true);
  } else {
    makeVehicle(type, VEH[type].body === 'car' ? 0x22c55e : 0x111827, dealerDoor.x + 14, dealerDoor.z + 16, 0, true);
  }
  toast(`${VEH[type].name} gekauft – steht bereit`);
}
function purchase(price, fn) {
  if (S.money < price) { sfx('fail'); toast('Nicht genug Geld'); return; }
  S.money -= price;
  sfx('ok');
  fn();
  updateHud();
  autosave();
}
function openClothesMenu() {
  const items = OUTFITS.map((o) => {
    const owned = S.clothes.includes(o.id);
    const equipped = S.outfit === o.id;
    return {
      label: o.name + (equipped ? ' (angezogen)' : ''),
      sub: owned ? 'Im Besitz – tippe zum Anziehen' : fmtEur(o.price),
      onClick: () => {
        if (owned) { setCharacterOutfit(o.id); toast(`${o.name} angezogen`); autosave(); closeMenu(); return; }
        purchase(o.price, () => { S.clothes.push(o.id); setCharacterOutfit(o.id); toast(`${o.name} gekauft und angezogen`); });
        closeMenu();
      },
    };
  });
  openMenu('Kleiderladen', items);
}
function openHouseMenu() {
  openMenu('Haus am Park', [
    { label: `Kaufen für ${fmtEur(HOUSE_PRICE)}`, sub: 'Dein Zuhause mit Bett, Sofa und Küche', onClick: () => purchase(HOUSE_PRICE, () => { S.house = true; toast('Haus gekauft!'); closeMenu(); }) },
    { label: 'Abbrechen', sub: '', onClick: closeMenu },
  ]);
}
function sleepAndSave() {
  clock.day++;
  clock.min = 6.5 * 60;
  autosave();
  toast('Guten Morgen – Spiel gespeichert');
  sfx('ok');
}

let menuItems = [];
function openMenu(title, items) {
  menuItems = items;
  setScreen('menu');
  document.getElementById('menu-title').textContent = title;
  const list = document.getElementById('menu-list');
  list.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'item' + (it.disabled ? ' disabled' : '');
    b.disabled = !!it.disabled;
    const t = document.createElement('span');
    t.className = 'it-label';
    t.textContent = it.label;
    const s = document.createElement('span');
    s.className = 'it-sub';
    s.textContent = it.sub || '';
    b.append(t, s);
    b.addEventListener('click', () => { sfx('ui'); if (it.onClick) it.onClick(); });
    list.appendChild(b);
  }
}
function closeMenu() {
  setScreen('play');
}

/* ============================================================
 * 14. Speichern und Laden
 * ============================================================ */
function collectSave() {
  let px = p.x, pz = p.z;
  if (zone !== 'city') { px = p.exitX; pz = p.exitZ; }
  return {
    v: 1,
    money: S.money, coins: S.coins, coinsTaken: S.coinsTaken.slice(),
    clothes: S.clothes.slice(), outfit: S.outfit, house: S.house, stats: S.stats, bestLap: S.bestLap,
    clock: { min: clock.min, day: clock.day },
    weather: weather.name,
    player: { x: px, z: pz, h: p.h, y: p.y, inVeh: p.inVeh ? vehicles.indexOf(p.inVeh) : -1 },
    vehicles: vehicles.filter((v) => !v.job).map((v) => ({ type: v.type, x: v.x, z: v.z, h: v.h, owned: v.owned, color: v.color })),
    props: props.map((pr) => ({ x: pr.x, y: pr.y, z: pr.z })),
  };
}
function autosave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(collectSave())); } catch (e) { /* kein Speicher */ }
  refreshContinue();
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
function loadSave() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
  if (!d || d.v !== 1) return false;
  resetWorld();
  S.money = d.money; S.coins = d.coins; S.coinsTaken = d.coinsTaken || [];
  S.clothes = d.clothes || ['basic']; S.house = !!d.house;
  S.stats = d.stats || S.stats; S.bestLap = d.bestLap ?? null;
  clock.min = d.clock.min; clock.day = d.clock.day;
  weather.name = d.weather || 'klar';
  setCharacterOutfit(d.outfit || 'basic');
  for (const v of vehicles.slice()) removeVehicle(v);
  for (const vd of d.vehicles || []) {
    makeVehicle(vd.type, vd.color, vd.x, vd.z, vd.h, vd.owned);
  }
  (d.props || []).forEach((pp, i) => { if (props[i]) { props[i].x = pp.x; props[i].y = pp.y; props[i].z = pp.z; props[i].vx = props[i].vy = props[i].vz = 0; } });
  p.x = d.player.x; p.z = d.player.z; p.y = d.player.y || 0; p.h = d.player.h || 0;
  p.vx = p.vy = p.vz = 0; p.inVeh = null; p.state = 'walk'; p.carry = null;
  setZone('city');
  return true;
}
function resetWorld() {
  if (job) { if (job.vehicle) removeVehicle(job.vehicle); job = null; }
  for (const v of vehicles.slice()) if (v.job) removeVehicle(v);
  for (const v of vehicles.slice()) removeVehicle(v);
  for (const v of defaultVehicles) makeVehicle(v.type, v.color, v.x, v.z, v.h, false);
  props.forEach((pr, i) => { const s = propSpawn[i]; pr.x = s.x; pr.y = s.y; pr.z = s.z; pr.vx = pr.vy = pr.vz = 0; pr.held = false; });
  p.carry = null; p.inVeh = null;
}
function newGame() {
  S.money = 250; S.coins = 0; S.coinsTaken = []; S.clothes = ['basic']; S.house = false;
  S.stats = { pkg: 0, rides: 0, laps: 0 }; S.bestLap = null;
  clock.min = 7 * 60; clock.day = 1; weather.name = 'klar'; weather.timer = 90;
  resetWorld();
  setCharacterOutfit('basic');
  p.x = 0; p.z = 12; p.y = 0; p.h = 0; p.vx = p.vz = p.vy = 0;
  setZone('city');
  // alte Speicherung überschreiben
  autosave();
  startPlay();
}

/* ============================================================
 * 15. Wetter, Tag und Nacht
 * ============================================================ */
let nightFactor = 0;
const rainCount = 900;
const rainPos = new Float32Array(rainCount * 6);
const rainGeo = new T.BufferGeometry();
rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
const rainMesh = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xbfd7ff, transparent: true, opacity: 0.55 }));
rainMesh.frustumCulled = false;
rainMesh.visible = false;
scene.add(rainMesh);
function resetRainDrop(i) {
  const x = (Math.random() - 0.5) * 70, y = Math.random() * 30, z = (Math.random() - 0.5) * 70;
  const o = i * 6;
  rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z;
  rainPos[o + 3] = x; rainPos[o + 4] = y + 0.7; rainPos[o + 5] = z;
}
for (let i = 0; i < rainCount; i++) resetRainDrop(i);
function updateRain(dt) {
  rainMesh.visible = weather.name === 'Regen' && zone === 'city';
  if (!rainMesh.visible) return;
  rainMesh.position.set(cameraTarget.x, cameraTarget.y - 12, cameraTarget.z);
  for (let i = 0; i < rainCount; i++) {
    const o = i * 6;
    rainPos[o + 1] -= 26 * dt; rainPos[o + 4] = rainPos[o + 1] + 0.7;
    if (rainPos[o + 1] < -2) resetRainDrop(i);
  }
  rainGeo.attributes.position.needsUpdate = true;
}
const WEATHER = {
  klar:      { cloud: 0,    fog: 0.0028, weight: 5 },
  bewölkt:   { cloud: 0.35, fog: 0.0042, weight: 3 },
  Regen:     { cloud: 0.6,  fog: 0.0065, weight: 2 },
};
function updateWeather(dt) {
  weather.timer -= dt;
  if (weather.timer <= 0) {
    const names = Object.keys(WEATHER);
    const total = names.reduce((s, n) => s + WEATHER[n].weight, 0);
    let r = Math.random() * total;
    let pick = names[0];
    for (const n of names) { r -= WEATHER[n].weight; if (r <= 0) { pick = n; break; } }
    if (pick === 'bewölkt' && weather.name === 'Regen') pick = 'bewölkt';
    weather.name = pick;
    weather.timer = 60 + Math.random() * 60;
    updateHud();
  }
  const tgt = WEATHER[weather.name] || WEATHER.klar;
  weather.cloud += (tgt.cloud - weather.cloud) * Math.min(1, dt * 0.5);
  weather.fog += (tgt.fog - weather.fog) * Math.min(1, dt * 0.5);
}
function updateSky() {
  const tn = clock.min / 1440;
  const a = (tn - 0.25) * Math.PI * 2;
  const sinA = Math.sin(a), cosA = Math.cos(a);
  const day = smooth(-0.15, 0.2, sinA);
  const dusk = Math.exp(-sinA * sinA * 25);
  nightFactor = 1 - smooth(-0.05, 0.25, sinA);

  const base = SKY_NIGHT.clone().lerp(SKY_DAY, day);
  base.lerp(SKY_DUSK, dusk * 0.7);
  base.lerp(SKY_GREY, weather.cloud * 0.8);
  skyNow.copy(base);
  if (zone === 'city') {
    scene.background.copy(base);
    scene.fog.color.copy(base);
    scene.fog.density = weather.fog;
  }

  const dir = new T.Vector3(cosA * 0.6, sinA, 0.35).normalize();
  sun.position.copy(cameraTarget).addScaledVector(dir, 160);
  sun.target.position.copy(cameraTarget);
  sun.intensity = 2.4 * day * (1 - weather.cloud * 0.7);
  sun.color.setRGB(1, 0.95 - dusk * 0.25, 0.9 - dusk * 0.4);
  hemi.intensity = 0.28 + 0.75 * day - weather.cloud * 0.2;
  for (const m of facadeMats) m.emissiveIntensity = nightFactor * 0.9;
  lampMat.emissiveIntensity = nightFactor * 2.4;
  sun.castShadow = SETTINGS.quality === 'hoch';
  const interiorBright = zone !== 'city';
  for (const l of interiorLights) l.intensity = interiorBright ? 30 : 0;
}
function clockText() {
  const h = Math.floor(clock.min / 60) % 24;
  const m = Math.floor(clock.min % 60);
  return `Tag ${clock.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ============================================================
 * 16. Kamera und Eingabe
 * ============================================================ */
const cameraTarget = new T.Vector3();
function updateCamera() {
  const focusY = p.inVeh ? 1.3 : 1.6;
  cameraTarget.set(p.x, p.y + focusY, p.z);
  const cp = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(
    cameraTarget.x + Math.sin(cam.yaw) * cp,
    cameraTarget.y + Math.sin(cam.pitch) * cam.dist + 0.2,
    cameraTarget.z + Math.cos(cam.yaw) * cp
  );
  camera.lookAt(cameraTarget);
}

function readInput() {
  let kf = 0, kr = 0;
  if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) kf += 1;
  if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) kf -= 1;
  if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) kr += 1;
  if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) kr -= 1;
  input.fwd = clamp(kf - input.joyY, -1, 1);
  input.right = clamp(kr + input.joyX, -1, 1);
  input.sprint = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') || input.touchSprint;
}

const sens = () => SETTINGS.sens;
function setupInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keysDown.add(e.code);
    if (e.code === 'Space') { input.jumpQ = true; e.preventDefault(); }
    if (e.code === 'KeyE') input.actQ = true;
    if (e.code === 'Escape') {
      if (screen === 'play') openPause();
      else if (screen === 'pause') resumePlay();
      else if (screen === 'menu') closeMenu();
      else if (screen === 'settings') closeSettings();
    }
  });
  window.addEventListener('keyup', (e) => keysDown.delete(e.code));
  window.addEventListener('blur', () => keysDown.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && screen === 'play') {
      if (!document.pointerLockElement && !isTouch) canvas.requestPointerLock && canvas.requestPointerLock();
      if (p.carry) input.throwQ = true;
      else if (p.inVeh) sfx('horn');
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (screen !== 'play' && screen !== 'pause' && screen !== 'menu') return;
    if (document.pointerLockElement || (e.buttons & 2)) {
      cam.yaw -= e.movementX * 0.0035 * sens();
      const sgn = SETTINGS.invertY ? -1 : 1;
      cam.pitch = clamp(cam.pitch + e.movementY * 0.0030 * sens() * sgn, -0.15, 1.25);
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist + e.deltaY * 0.01, 3, 14); }, { passive: true });

  // Touch: Joystick, Kamera-Ziehen, Buttons
  const joy = document.getElementById('joy');
  const knob = document.getElementById('joy-knob');
  let joyId = null, joyCx = 0, joyCy = 0;
  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect();
    joyCx = r.left + r.width / 2; joyCy = r.top + r.height / 2;
    moveJoy(e);
  });
  const moveJoy = (e) => {
    const r = joy.getBoundingClientRect();
    const max = r.width / 2 - 20;
    let dx = e.clientX - joyCx, dy = e.clientY - joyCy;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.joyX = dx / max;
    input.joyY = dy / max;
    input.touchSprint = Math.hypot(input.joyX, input.joyY) > 0.92;
  };
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; input.joyX = 0; input.joyY = 0; input.touchSprint = false;
    knob.style.transform = 'translate(0,0)';
  };
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  let lookId = null, lx = 0, ly = 0;
  document.addEventListener('pointerdown', (e) => {
    if (screen !== 'play' || e.pointerType === 'mouse' || e.target.closest('button, #joy')) return;
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    cam.yaw -= (e.clientX - lx) * 0.006 * sens();
    cam.pitch = clamp(cam.pitch + (e.clientY - ly) * 0.005 * sens() * (SETTINGS.invertY ? -1 : 1), -0.15, 1.25);
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('pointerup', (e) => { if (e.pointerId === lookId) lookId = null; });
  window.addEventListener('pointercancel', (e) => { if (e.pointerId === lookId) lookId = null; });
  const tap = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
  };
  tap('t-jump', () => { input.jumpQ = true; });
  tap('t-act', () => { input.actQ = true; });
  tap('t-throw', () => { if (p.carry) input.throwQ = true; else if (p.inVeh) sfx('horn'); });
  document.getElementById('t-full').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    toggleFullscreen();
  });
  document.getElementById('btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (screen === 'play') openPause(); });
}
function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
    else (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  } catch (e) { /* nicht verfügbar */ }
}
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* ============================================================
 * 17. Audio (synthetisch, ohne Dateien)
 * ============================================================ */
let audioCtx = null, masterGain = null, engineOsc = null, engineGain = null, noiseBuf = null;
function ensureAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = SETTINGS.volume * 0.5;
    masterGain.connect(audioCtx.destination);
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(masterGain);
    engineOsc.start();
  } catch (e) { audioCtx = null; }
}
function tone(freq, dur, type, vol, slideTo) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur, vol) {
  if (!audioCtx) return;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  src.connect(g); g.connect(masterGain);
  src.start(); src.stop(audioCtx.currentTime + dur + 0.02);
}
function sfx(name) {
  if (!audioCtx) return;
  switch (name) {
    case 'jump': tone(300, 0.15, 'square', 0.05, 600); break;
    case 'land': tone(120, 0.12, 'sine', 0.2, 60); break;
    case 'coin': tone(880, 0.1, 'triangle', 0.15); setTimeout(() => tone(1320, 0.15, 'triangle', 0.12), 80); break;
    case 'crash': noiseBurst(0.35, 0.5); break;
    case 'horn': tone(420, 0.35, 'sawtooth', 0.07); tone(500, 0.35, 'sawtooth', 0.05); break;
    case 'ok': tone(660, 0.12, 'triangle', 0.15); setTimeout(() => tone(990, 0.2, 'triangle', 0.15), 100); break;
    case 'fail': tone(220, 0.3, 'sawtooth', 0.1, 110); break;
    case 'ui': tone(520, 0.05, 'square', 0.04); break;
    default: break;
  }
}
function updateEngine(dt) {
  if (!audioCtx || !engineGain) return;
  const v = p.inVeh;
  const target = v && (v.type !== 'bike') ? 0.035 * SETTINGS.volume * 2 : 0;
  engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 6);
  if (v) engineOsc.frequency.value = 45 + Math.abs(v.speed) * 6;
}

/* ============================================================
 * 18. HUD, Hinweise, Bildschirme
 * ============================================================ */
const el = (id) => document.getElementById(id);
let toastTimer = 0;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function updateHud() {
  el('h-money').textContent = fmtEur(S.money);
  el('h-clock').textContent = clockText();
  el('h-weather').textContent = weather.name;
  if (job && job.obj) {
    const d = Math.round(Math.hypot(job.obj.x - p.x, job.obj.z - p.z));
    el('h-job').textContent = `${JOB_NAMES[job.kind]} · ${job.done}/${job.total}`;
    el('h-obj').textContent = `${job.obj.label} – ${d} m`;
  } else {
    el('h-job').textContent = '';
    el('h-obj').textContent = 'Kein Auftrag – das Jobcenter besuchen';
  }
  if (p.inVeh) {
    el('h-speed').textContent = `${p.inVeh.name} · ${Math.round(Math.abs(p.inVeh.speed) * 3.6)} km/h`;
  } else if (p.state === 'ragdoll') {
    el('h-speed').textContent = 'Umgefallen …';
  } else {
    el('h-speed').textContent = p.swim ? 'Schwimmen' : p.climb ? 'Klettern' : p.carry ? 'Trägt etwas' : '';
  }
}
function setPrompt(c) {
  const pr = el('h-prompt');
  if (!c) { pr.textContent = ''; pr.dataset.live = ''; return; }
  pr.textContent = `E · ${c.label}`;
}
let lastPromptAct = null;
function setScreen(name) {
  screen = name;
  const show = (id, on) => el(id).classList.toggle('hidden', !on);
  show('screen-title', name === 'title');
  show('screen-settings', name === 'settings');
  show('menu', name === 'menu');
  show('pause', name === 'pause');
  show('hud', name === 'play' || name === 'pause' || name === 'menu');
  if (name === 'play') document.getElementById('h-prompt').classList.remove('hidden');
  if (name !== 'play') { if (document.pointerLockElement) document.exitPointerLock(); }
  el('touch').classList.toggle('hidden', !(isTouch && (name === 'play' || name === 'pause' || name === 'menu')));
  el('crosshair').classList.toggle('hidden', isTouch || name !== 'play');
}
function refreshContinue() {
  const has = hasSave();
  el('b-continue').disabled = !has;
  el('title-info').textContent = has ? 'Gespeicherte Fortschritt vorhanden' : 'Noch kein Spielstand';
}
function startPlay() {
  ensureAudio();
  setScreen('play');
  updateHud();
}
function openPause() {
  setScreen('pause');
}
function resumePlay() {
  setScreen('play');
}
function openSettings(from) {
  settingsFrom = from;
  setScreen('settings');
  el('s-vol').value = SETTINGS.volume;
  el('s-sens').value = SETTINGS.sens;
  el('s-invert').checked = !!SETTINGS.invertY;
  el('s-quality').value = SETTINGS.quality;
}
function closeSettings() {
  setScreen(settingsFrom === 'pause' ? 'pause' : 'title');
}
function applySettings() {
  storeJSON(SET_KEY, SETTINGS);
  if (masterGain) masterGain.gain.value = SETTINGS.volume * 0.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SETTINGS.quality === 'hoch' ? 2 : 1));
  renderer.shadowMap.enabled = SETTINGS.quality === 'hoch';
  sun.castShadow = SETTINGS.quality === 'hoch';
}

/* Menü-Schaltflächen */
el('b-start').addEventListener('click', () => { ensureAudio(); newGame(); });
el('b-continue').addEventListener('click', () => {
  ensureAudio();
  if (!loadSave()) { toast('Kein gültiger Spielstand'); refreshContinue(); return; }
  startPlay();
  toast('Spielstand geladen');
});
el('b-settings').addEventListener('click', () => openSettings('title'));
el('s-back').addEventListener('click', () => closeSettings());
el('s-vol').addEventListener('input', (e) => { SETTINGS.volume = +e.target.value; applySettings(); });
el('s-sens').addEventListener('input', (e) => { SETTINGS.sens = +e.target.value; applySettings(); });
el('s-invert').addEventListener('change', (e) => { SETTINGS.invertY = e.target.checked; applySettings(); });
el('s-quality').addEventListener('change', (e) => { SETTINGS.quality = e.target.value; applySettings(); });
el('menu-close').addEventListener('click', () => closeMenu());
el('p-resume').addEventListener('click', () => resumePlay());
el('p-save').addEventListener('click', () => { autosave(); toast('Spiel gespeichert'); });
el('p-settings').addEventListener('click', () => openSettings('pause'));
el('p-abort').addEventListener('click', () => { if (job) finishJob('Auftrag abgebrochen', false); else toast('Kein Auftrag aktiv'); resumePlay(); });
el('p-title').addEventListener('click', () => { autosave(); setScreen('title'); refreshContinue(); });

/* ============================================================
 * 19. Haupt-Schleife
 * ============================================================ */
let lastT = performance.now();
let cityBuilt = false;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  readInput();

  if (screen === 'play') {
    elapsed += dt;
    clock.min += dt * CLOCK_SPEED;
    if (clock.min >= 1440) { clock.min -= 1440; clock.day++; }
    updateWeather(dt);
    // Eingaben für Fahrzeug / Fuß
    if (p.inVeh) {
      updatePlayerInVehicle(dt, input);
    } else if (p.state === 'ragdoll') {
      updateRagdoll(dt);
    } else {
      updatePlayerOnFoot(dt, input);
    }
    // Aktionen
    if (input.actQ) {
      input.actQ = false;
      const c = computePrompt();
      if (c) c.act();
      else sfx('ui');
    }
    if (input.jumpQ) {
      input.jumpQ = false;
    }
    if (input.throwQ) {
      input.throwQ = false;
      throwProp();
    }
    // Welt
    updateProps(dt);
    updatePeds(dt);
    updateTraffic(dt);
    updateCoins(dt);
    updateJob(dt);
    for (const v of vehicles) {
      if (!v.occupied && (Math.abs(v.speed) > 0.01 || v.water)) updateVehicle(v, dt, 0, 0);
    }
    updateEngine(dt);
    // Autosave alle 45 s
    autosaveTimer += dt;
    if (autosaveTimer > 45) { autosaveTimer = 0; autosave(); }
    updateHud();
    setPrompt(computePrompt());
    updateRain(dt);
  } else {
    // Im Menü: Welt bleibt sichtbar, Eingaben ruhen
    input.jumpQ = false; input.actQ = false; input.throwQ = false;
    updateEngine(dt);
  }

  // Kamera und Licht in jedem Frame
  p.ch.group.visible = !p.inVeh;
  p.ch.group.position.set(p.x, p.y, p.z);
  p.ch.group.rotation.set(p.state === 'ragdoll' ? p.rot.x : 0, p.h, p.state === 'ragdoll' ? p.rot.z : 0);
  if (p.state !== 'ragdoll') poseCharacter(p.ch, dt, Math.hypot(p.vx, p.vz), p.grounded, !!p.carry, p.swim);
  updateCamera();
  updateSky();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ============================================================
 * 20. Start
 * ============================================================ */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function boot() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SETTINGS.quality === 'hoch' ? 2 : 1));
  renderer.shadowMap.enabled = SETTINGS.quality === 'hoch';
  sun.castShadow = SETTINGS.quality === 'hoch';
  buildCity();
  buildCoins();
  buildProps();
  buildPeds();
  buildTraffic();
  buildInterior('house');
  buildInterior('shop');
  buildInteractables();
  defaultVehicles.push({ type: 'boat', color: 0xf97316, x: SEA_X + 4, z: 0, h: Math.PI / 2, owned: false });
  defaultVehicles.push({ type: 'bike', color: 0x0ea5e9, x: 8, z: 14, h: 0.6, owned: false });
  defaultVehicles.push({ type: 'moto', color: 0x111827, x: -40, z: 135, h: 0, owned: false });
  resetWorld();
  resize();
  window.addEventListener('resize', resize);
  setupInput();
  refreshContinue();
  setScreen('title');
  el('loading').classList.add('hidden');
  // Ein Standbild rendern, damit der Hintergrund schon beim Titel sichtbar ist
  updateCamera();
  updateSky();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
}

boot();
})();
