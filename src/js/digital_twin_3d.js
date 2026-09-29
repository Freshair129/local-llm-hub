// src/js/digital_twin_3d.js
// trace:implements FEAT-010
// trace:implements FEAT-011
// trace:implements FR-006

import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

let scene, camera, renderer, controls;
let animFrameId = null;
let cpuGlowMaterial, gpuBodyMaterial, cpuFanGroup, gpuFan1Group, gpuFan2Group;
let ledLight, diskLedMesh;
let isInitialized = false;

// Telemetry State
let currentTelemetry = {
  gpuTemp: 52,
  gpuUtil: 44,
  gpuFan: 48,
  cpuTemp: 48,
  cpuUtil: 34,
  vramUsed: 7.6,
  vramTotal: 12.0,
  ramUsed: 8.4,
  ramTotal: 32.0
};

export function initDigitalTwin() {
  const container = document.getElementById('twin-3d-canvas-container');
  if (!container) return;

  // Prevent multiple initializations
  if (isInitialized) {
    onWindowResize();
    return;
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 560;

  // 1. Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0b0a, 0.04);

  // 2. Camera
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(5.5, 4.8, 6.2);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // 4. OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
  controls.minDistance = 3;
  controls.maxDistance = 14;
  controls.target.set(0, 0.5, 0);

  // 5. Lighting
  setupLighting();

  // 6. Build PC Hardware Components
  buildChassisAndGrid();
  buildMotherboard();
  buildCpuCooler();
  buildGpuCard();
  buildRamModules();
  buildNvmeDrive();

  // 7. Events
  window.addEventListener('resize', onWindowResize);
  setupCameraPresets();

  // 8. Start Loop
  isInitialized = true;
  animate();
}

function setupLighting() {
  // Ambient Soft Light
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Top Key Light
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 8, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  // Accent Green Light (NVIDIA / GHT Theme)
  const greenLight = new THREE.PointLight(0x7cf26b, 2.5, 8);
  greenLight.position.set(0.5, 1.5, -0.8);
  scene.add(greenLight);

  // CPU Cyan/Amber Thermal Light
  ledLight = new THREE.PointLight(0x5bc0eb, 1.8, 6);
  ledLight.position.set(-1.0, 1.2, 0.5);
  scene.add(ledLight);
}

function buildChassisAndGrid() {
  // Subtle Floor Grid
  const grid = new THREE.GridHelper(14, 28, 0x7cf26b, 0x1f2e22);
  grid.position.y = -0.05;
  scene.add(grid);

  // Chassis Backing Plane (Matte Black)
  const chassisGeo = new THREE.BoxGeometry(7.6, 0.1, 6.2);
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f1210,
    roughness: 0.8,
    metalness: 0.3
  });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.set(0, -0.1, 0);
  chassis.receiveShadow = true;
  scene.add(chassis);
}

function buildMotherboard() {
  const mbGroup = new THREE.Group();

  // PCB Board (Dark Olive Green / Matte Black)
  const pcbGeo = new THREE.BoxGeometry(6.4, 0.08, 4.8);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0x121b14,
    roughness: 0.7,
    metalness: 0.2
  });
  const pcb = new THREE.Mesh(pcbGeo, pcbMat);
  pcb.receiveShadow = true;
  mbGroup.add(pcb);

  // Circuit Bus Traces (Subtle gold / green emissive lines)
  for (let i = 0; i < 16; i++) {
    const traceGeo = new THREE.BoxGeometry(0.03, 0.01, 1.2 + (i % 4) * 0.4);
    const traceMat = new THREE.MeshStandardMaterial({
      color: 0x2e6b3e,
      emissive: 0x1a4524,
      emissiveIntensity: 0.4
    });
    const trace = new THREE.Mesh(traceGeo, traceMat);
    trace.position.set(-2.6 + i * 0.36, 0.045, -0.5 + (i % 2) * 0.8);
    mbGroup.add(trace);
  }

  // Chipset Heatsink (Brushed Aluminum Block)
  const heatsinkGeo = new THREE.BoxGeometry(0.9, 0.3, 0.9);
  const heatsinkMat = new THREE.MeshStandardMaterial({
    color: 0x2a332d,
    roughness: 0.3,
    metalness: 0.7
  });
  const heatsink = new THREE.Mesh(heatsinkGeo, heatsinkMat);
  heatsink.position.set(1.6, 0.18, -1.2);
  heatsink.castShadow = true;
  mbGroup.add(heatsink);

  // PCIe x16 Slot (Black + Gold Contacts)
  const pcieGeo = new THREE.BoxGeometry(3.0, 0.14, 0.16);
  const pcieMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const pcie = new THREE.Mesh(pcieGeo, pcieMat);
  pcie.position.set(0.2, 0.1, -0.7);
  mbGroup.add(pcie);

  scene.add(mbGroup);
}

