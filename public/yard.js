import * as T from './vendor/three.module.js';

const cube = new T.BoxGeometry(1, 1, 1);
const sphere = new T.IcosahedronGeometry(1, 1);
const cylinder = new T.CylinderGeometry(1, 1, 1, 10);
const material = (color, options = {}) => new T.MeshStandardMaterial({ color, roughness: .84, ...options });
const steel = material(0x3d4944);
const dark = material(0x1f2826);
const cream = material(0xddd09b);
const rust = material(0x834334);
const rustEdge = material(0x503128);
const green = material(0x425549);
const greenEdge = material(0x293c34);
const yellow = material(0xb89137);
const lamp = material(0xffe4a2, { emissive: 0xffb94c, emissiveIntensity: 3 });
const red = material(0xff5a27, { emissive: 0xff360a, emissiveIntensity: 2 });
const soil = material(0x555448);
const lane = material(0xaaa16d);
const tar = material(0x353831);
const batched = new Map();
export const obstacles = [];
export const extent = 26;

let seed = 1108;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

function piece(parent, mat, x, y, z, w, h, d, angle = 0, geometry = cube) {
  const mesh = new T.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.rotation.y = angle;
  parent.add(mesh);
  return mesh;
}

function block(mat, x, y, z, w, h, d, angle = 0, geometry = cube, tilt = 0) {
  const key = mat.id + '/' + geometry.id;
  if (!batched.has(key)) batched.set(key, { mat, geometry, transforms: [] });
  const pivot = new T.Object3D();
  pivot.position.set(x, y, z);
  pivot.scale.set(w, h, d);
  pivot.rotation.set(0, angle, tilt);
  pivot.updateMatrix();
  batched.get(key).transforms.push(pivot.matrix);
}

function solid(x, z, w, d, height) {
  obstacles.push({ x, z, halfX: w / 2, halfZ: d / 2, height });
}

export function blocked(x, z, radius = .36) {
  return Math.abs(x) > extent - radius || Math.abs(z) > extent - radius ||
    obstacles.some(box => Math.abs(x - box.x) < box.halfX + radius && Math.abs(z - box.z) < box.halfZ + radius);
}

function sign(scene, title, subtitle, x, y, z, size, color = '#e6d7a0') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  context.fillStyle = '#262e29';
  context.fillRect(0, 0, 512, 160);
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.strokeRect(9, 9, 494, 142);
  context.fillStyle = color;
  context.font = 'bold 72px Impact, sans-serif';
  context.fillText(title, 30, 95);
  context.font = 'bold 21px monospace';
  context.fillText(subtitle, 32, 130);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const plate = new T.Mesh(new T.PlaneGeometry(size, size * .3125), new T.MeshStandardMaterial({ map }));
  plate.position.set(x, y, z);
  scene.add(plate);
}

function container(x, z, w, d, y, color) {
  const edge = color === rust ? rustEdge : greenEdge;
  block(color, x, y + 1.43, z, w, 2.86, d);
  for (let offset = -.5 * d + .22; offset < .5 * d; offset += .31) {
    for (const side of [-1, 1]) block(edge, x + side * w / 2, y + 1.42, z + offset, .085, 2.69, .12);
  }
  for (const side of [-1, 1]) {
    block(edge, x, y + 1.43, z + side * d / 2, w + .13, 2.94, .12);
    for (const offset of [-.43, -.13, .13, .43]) {
      block(steel, x + offset * w, y + 1.42, z + side * (d / 2 + .07), .05, 2.45, .06);
    }
    for (const level of [.08, 2.79]) block(color, x, y + level, z + side * (d / 2 + .08), w, .11, .07);
  }
  if (!y) solid(x, z, w + .1, d + .1, 2.97);
}

function crate(x, z, size) {
  block(greenEdge, x, size / 2, z, size, size, size);
  for (const side of [-1, 1]) {
    block(steel, x + side * size * .42, size / 2, z, .13, size + .03, size + .04);
  }
  block(yellow, x, size * .77, z + size * .51, size * .9, .08, .04);
  solid(x, z, size, size, size);
}

function pole(scene, x, z, color, intensity) {
  block(dark, x, 3.8, z, .075, 7.6, .075, 0, cylinder);
  block(steel, x, 7.43, z, 1.3, .12, .13);
  for (const offset of [-.52, .52]) {
    block(dark, x + offset, 7.31, z, .67, .37, .29);
    block(lamp, x + offset, 7.31, z + .16, .51, .23, .03);
  }
  const light = new T.PointLight(color, intensity, 24, 1.65);
  light.position.set(x, 6.6, z + 1.2);
  scene.add(light);
}

