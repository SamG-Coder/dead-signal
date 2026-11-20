import * as T from './vendor/three.module.js';
import { blocked, extent, obstacles, createYard, createInfected, createCarbine } from './yard.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const coarsePointer = matchMedia('(pointer: coarse)').matches;
let touch = coarsePointer;
document.body.classList.toggle('touch', touch);
const keys = new Set();
const move = { x: 0, y: 0 };
const player = { x: 0, z: 9, yaw: 0, pitch: -.015 };
const magazine = 24;
const active = [];
const entrance = [[-2, -9], [4, -12], [-12, -6], [13, -3], [0, -23], [-18, 16], [20, 5], [3, 24]];
const clamp = T.MathUtils.clamp;
let best = 0;
try { best = Number(localStorage.getItem('dead-signal-best')) || 0; } catch {}
$('record').textContent = best + ' KILLS';
let state = 'menu';
let muted = false;
let audio;
let firing = false;
let aimPointer;
let stickPointer;
let firePointer;
let ready = false;
let network = [];
let timer = 0;
let sim = 0;
let health = 100;
let rounds = magazine;
let reserve = 120;
let kills = 0;
let wave = 0;
let pending = 0;
let spawnAt = 0;
let intermission = 0;
let nextShot = 0;
let reloadAt = 0;
let announceUntil = 0;
let damageUntil = 0;
let hitUntil = 0;
let flashUntil = 0;
let recoil = 0;
let bob = 0;
let currentSpeed = 0;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(61, 1, .035, 100);
camera.rotation.order = 'YXZ';
scene.add(camera);
let renderer;
let carbine;
let preview;
let introMob;
let cover;

function setView(view) {
  state = view;
  document.body.dataset.view = view;
  $('hud').inert = view !== 'game';
}

function closePanel() {
  $('overlay').hidden = true;
  $('menu').inert = false;
  $('header').inert = false;
}

function panel(label, title, content, actions) {
  $('panel-label').textContent = label;
  $('panel-title').textContent = title;
  $('panel-content').replaceChildren(content);
  $('panel-actions').replaceChildren(...actions.map(([labelText, callback], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = labelText;
    button.className = index === 0 ? 'primary' : 'outline';
    button.addEventListener('click', callback);
    return button;
  }));
  $('overlay').hidden = false;
  $('menu').inert = $('header').inert = true;
  $('panel-actions').firstElementChild.focus();
}

function paragraph(text) {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

$('controls').addEventListener('click', () => {
  const list = document.createElement('dl');
  const controls = touch
    ? [['Move', 'Drag the left joystick'], ['Aim', 'Drag the right side of the screen'], ['Fire', 'Hold FIRE'], ['Reload', 'Tap ↻'], ['Pause', 'Tap Ⅱ']]
    : [['Move', 'WASD or arrow keys'], ['Aim', 'Move the mouse, or drag if mouse capture is unavailable'], ['Fire', 'Left click or Space'], ['Reload', 'R'], ['Pause', 'Esc or P']];
  for (const [action, input] of controls) {
    const name = document.createElement('dt');
    const description = document.createElement('dd');
    name.textContent = action;
    description.textContent = input;
    list.append(name, description);
  }
  panel('FIELD MANUAL', 'Controls', list, [['BACK', () => { closePanel(); $('controls').focus(); }]]);
});

fetch('./network.json').then(response => response.json()).then(data => {
  network = data.urls;
  $('join').hidden = !network.length;
}).catch(() => {});
$('join').addEventListener('click', () => {
  const content = document.createElement('div');
  const qr = new Image();
  qr.src = './join.png';
  qr.alt = 'QR code for ' + network[0];
  qr.className = 'qr';
  content.append(paragraph('Connect your phone to the same Wi-Fi or local network as this PC and scan the code.'), qr);
  for (const url of network) {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;
    const row = document.createElement('div');
    row.append(link);
    content.append(row);
  }
  panel('LOCAL NETWORK', 'Play on phone', content, [['BACK', () => { closePanel(); $('join').focus(); }]]);
});

function unlockSound() {
  if (muted || !window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {}
}

function tone(from, to, time, volume, type = 'triangle') {
  if (!audio || muted || audio.state !== 'running') return;
  const start = audio.currentTime;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + time);
  envelope.gain.setValueAtTime(volume, start);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + time);
  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + time);
}