function buildCpuCooler() {
  const cpuGroup = new THREE.Group();
  cpuGroup.position.set(-1.0, 0.05, 0.5);

  // CPU Socket & Heat Spreader (IHS)
  const ihsGeo = new THREE.BoxGeometry(1.1, 0.08, 1.1);
  cpuGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.7,
    roughness: 0.3,
    emissive: 0x5bc0eb,
    emissiveIntensity: 0.5
  });
  const ihs = new THREE.Mesh(ihsGeo, cpuGlowMaterial);
  ihs.position.y = 0.04;
  ihs.castShadow = true;
  cpuGroup.add(ihs);

  // Heatsink Fin Tower (Stacked aluminum plates)
  for (let i = 0; i < 9; i++) {
    const finGeo = new THREE.BoxGeometry(1.2, 0.03, 1.1);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x778877, metalness: 0.8, roughness: 0.2 });
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.y = 0.18 + i * 0.09;
    fin.castShadow = true;
    cpuGroup.add(fin);
  }

  // CPU Cooling Fan (Circular housing with spinning blades)
  cpuFanGroup = new THREE.Group();
  cpuFanGroup.position.set(0, 0.6, 0.62);

  const fanRingGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.08, 16);
  const fanRingMat = new THREE.MeshStandardMaterial({ color: 0x1a221a, roughness: 0.6 });
  const fanRing = new THREE.Mesh(fanRingGeo, fanRingMat);
  fanRing.rotation.x = Math.PI / 2;
  cpuFanGroup.add(fanRing);

  // Blades
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const bladeGeo = new THREE.BoxGeometry(0.24, 0.02, 0.08);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x334433, roughness: 0.4 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(Math.cos(angle) * 0.24, Math.sin(angle) * 0.24, 0);
    blade.rotation.z = angle + 0.35;
    cpuFanGroup.add(blade);
  }

  cpuGroup.add(cpuFanGroup);
  scene.add(cpuGroup);
}

function buildGpuCard() {
  const gpuGroup = new THREE.Group();
  gpuGroup.position.set(0.2, 0.38, -0.7);

  // GPU Shroud / Chassis (RTX 3060 Dual-Fan Card)
  const shroudGeo = new THREE.BoxGeometry(3.2, 0.45, 1.1);
  gpuBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x141815,
    metalness: 0.7,
    roughness: 0.35,
    emissive: 0x7cf26b,
    emissiveIntensity: 0.25
  });
  const shroud = new THREE.Mesh(shroudGeo, gpuBodyMaterial);
  shroud.castShadow = true;
  gpuGroup.add(shroud);

  // Backplate with honeycomb vents
  const backplateGeo = new THREE.BoxGeometry(3.22, 0.04, 1.12);
  const backplateMat = new THREE.MeshStandardMaterial({ color: 0x222a24, metalness: 0.8, roughness: 0.2 });
  const backplate = new THREE.Mesh(backplateGeo, backplateMat);
  backplate.position.y = 0.24;
  gpuGroup.add(backplate);

  // Illuminated "GEFORCE RTX" logo plate
  const logoGeo = new THREE.BoxGeometry(0.9, 0.12, 0.02);
  const logoMat = new THREE.MeshBasicMaterial({ color: 0x7cf26b });
  const logo = new THREE.Mesh(logoGeo, logoMat);
  logo.position.set(0, 0.08, 0.56);
  gpuGroup.add(logo);

  // Fan 1 (Left Fan)
  gpuFan1Group = createGpuFan();
  gpuFan1Group.position.set(-0.75, -0.05, 0.56);
  gpuGroup.add(gpuFan1Group);

  // Fan 2 (Right Fan)
  gpuFan2Group = createGpuFan();
  gpuFan2Group.position.set(0.75, -0.05, 0.56);
  gpuGroup.add(gpuFan2Group);

  // PCIe Metal Bracket
  const bracketGeo = new THREE.BoxGeometry(0.06, 0.7, 1.2);
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
  const bracket = new THREE.Mesh(bracketGeo, bracketMat);
  bracket.position.set(-1.62, 0.1, 0);
  gpuGroup.add(bracket);

  scene.add(gpuGroup);
}