function ground(scene) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 512;
  const context = surface.getContext('2d');
  context.fillStyle = '#685f50';
  context.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    context.fillStyle = i % 3 ? '#211e1927' : '#eae0bb30';
    context.fillRect(random() * 512, random() * 512, 1 + random() * 4, 1 + random() * 3);
  }
  for (let i = 0; i < 22; i++) {
    const x = random() * 512;
    const y = random() * 512;
    context.strokeStyle = '#29272160';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + random() * 26, y + 13);
    context.lineTo(x + random() * 42, y + 21);
    context.stroke();
  }
  const map = new T.CanvasTexture(surface);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(20, 20);
  block(material(0xaaa291, { map }), 0, -.13, 0, 112, .25, 112);
  for (let z = -25; z < 26; z += 1.8) {
    block(lane, -4.6, .008, z, .075, .012, .96);
    block(lane, 4.6, .008, z, .075, .012, .96);
  }
  for (let i = 0; i < 165; i++) {
    const x = random() * 50 - 25;
    const z = random() * 50 - 25;
    block(i % 4 ? soil : tar, x, .005, z, .07 + random() * .6, .019, .06 + random() * .25, random() * 7, sphere);
  }
  scene.add(new T.HemisphereLight(0xd9e0c4, 0x453e3a, 2.05));
}

export function createYard(scene) {
  scene.background = new T.Color(0x9d7253);
  scene.fog = new T.FogExp2(0x8e7460, .021);
  ground(scene);
  const sun = new T.DirectionalLight(0xffc082, 2.05);
  sun.position.set(19, 11, -18);
  scene.add(sun);
  const fill = new T.DirectionalLight(0x93cbc0, 1.15);
  fill.position.set(-20, 7, 14);
  scene.add(fill);
  pole(scene, -7.1, -10, 0xffba64, 85);
  pole(scene, 12, -7, 0xffa049, 105);
  pole(scene, 2, -23.8, 0xffbf75, 75);

  container(-6.5, -8.8, 2.55, 11, 0, green);
  container(-6.5, -10.2, 2.55, 8.2, 2.96, rust);
  container(8.3, -5.5, 2.8, 12, 0, rust);
  container(8.3, -6.5, 2.8, 10, 2.96, green);
  container(16.5, -15, 3.1, 10.2, 0, green);
  container(16.5, -15, 3.1, 10.2, 2.96, rust);
  container(-17, -4, 3, 12, 0, rust);
  container(-12.6, 12, 8.9, 2.8, 0, green);
  container(15, 12, 9.2, 2.8, 0, rust);
  crate(-8.7, 2, 1.8);
  crate(6.7, 5.9, 1.55);
  crate(-1.8, -16.3, 1.55);
  crate(12, -17.8, 2);
  sign(scene, 'SECTOR 07', 'FREIGHT TRANSFER', 8.3, 4.6, -1.48, 2.6);
  sign(scene, 'RAIL 02', 'AUTHORIZED CREW', -6.5, 1.7, -3.21, 2.25);

  // The shuttered depot and gantry frame the end of the central lane.
  block(greenEdge, 0, 2.3, -27.1, 33, 4.6, 1.5);
  block(dark, 0, 4.7, -27, 34, .4, 3);
  for (const x of [-11, 0, 11]) {
    block(steel, x, 1.45, -26.3, 6.4, 2.9, .15);
    for (let y = .15; y < 3; y += .19) block(dark, x, y, -26.18, 6.4, .025, .03);
    block(red, x, 3.35, -26.05, .32, .21, .12);
  }
  sign(scene, 'GATE 04', 'NORTH FREIGHT DEPOT', 0, 4.02, -26.25, 4.1);
  for (const x of [-12.5, 12.5]) {
    block(rustEdge, x, 4.5, -19.6, .48, 9, .48);
    block(yellow, x, 8.95, -19.6, .66, .56, .66);
    block(dark, x, 4.5, -20.15, .12, 9, .1);
  }
  block(rustEdge, 0, 9.06, -19.6, 25.3, .53, .48);
  block(dark, 0, 10.24, -19.6, 25.3, .16, .22);
  for (let x = -12; x < 12; x += 1.5) block(rustEdge, x, 9.66, -19.6, .13, 1.88, .15, 0, cube, (Math.floor(x / 1.5) % 2 ? 1 : -1) * .58);
  block(dark, 3, 7.9, -19.6, .7, 1.8, .65);
  block(red, 3, 7.65, -19.25, .25, .22, .06);
  for (const x of [-26.3, 26.3]) {
    block(greenEdge, x, .46, 0, .35, .92, 54);
    for (let z = -25; z <= 25; z += 2.5) block(steel, x, 1.35, z, .11, 2.7, .11);
    for (const y of [1.05, 1.65, 2.3, 2.65]) block(dark, x, y, 0, .045, .045, 54);
  }
  block(greenEdge, 0, .66, 26.35, 54, 1.32, .45);
  for (let x = -24; x <= 24; x += 3.7) block(steel, x, 1.05, 26.3, .18, 2.1, .2);

  for (let i = 0; i < 23; i++) {
    const x = i * 4.8 - 53;
    const height = 1.5 + random() * 6.5;
    block(i % 2 ? greenEdge : rustEdge, x, height / 2, -38 - random() * 10, 3 + random() * 7, height, 3);
  }
  for (const { mat, geometry, transforms } of batched.values()) {
    const instances = new T.InstancedMesh(geometry, mat, transforms.length);
    transforms.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
    scene.add(instances);
  }
  batched.clear();
}