$('sound').addEventListener('click', () => {
  muted = !muted;
  $('sound').setAttribute('aria-pressed', String(muted));
  $('sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  unlockSound();
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 77 : 61;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? Math.max(1, 1250 / Math.max(w, h)) : 1.75));
  renderer.setSize(w, h, false);
}

function requestAim() {
  if (touch || !canvas.requestPointerLock) return;
  try { canvas.requestPointerLock()?.catch(() => {}); } catch {}
}

function releaseAim() {
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function clearInput() {
  keys.clear();
  firing = false;
  move.x = move.y = 0;
  $('stick').firstElementChild.style.transform = '';
  aimPointer = stickPointer = firePointer = undefined;
}

function updateHud() {
  $('wave').textContent = String(wave).padStart(2, '0');
  $('remaining').textContent = pending + active.length;
  $('health').textContent = Math.ceil(health);
  $('health-fill').style.width = health + '%';
  $('ammo').textContent = reloadAt ? '↻' : rounds;
  $('reserve').textContent = '/ ' + reserve;
}

function announce(message, duration) {
  $('announcement').textContent = message;
  announceUntil = sim + duration;
}

function start() {
  if (!ready) return;
  unlockSound();
  clearInput();
  closePanel();
  for (const infected of active) scene.remove(infected.group);
  active.length = 0;
  Object.assign(player, { x: 0, z: 9, yaw: 0, pitch: -.015 });
  health = 100;
  rounds = magazine;
  reserve = 120;
  wave = kills = pending = sim = recoil = bob = currentSpeed = 0;
  damageUntil = hitUntil = flashUntil = reloadAt = nextShot = 0;
  intermission = 1.65;
  preview.group.visible = false;
  introMob.group.visible = false;
  carbine.weapon.visible = true;
  setView('game');
  updateHud();
  announce('HOLD THE YARD', 1.5);
  requestAim();
}

function menu() {
  clearInput();
  closePanel();
  releaseAim();
  for (const infected of active) scene.remove(infected.group);
  active.length = 0;
  carbine.weapon.visible = false;
  preview.group.visible = true;
  introMob.group.visible = true;
  setView('menu');
  $('deploy').focus();
}

function pause() {
  if (state !== 'game') return;
  setView('pause');
  clearInput();
  releaseAim();
  panel('RUN SUSPENDED', 'Paused', paragraph('Wave ' + wave + ' · ' + kills + ' infected eliminated'), [
    ['RESUME', resume], ['MAIN MENU', menu]
  ]);
}

function resume() {
  closePanel();
  setView('game');
  unlockSound();
  requestAim();
}

function endRun() {
  setView('over');
  clearInput();
  releaseAim();
  panel('SIGNAL LOST', 'Overrun', paragraph('You reached wave ' + wave + ' and eliminated ' + kills + ' infected. Best run: ' + best + ' kills.'), [
    ['REDEPLOY', start], ['MAIN MENU', menu]
  ]);
}

$('deploy').addEventListener('click', start);
$('pause').addEventListener('click', pause);
$('reload').addEventListener('pointerdown', event => { event.preventDefault(); reload(); });

addEventListener('keydown', event => {
  if (event.code === 'Escape' && !$('overlay').hidden && state === 'menu') { closePanel(); return; }
  if (state === 'pause' && (event.code === 'KeyP' || event.code === 'Escape')) { resume(); return; }
  if (state !== 'game') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.code)) event.preventDefault();
  if (!event.repeat && (event.code === 'Escape' || event.code === 'KeyP')) { pause(); return; }
  if (event.code === 'KeyR') reload();
  keys.add(event.code);
});
addEventListener('keyup', event => keys.delete(event.code));
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) firing = false;
});

function look(dx, dy, sensitivity) {
  player.yaw -= dx * sensitivity;
  player.pitch = clamp(player.pitch - dy * sensitivity, -1.35, 1.35);
}