function createGpuFan() {
  const fanGroup = new THREE.Group();
  const ringGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x111612, roughness: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  fanGroup.add(ring);

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const bladeGeo = new THREE.BoxGeometry(0.2, 0.015, 0.06);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x223326, roughness: 0.3 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, 0.01);
    blade.rotation.z = angle + 0.4;
    fanGroup.add(blade);
  }
  return fanGroup;
}

function buildRamModules() {
  const ramGroup = new THREE.Group();
  ramGroup.position.set(0.5, 0.3, 0.5);

  // 4x DIMM Slots
  for (let i = 0; i < 4; i++) {
    const slotZ = -0.4 + i * 0.26;
    // Slot Base
    const slotGeo = new THREE.BoxGeometry(0.12, 0.06, 1.8);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, -0.15, slotZ);
    ramGroup.add(slot);

    // Populate Slots 2 & 4 (Dual Channel 32GB)
    if (i === 1 || i === 3) {
      const stickGeo = new THREE.BoxGeometry(0.06, 0.42, 1.76);
      const stickMat = new THREE.MeshStandardMaterial({
        color: 0x1a261c,
        metalness: 0.7,
        roughness: 0.3
      });
      const stick = new THREE.Mesh(stickGeo, stickMat);
      stick.position.set(0, 0.08, slotZ);
      stick.castShadow = true;
      ramGroup.add(stick);

      // RGB Light Bar Top
      const rgbGeo = new THREE.BoxGeometry(0.07, 0.04, 1.76);
      const rgbMat = new THREE.MeshBasicMaterial({ color: i === 1 ? 0x7cf26b : 0x5bc0eb });
      const rgb = new THREE.Mesh(rgbGeo, rgbMat);
      rgb.position.set(0, 0.3, slotZ);
      ramGroup.add(rgb);
    }
  }

  scene.add(ramGroup);
}

function buildNvmeDrive() {
  const nvmeGroup = new THREE.Group();
  nvmeGroup.position.set(-1.4, 0.1, -1.2);

  // M.2 Stick with Aluminum Ribbed Heatsink
  const m2Geo = new THREE.BoxGeometry(1.2, 0.08, 0.38);
  const m2Mat = new THREE.MeshStandardMaterial({ color: 0x2a362e, metalness: 0.8, roughness: 0.2 });
  const m2 = new THREE.Mesh(m2Geo, m2Mat);
  m2.castShadow = true;
  nvmeGroup.add(m2);

  // Blinking Activity LED
  const ledGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x5bc0eb });
  diskLedMesh = new THREE.Mesh(ledGeo, ledMat);
  diskLedMesh.position.set(0.55, 0.05, 0.12);
  nvmeGroup.add(diskLedMesh);

  scene.add(nvmeGroup);
}

function setupCameraPresets() {
  const btnDefault = document.getElementById('btn-cam-default');
  const btnGpu = document.getElementById('btn-cam-gpu');
  const btnCpu = document.getElementById('btn-cam-cpu');
  const btnTop = document.getElementById('btn-cam-top');

  if (btnDefault) {
    btnDefault.onclick = () => tweenCamera(5.5, 4.8, 6.2, 0, 0.5, 0);
  }
  if (btnGpu) {
    btnGpu.onclick = () => tweenCamera(1.8, 1.6, 2.2, 0.2, 0.4, -0.7);
  }
  if (btnCpu) {
    btnCpu.onclick = () => tweenCamera(-1.0, 2.2, 3.2, -1.0, 0.6, 0.5);
  }
  if (btnTop) {
    btnTop.onclick = () => tweenCamera(0.01, 8.5, 0, 0, 0, 0);
  }
}