const skin = material(0x827c61);
const flesh = material(0x664c3e);
const cloth = material(0x50584a);
const runnerCloth = material(0x875741);
const heavyCloth = material(0x514138);
const pants = material(0x30342d);
const eye = material(0xeafa9a, { emissive: 0xd9ff64, emissiveIntensity: 2.9 });
const shadow = new T.MeshBasicMaterial({ color: 0x252418, transparent: true, opacity: .35, depthWrite: false });
const disc = new T.CircleGeometry(1, 18);

export function createInfected(type = 'walker') {
  const group = new T.Group();
  const clothes = type === 'runner' ? runnerCloth : type === 'heavy' ? heavyCloth : cloth;
  const body = new T.Group();
  group.add(body);
  piece(body, clothes, 0, 1.37, 0, .43, .38, .22, 0, sphere);
  piece(body, clothes, 0, 1.16, -.01, .33, .29, .184, 0, sphere);
  piece(body, dark, 0, 1.02, .042, .53, .13, .33);
  for (const x of [-.18, .18]) piece(body, yellow, x, 1.33, .19, .064, .36, .025).rotation.z = x * -.8;
  piece(body, steel, .10, 1.35, .217, .128, .14, .05);
  piece(body, skin, .045, 1.69, .025, .09, .13, .095, 0, sphere);
  piece(body, skin, .055, 1.83, .06, .177, .23, .171, 0, sphere).rotation.z = -.16;
  piece(body, flesh, .07, 1.715, .148, .128, .079, .083, 0, sphere);
  piece(body, dark, .071, 1.751, .214, .126, .027, .026).rotation.z = -.13;
  piece(body, cream, .077, 1.756, .23, .081, .012, .009).rotation.z = -.13;
  for (const x of [-.014, .124]) {
    piece(body, flesh, x, 1.851, .211, .051, .033, .025, 0, sphere);
    piece(body, eye, x, 1.85, .231, .025, .02, .014, 0, sphere);
  }
  if (type === 'heavy') piece(body, steel, 0, 1.4, .15, .4, .267, .15, 0, sphere);
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * .35, 1.51, 0);
    arm.rotation.z = side * .17;
    piece(arm, clothes, 0, -.11, 0, .132, .238, .126, 0, sphere);
    piece(arm, skin, 0, -.41, .043, .086, .208, .084, 0, sphere);
    piece(arm, flesh, 0, -.58, .055, .073, .085, .065, 0, sphere);
    body.add(arm);
    arms.push(arm);
    const leg = new T.Group();
    leg.position.set(side * .19, .91, -.018);
    piece(leg, pants, 0, -.29, 0, .146, .36, .145, 0, sphere);
    piece(leg, dark, 0, -.65, .026, .13, .29, .124, 0, sphere);
    piece(leg, dark, 0, -.83, .103, .133, .104, .209, 0, sphere);
    group.add(leg);
    legs.push(leg);
  }
  const footprint = piece(group, shadow, 0, .024, 0, .63, .43, 1, 0, disc);
  footprint.rotation.x = -Math.PI / 2;
  const scale = type === 'heavy' ? 1.23 : type === 'runner' ? .91 : 1;
  body.scale.setScalar(scale);
  const animate = (time, moving, stagger = 0) => {
    const stride = Math.sin(time * (type === 'runner' ? 12 : 7));
    body.position.y = moving ? Math.abs(stride) * .052 : Math.sin(time * 2) * .028;
    body.rotation.x = .11 + stagger * .7;
    body.rotation.z = (moving ? stride : Math.sin(time * 1.6)) * .045;
    arms[0].rotation.x = -.85 + stride * .25;
    arms[1].rotation.x = -1.14 - stride * .28;
    legs[0].rotation.x = moving ? stride * .49 : 0;
    legs[1].rotation.x = moving ? -stride * .49 : 0;
  };
  return { group, animate, scale };
}

export function createCarbine(camera) {
  const weapon = new T.Group();
  camera.add(weapon);
  const casing = material(0x66705e, { metalness: .32 });
  const diode = material(0xe0f383, { emissive: 0xd3ef60, emissiveIntensity: .9 });
  piece(weapon, casing, 0, 0, -.14, .18, .17, .49);
  piece(weapon, dark, 0, .067, -.25, .195, .05, .37);
  piece(weapon, dark, 0, -.045, .125, .143, .15, .24);
  piece(weapon, steel, 0, .015, -.463, .081, .072, .245);
  piece(weapon, dark, 0, .015, -.581, .105, .101, .096);
  piece(weapon, casing, 0, .095, -.045, .104, .05, .115);
  piece(weapon, diode, 0, .118, .01, .045, .021, .015);
  piece(weapon, yellow, .092, .005, -.19, .015, .044, .15);
  piece(weapon, dark, 0, -.147, -.17, .096, .19, .118).rotation.x = -.2;
  piece(weapon, material(0x777361), -.08, -.098, -.27, .15, .113, .25, 0, sphere);
  piece(weapon, material(0x333d32), .046, -.17, .116, .16, .16, .29, 0, sphere);
  const flash = piece(weapon, lamp, 0, .018, -.655, .14, .14, .22, 0, sphere);
  flash.visible = false;
  return { weapon, flash };
}