document.addEventListener('mousemove', event => {
  if (state === 'game' && document.pointerLockElement === canvas) look(event.movementX, event.movementY, .0023);
});
canvas.addEventListener('pointerdown', event => {
  if (state !== 'game' || touch || event.button !== 0) return;
  firing = true;
  if (document.pointerLockElement !== canvas) {
    aimPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointermove', event => {
  if (state === 'game' && aimPointer === event.pointerId && !document.pointerLockElement) look(event.movementX, event.movementY, .0034);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, () => { firing = false; aimPointer = undefined; });
}
addEventListener('pointerup', event => { if (event.pointerType === 'mouse') firing = false; });

const lookPad = $('look-pad');
let lastX = 0;
let lastY = 0;
lookPad.addEventListener('pointerdown', event => {
  if (aimPointer !== undefined) return;
  event.preventDefault();
  aimPointer = event.pointerId;
  lastX = event.clientX;
  lastY = event.clientY;
  lookPad.setPointerCapture(event.pointerId);
});
lookPad.addEventListener('pointermove', event => {
  if (aimPointer !== event.pointerId) return;
  look(event.clientX - lastX, event.clientY - lastY, .0052);
  lastX = event.clientX;
  lastY = event.clientY;
});
const stick = $('stick');
function updateStick(event) {
  const box = stick.getBoundingClientRect();
  const radius = box.width * .34;
  const dx = event.clientX - box.left - box.width / 2;
  const dy = event.clientY - box.top - box.height / 2;
  const length = Math.max(radius, Math.hypot(dx, dy));
  move.x = dx / length;
  move.y = -dy / length;
  stick.firstElementChild.style.transform = 'translate(' + move.x * radius + 'px,' + -move.y * radius + 'px)';
}
stick.addEventListener('pointerdown', event => {
  if (stickPointer !== undefined) return;
  event.preventDefault();
  stickPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  updateStick(event);
});
stick.addEventListener('pointermove', event => { if (stickPointer === event.pointerId) updateStick(event); });
const fire = $('fire');
fire.addEventListener('pointerdown', event => {
  if (firePointer !== undefined) return;
  event.preventDefault();
  firePointer = event.pointerId;
  fire.setPointerCapture(event.pointerId);
  firing = true;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  lookPad.addEventListener(event, ({ pointerId }) => { if (aimPointer === pointerId) aimPointer = undefined; });
  stick.addEventListener(event, ({ pointerId }) => {
    if (stickPointer !== pointerId) return;
    stickPointer = undefined;
    move.x = move.y = 0;
    stick.firstElementChild.style.transform = '';
  });
  fire.addEventListener(event, ({ pointerId }) => {
    if (firePointer !== pointerId) return;
    firePointer = undefined;
    firing = false;
  });
}

function reload() {
  if (state !== 'game' || reloadAt || rounds === magazine || !reserve) return;
  reloadAt = sim + 1.17;
  tone(340, 100, .16, .04, 'square');
  updateHud();
}

const ray = new T.Ray();
const aimPoint = new T.Vector3();
const hitSphere = new T.Sphere();
const intersection = new T.Vector3();
function shoot() {
  if (sim < nextShot || reloadAt) return;
  if (!rounds) { reload(); return; }
  rounds--;
  nextShot = sim + .131;
  recoil = 1;
  flashUntil = sim + .048;
  tone(135, 43, .12, .11, 'sawtooth');
  camera.getWorldDirection(aimPoint);
  ray.set(camera.position, aimPoint);
  let distance = 62;
  for (const box of cover) {
    if (ray.intersectBox(box, intersection)) distance = Math.min(distance, ray.origin.distanceTo(intersection));
  }
  let target;
  let critical = false;
  for (const infected of active) {
    const { x, z } = infected.group.position;
    for (const headshot of [true, false]) {
      hitSphere.center.set(x, (headshot ? 1.78 : 1.06) * infected.scale + infected.group.position.y, z);
      hitSphere.radius = (headshot ? .255 : .53) * infected.scale;
      if (!ray.intersectSphere(hitSphere, intersection)) continue;
      const hitDistance = ray.origin.distanceTo(intersection);
      if (hitDistance >= distance) continue;
      target = infected;
      distance = hitDistance;
      critical = headshot;
    }
  }
  if (target) {
    target.hp -= critical ? 68 : 34;
    target.stagger = .16;
    hitUntil = sim + .14;
    tone(critical ? 720 : 485, 210, .095, .033);
    if (target.hp <= 0) {
      scene.remove(target.group);
      active.splice(active.indexOf(target), 1);
      kills++;
      if (kills > best) {
        best = kills;
        $('record').textContent = best + ' KILLS';
        try { localStorage.setItem('dead-signal-best', String(best)); } catch {}
      }
    }
  }
  updateHud();
}

// Route infected around the same solid props that constrain player movement.
const side = extent * 2;
const terrain = new Uint8Array(side * side);
const field = new Int16Array(terrain.length);
const queue = new Int32Array(terrain.length);
const cell = (x, z) => clamp(Math.floor(z + extent), 0, side - 1) * side + clamp(Math.floor(x + extent), 0, side - 1);
const neighbors = [-1, 1, -side, side];
let pathTarget = -1;
function buildField() {
  const target = cell(player.x, player.z);
  if (target === pathTarget) return;
  pathTarget = target;
  field.fill(-1);
  field[target] = 0;
  queue[0] = target;
  let length = 1;
  for (let i = 0; i < length; i++) {
    const from = queue[i];
    for (const delta of neighbors) {
      if ((delta === -1 && from % side === 0) || (delta === 1 && from % side === side - 1)) continue;
      const to = from + delta;
      if (to < 0 || to >= field.length || terrain[to] || field[to] >= 0) continue;
      field[to] = field[from] + 1;
      queue[length++] = to;
    }
  }
}

function moveOnGround(actor, dx, dz, radius) {
  if (!blocked(actor.x + dx, actor.z, radius)) actor.x += dx;
  if (!blocked(actor.x, actor.z + dz, radius)) actor.z += dz;
}

function spawnInfected() {
  let gates = entrance.filter(([x, z]) => Math.hypot(x - player.x, z - player.z) > 10);
  if (!gates.length) gates = entrance;
  const [x, z] = wave === 1 && pending === 5 && Math.abs(player.x) < 4 && player.z > 3
    ? entrance[0] : gates[Math.floor(Math.random() * gates.length)];
  const type = wave >= 3 && pending % 5 === 0 ? 'heavy'
    : wave >= 2 && pending % 3 === 0 ? 'runner' : 'walker';
  const model = createInfected(type);
  model.group.position.set(x, 0, z);
  scene.add(model.group);
  active.push({
    ...model,
    hp: type === 'heavy' ? 150 + wave * 3 : type === 'runner' ? 42 + wave * 2 : 60 + wave * 3,
    speed: (type === 'runner' ? 3.7 : type === 'heavy' ? 1.43 : 2.23) + Math.min(.8, wave * .052),
    attack: type === 'heavy' ? 22 : 11,
    cooldown: 0,
    stagger: 0,
    phase: Math.random() * 9
  });
  pending--;
  spawnAt = sim + Math.max(.5, 1.4 - wave * .07);
  updateHud();
}

function walkInfected(infected, dt) {
  const position = infected.group.position;
  const directX = player.x - position.x;
  const directZ = player.z - position.z;
  const range = Math.hypot(directX, directZ);
  let dx = directX;
  let dz = directZ;
  const sightDistance = Math.min(range, 4.5);
  for (let probe = .35; probe < sightDistance; probe += .45) {
    if (!blocked(position.x + dx * probe / range, position.z + dz * probe / range, .32)) continue;
    const index = cell(position.x, position.z);
    let nearest = Infinity;
    for (const delta of neighbors) {
      if ((delta === -1 && index % side === 0) || (delta === 1 && index % side === side - 1)) continue;
      const next = index + delta;
      const steps = field[next];
      if (steps === undefined || steps < 0 || steps >= nearest) continue;
      nearest = steps;
      dx = next % side - extent + .5 - position.x;
      dz = Math.floor(next / side) - extent + .5 - position.z;
    }
    break;
  }
  infected.stagger = Math.max(0, infected.stagger - dt);
  let advancing = false;
  if (range > 1.14) {
    const length = Math.max(.001, Math.hypot(dx, dz));
    const speed = infected.speed * (infected.stagger ? .22 : 1);
    let steerX = dx / length;
    let steerZ = dz / length;
    for (const other of active) {
      if (other === infected) continue;
      const awayX = position.x - other.group.position.x;
      const awayZ = position.z - other.group.position.z;
      const gap = Math.hypot(awayX, awayZ);
      if (gap < .01 || gap > .76) continue;
      const weight = (.76 - gap) * .85 / gap;
      steerX += awayX * weight;
      steerZ += awayZ * weight;
    }
    const steerLength = Math.max(1, Math.hypot(steerX, steerZ));
    const beforeX = position.x;
    const beforeZ = position.z;
    moveOnGround(position, steerX / steerLength * speed * dt, steerZ / steerLength * speed * dt, .31);
    advancing = Math.abs(position.x - beforeX) + Math.abs(position.z - beforeZ) > .001;
  } else if (sim >= infected.cooldown && !infected.stagger &&
      !blocked((player.x + position.x) / 2, (player.z + position.z) / 2, 0)) {
    infected.cooldown = sim + 1.02;
    health = Math.max(0, health - infected.attack);
    damageUntil = sim + .26;
    tone(91, 44, .23, .11);
    updateHud();
  }
  infected.group.rotation.y = Math.atan2(directX, directZ);
  infected.animate(sim + infected.phase, advancing, infected.stagger);
}

function tick(dt) {
  sim += dt;
  const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + move.x;
  const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + move.y;
  const magnitude = Math.hypot(x, y);
  currentSpeed = Math.min(1, magnitude);
  if (magnitude) {
    const speed = (keys.has('ShiftLeft') ? 6.6 : 4.85) / Math.max(1, magnitude);
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    moveOnGround(player, (cos * x - sin * y) * speed * dt, (-sin * x - cos * y) * speed * dt, .36);
    bob += dt * 10;
  }
  buildField();
  camera.position.set(player.x, 1.61 + Math.sin(bob) * .035 * currentSpeed, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  if (reloadAt && sim >= reloadAt) {
    const loaded = Math.min(magazine - rounds, reserve);
    reserve -= loaded;
    rounds += loaded;
    reloadAt = 0;
    tone(150, 365, .12, .04, 'square');
    updateHud();
  }
  if (firing || keys.has('Space')) shoot();
  recoil = Math.max(0, recoil - dt * 12);
  carbine.weapon.position.set(.235 + Math.cos(bob * .5) * .014 * currentSpeed, -.235 + Math.sin(bob) * .016 * currentSpeed - (reloadAt ? .22 : 0), -.45 + recoil * .11);
  carbine.weapon.rotation.set(recoil * .14 - (reloadAt ? .36 : 0), -.1, -.06);
  carbine.flash.visible = sim < flashUntil;
  if (intermission && sim >= intermission) {
    wave++;
    pending = Math.min(32, 2 + wave * 3);
    spawnAt = sim + .25;
    intermission = 0;
    announce('WAVE ' + String(wave).padStart(2, '0'), 1.36);
    tone(150, 310, .46, .055);
    updateHud();
  }
  if (pending && active.length < 13 && sim >= spawnAt) spawnInfected();
  for (const infected of active) walkInfected(infected, dt);
  if (wave && !pending && !active.length && !intermission) {
    intermission = sim + 4.5;
    reserve = Math.min(180, reserve + 56);
    health = Math.min(100, health + 27);
    announce('WAVE CLEARED  /  RESUPPLIED', 3.65);
    updateHud();
  }
  $('announcement').style.opacity = sim < announceUntil ? 1 : 0;
  $('damage').style.opacity = sim < damageUntil ? 1 : 0;
  $('reticle').classList.toggle('hit', sim < hitUntil);
  if (!health) endRun();
}

function previewYard(time) {
  const portrait = camera.aspect < 1;
  camera.position.set(portrait ? 2.55 : .05, portrait ? 1.25 : 1.44, 5.2);
  camera.rotation.set(portrait ? .085 : .035, portrait ? -.08 : .007 + Math.sin(time * .4) * .022, 0);
  preview.animate(time * .6, false);
  introMob.animate(time * .45 + 2, false);
}

function frame(now) {
  const time = now / 1000;
  const dt = Math.min(.033, Math.max(0, time - timer));
  timer = time;
  if (state === 'menu') previewYard(time);
  if (state === 'game') tick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

try {
  renderer = new T.WebGLRenderer({ canvas, antialias: !touch, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  resize();
  createYard(scene);
  cover = obstacles.map(box => new T.Box3(
    new T.Vector3(box.x - box.halfX, 0, box.z - box.halfZ),
    new T.Vector3(box.x + box.halfX, box.height, box.z + box.halfZ)
  ));
  for (let i = 0; i < terrain.length; i++) {
    terrain[i] = blocked(i % side - extent + .5, Math.floor(i / side) - extent + .5, .36);
  }
  carbine = createCarbine(camera);
  carbine.weapon.visible = false;
  preview = createInfected();
  preview.group.position.set(3.05, 0, .02);
  preview.group.scale.setScalar(1.31);
  preview.group.rotation.y = -.22;
  introMob = createInfected('runner');
  introMob.group.position.set(5.3, 0, -5.3);
  introMob.group.rotation.y = -.35;
  scene.add(preview.group, introMob.group);
  ready = true;
  $('deploy').disabled = false;
  addEventListener('resize', resize);
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  $('load-error').hidden = false;
  $('load-error').textContent = 'This game needs WebGL 2. Try opening it in a current browser with graphics acceleration enabled.';
}