function tweenCamera(x, y, z, tx, ty, tz) {
  if (!camera || !controls) return;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(x, y, z);
  const endTarget = new THREE.Vector3(tx, ty, tz);

  let progress = 0;
  const tweenInterval = setInterval(() => {
    progress += 0.05;
    camera.position.lerpVectors(startPos, endPos, progress);
    controls.target.lerpVectors(startTarget, endTarget, progress);
    controls.update();

    if (progress >= 1) {
      clearInterval(tweenInterval);
      camera.position.copy(endPos);
      controls.target.copy(endTarget);
      controls.update();
    }
  }, 16);
}

function onWindowResize() {
  const container = document.getElementById('twin-3d-canvas-container');
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

/**
 * Updates telemetry mapped to the 3D twin
 * @param {Object} data 
 */
export function updateDigitalTwinTelemetry(data) {
  if (!data) return;
  currentTelemetry = { ...currentTelemetry, ...data };

  // Update UI overlay tags
  const elGpuTemp = document.getElementById('twin-stat-gpu-temp');
  const elGpuUtil = document.getElementById('twin-stat-gpu-util');
  const elCpuTemp = document.getElementById('twin-stat-cpu-temp');
  const elCpuUtil = document.getElementById('twin-stat-cpu-util');

  if (elGpuTemp) elGpuTemp.textContent = `${currentTelemetry.gpuTemp}°C`;
  if (elGpuUtil) elGpuUtil.textContent = `${currentTelemetry.gpuUtil}%`;
  if (elCpuTemp) elCpuTemp.textContent = `${currentTelemetry.cpuTemp}°C`;
  if (elCpuUtil) elCpuUtil.textContent = `${currentTelemetry.cpuUtil}%`;

  // Update 3D Colors
  if (cpuGlowMaterial) {
    // Thermal Color mapping: <45°C Cyan, 45-65°C Amber, >70°C Red
    const t = currentTelemetry.cpuTemp;
    if (t < 45) {
      cpuGlowMaterial.emissive.setHex(0x5bc0eb);
    } else if (t < 68) {
      cpuGlowMaterial.emissive.setHex(0xff8a1e);
    } else {
      cpuGlowMaterial.emissive.setHex(0xff3333);
    }
    cpuGlowMaterial.emissiveIntensity = 0.3 + (currentTelemetry.cpuUtil / 100) * 0.8;
  }

  if (gpuBodyMaterial) {
    const t = currentTelemetry.gpuTemp;
    if (t < 55) {
      gpuBodyMaterial.emissive.setHex(0x7cf26b);
    } else if (t < 72) {
      gpuBodyMaterial.emissive.setHex(0xff8a1e);
    } else {
      gpuBodyMaterial.emissive.setHex(0xff3333);
    }
  }
}

function animate() {
  animFrameId = requestAnimationFrame(animate);

  const delta = 0.016;

  // Spin CPU Fan
  if (cpuFanGroup) {
    const fanSpeed = 0.08 + (currentTelemetry.cpuUtil / 100) * 0.3;
    cpuFanGroup.rotation.z += fanSpeed;
  }

  // Spin GPU Dual Fans
  if (gpuFan1Group && gpuFan2Group) {
    const gpuFanSpeed = 0.06 + (currentTelemetry.gpuFan / 100) * 0.35;
    gpuFan1Group.rotation.z += gpuFanSpeed;
    gpuFan2Group.rotation.z += gpuFanSpeed;
  }

  // Disk Activity LED blink
  if (diskLedMesh) {
    diskLedMesh.visible = Math.random() > 0.4;
  }

  if (controls) {
    controls.update();
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export function cleanupDigitalTwin() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  window.removeEventListener('resize', onWindowResize);
}
