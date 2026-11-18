import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Box, Eye, Layers, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Floor, Space } from '../types/cesge';

interface TorreNorte3DViewProps {
  floors: Floor[];
  spaces: Space[];
  selectedFloorId: number;
  onSelectFloor: (floorId: number) => void;
}

type CameraPreset = 'general' | 'stairs' | 'parking' | 'front';

const PRESET_VIEWS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  general: { pos: [19.5, 14.5, 22], target: [0.6, 5.0, -0.3] },
  stairs: { pos: [15.5, 6.4, 10.5], target: [4.6, 5.0, -2.0] },
  parking: { pos: [13, 4.2, 13.5], target: [0, -0.6, 0] },
  front: { pos: [0.2, 7.5, 25], target: [0, 5.0, 0] },
};

const _vecTarget = new THREE.Vector3();
const _badgeWorldPos = new THREE.Vector3();

function createParkingFloorTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Yellow parking bay lines (top and bottom rows)
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 5; i++) {
    const x = 48 + i * 83;
    ctx.beginPath();
    ctx.moveTo(x, 28);
    ctx.lineTo(x, 165);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, 347);
    ctx.lineTo(x, 484);
    ctx.stroke();
  }

  // Center lane dashed markings
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.setLineDash([22, 16]);
  ctx.beginPath();
  ctx.moveTo(32, 256);
  ctx.lineTo(480, 256);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label on floor
  ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PARQUEADERO · SÓTANO', 256, 224);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createExteriorGroundTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle paving grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  for (let g = 0; g <= 512; g += 64) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(512, g);
    ctx.stroke();
  }

  // Pedestrian access stripes at front
  ctx.fillStyle = '#f8fafc';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(184 + i * 26, 405, 14, 52);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createFloorBadgeTexture(
  shortLabel: string,
  subtitle: string,
  selected: boolean,
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = selected ? '#047857' : '#ffffff';
  ctx.fillRect(0, 0, 320, 96);

  ctx.strokeStyle = selected ? '#065f46' : '#cbd5e1';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 314, 90);

  ctx.fillStyle = selected ? '#ffffff' : '#0f172a';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(shortLabel, 20, 48);

  ctx.fillStyle = selected ? '#d1fae5' : '#475569';
  ctx.font = '600 21px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(subtitle, 300, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function buildParkedVehicle(colorHex: number): THREE.Group {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.45 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.18, metalness: 0.25 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.1 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 0.62), bodyMat);
  chassis.position.y = 0.24;
  car.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.52), cabinMat);
  cabin.position.set(-0.04, 0.5, 0);
  car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelOffsets: Array<[number, number]> = [
    [-0.36, 0.31],
    [0.36, 0.31],
    [-0.36, -0.31],
    [0.36, -0.31],
  ];
  for (const [wx, wz] of wheelOffsets) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.12, wz);
    car.add(w);
  }
  return car;
}

function createFeatureLabelTexture(
  label: string,
  bgHex: string,
  fgHex: string,
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = fgHex;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export default function TorreNorte3DView({
  floors,
  spaces,
  selectedFloorId,
  onSelectFloor,
}: TorreNorte3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [exploded, setExploded] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPreset>('general');

  const selectedFloorIdRef = useRef(selectedFloorId);
  selectedFloorIdRef.current = selectedFloorId;

  const explodedRef = useRef(exploded);
  explodedRef.current = exploded;

  const onSelectFloorRef = useRef(onSelectFloor);
  onSelectFloorRef.current = onSelectFloor;

  const presetTriggerRef = useRef<((preset: CameraPreset) => void) | null>(null);
  const rebuildHighlightRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rebuildHighlightRef.current?.();
  }, [selectedFloorId, spaces, floors]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 390;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 32, 68);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.2, 120);
    camera.position.set(...PRESET_VIEWS.general.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...PRESET_VIEWS.general.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 42;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.update();

    // Lighting rig: warm key + cool hemi + subtle rim
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x94a3b8, 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    keyLight.position.set(16, 26, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 65;
      keyLight.shadow.camera.left = -16;
      keyLight.shadow.camera.right = 16;
      keyLight.shadow.camera.top = 18;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.55);
    rimLight.position.set(-14, 12, -16);
    scene.add(rimLight);

    // Disposable resource registry
    const texturesToDispose: THREE.Texture[] = [];
    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometriesToDispose.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materialsToDispose.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      texturesToDispose.push(t);
      return t;
    };

    // Ground & Zonas Exteriores base (4-sided plaza framing an open cutaway well for Sótano y Parqueadero)
    const extTex = trackTex(createExteriorGroundTexture(maxAniso));
    const groundMat = trackMat(new THREE.MeshStandardMaterial({ map: extTex, roughness: 0.88, metalness: 0.04 }));
    const plazaStrips: Array<{ w: number; d: number; x: number; z: number }> = [
      { w: 36, d: 13.7, x: 0, z: -11.15 }, // Back
      { w: 36, d: 13.7, x: 0, z: 11.15 }, // Front
      { w: 12.7, d: 8.6, x: -11.65, z: 0 }, // Left
      { w: 12.7, d: 8.6, x: 11.65, z: 0 }, // Right
    ];
    for (const s of plazaStrips) {
      const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(s.w, 0.12, s.d)), groundMat);
      strip.position.set(s.x, -0.06, s.z);
      strip.receiveShadow = !isSoftwareGl;
      scene.add(strip);
    }

    // Subtle green lawn strips around exterior plaza
    const lawnMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9, metalness: 0.0 }));
    const lawnGeo = trackGeo(new THREE.BoxGeometry(4.4, 0.1, 1.1));
    const frontLawnLeft = new THREE.Mesh(lawnGeo, lawnMat);
    frontLawnLeft.position.set(-3.8, 0.02, 5.15);
    scene.add(frontLawnLeft);

    const frontLawnRight = new THREE.Mesh(lawnGeo, lawnMat);
    frontLawnRight.position.set(3.8, 0.02, 5.15);
    scene.add(frontLawnRight);

    // Subterranean parking cutaway retaining walls & base
    const pitMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.15 }));
    const pitBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 0.18, 8.8)), pitMat);
    pitBase.position.set(0, -1.78, 0);
    scene.add(pitBase);

    const wallBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 1.72, 0.18)), pitMat);
    wallBack.position.set(0, -0.92, -4.39);
    scene.add(wallBack);

    const wallLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 1.72, 8.6)), pitMat);
    wallLeft.position.set(-5.31, -0.92, 0);
    scene.add(wallLeft);

    const parkingTex = trackTex(createParkingFloorTexture(maxAniso));

    // Shared building materials
    const pillarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.55, metalness: 0.25 }));
    const coreMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65, metalness: 0.15 }));
    const glassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        roughness: 0.12,
        metalness: 0.05,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    );
    const yellowBollardMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.2 }));

    const sortedFloors = [...floors].sort((a, b) => a.sortOrder - b.sortOrder);

    interface FloorNode {
      floor: Floor;
      group: THREE.Group;
      slabMesh: THREE.Mesh;
      hitBox: THREE.Mesh;
      badgeMesh: THREE.Mesh;
      baseY: number;
      explodedY: number;
    }

    const floorNodes: FloorNode[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    const slabGeo = trackGeo(new THREE.BoxGeometry(8.8, 0.22, 6.8));
    const pillarGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.92, 0.24));
    const glassFrontGeo = trackGeo(new THREE.BoxGeometry(8.5, 0.72, 0.06));
    const glassSideGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.72, 6.5));
    const hitGeo = trackGeo(new THREE.BoxGeometry(9.6, 1.05, 7.6));
    const badgeGeo = trackGeo(new THREE.PlaneGeometry(2.75, 0.82));

    // Shared materials & reusable geometries for exterior Emergency Stairs (matching reference photo)
    const stairTrimMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x6e3b53, roughness: 0.42, metalness: 0.45 })
    );
    const stairPanelMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xd6d1c4, roughness: 0.82, metalness: 0.04 })
    );
    const stairPilasterMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.72, metalness: 0.06 })
    );
    const stairSteelDarkMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.48, metalness: 0.62 })
    );
    const stairExitSignMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5, metalness: 0.1 })
    );

    const stairPilasterGeo = trackGeo(new THREE.BoxGeometry(0.22, 1.04, 0.22));
    const stairColGeo = trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 1.04, 10));
    const stairInnerLandingGeo = trackGeo(new THREE.BoxGeometry(0.72, 0.11, 2.02));
    const stairTieBeamGeo = trackGeo(new THREE.BoxGeometry(1.52, 0.07, 0.07));
    const stairExitDoorGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.74, 0.62));
    const stairTreadGeo = trackGeo(new THREE.BoxGeometry(0.19, 0.055, 0.84));
    const stairPostGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.39, 0.055));

    // Chamfered octagonal landing deck (ExtrudeGeometry) matching the photo's beveled outer corners
    const chamferShape = new THREE.Shape();
    chamferShape.moveTo(0, -1.0);
    chamferShape.lineTo(0.32, -1.0);
    chamferShape.lineTo(0.68, -0.64);
    chamferShape.lineTo(0.68, 0.64);
    chamferShape.lineTo(0.32, 1.0);
    chamferShape.lineTo(0, 1.0);
    chamferShape.closePath();
    const chamferDeckGeo = trackGeo(
      new THREE.ExtrudeGeometry(chamferShape, {
        depth: 0.11,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
      })
    );
    chamferDeckGeo.rotateX(-Math.PI / 2);

    // Reusable guardrail & sloped flight panel geometries
    const railOuterPanelGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.26, 1.24));
    const railOuterTopGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.065, 1.28));
    const railChamferPanelGeo = trackGeo(new THREE.BoxGeometry(0.51, 0.26, 0.04));
    const railChamferTopGeo = trackGeo(new THREE.BoxGeometry(0.53, 0.065, 0.065));
    const railShortSidePanelGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.26, 0.04));
    const railShortSideTopGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.065, 0.065));

    const flightLenA = Math.hypot(0.87, 0.46);
    const flightAngleA = Math.atan2(0.46, 0.87);
    const flightLenB = Math.hypot(0.87, 0.52);
    const flightAngleB = Math.atan2(0.52, 0.87);

    const flightPanelGeoA = trackGeo(new THREE.BoxGeometry(flightLenA, 0.28, 0.04));
    const flightRailGeoA = trackGeo(new THREE.BoxGeometry(flightLenA + 0.04, 0.065, 0.065));
    const flightSoffitGeoA = trackGeo(new THREE.BoxGeometry(flightLenA, 0.08, 0.88));

    const flightPanelGeoB = trackGeo(new THREE.BoxGeometry(flightLenB, 0.28, 0.04));
    const flightRailGeoB = trackGeo(new THREE.BoxGeometry(flightLenB + 0.04, 0.065, 0.065));
    const flightSoffitGeoB = trackGeo(new THREE.BoxGeometry(flightLenB, 0.08, 0.88));

    const addChamferedBalconyRail = (parent: THREE.Group, yDeck: number) => {
      const yMid = yDeck + 0.22;
      const yBot = yDeck + 0.07;
      const yTop = yDeck + 0.37;

      // Flat outer face (+X at x = 6.54, z in [-2.99, -1.71])
      const outerPanel = new THREE.Mesh(railOuterPanelGeo, stairPanelMat);
      outerPanel.position.set(6.54, yMid, -2.35);
      parent.add(outerPanel);
      const outerTop = new THREE.Mesh(railOuterTopGeo, stairTrimMat);
      outerTop.position.set(6.54, yTop, -2.35);
      parent.add(outerTop);
      const outerBot = new THREE.Mesh(railOuterTopGeo, stairTrimMat);
      outerBot.position.set(6.54, yBot, -2.35);
      parent.add(outerBot);

      // Front-right 45° chamfered face (from x=6.20, z=-1.35 to x=6.56, z=-1.71)
      const frontChamferPanel = new THREE.Mesh(railChamferPanelGeo, stairPanelMat);
      frontChamferPanel.position.set(6.38, yMid, -1.53);
      frontChamferPanel.rotation.y = Math.PI / 4;
      parent.add(frontChamferPanel);
      const frontChamferTop = new THREE.Mesh(railChamferTopGeo, stairTrimMat);
      frontChamferTop.position.set(6.38, yTop, -1.53);
      frontChamferTop.rotation.y = Math.PI / 4;
      parent.add(frontChamferTop);
      const frontChamferBot = new THREE.Mesh(railChamferTopGeo, stairTrimMat);
      frontChamferBot.position.set(6.38, yBot, -1.53);
      frontChamferBot.rotation.y = Math.PI / 4;
      parent.add(frontChamferBot);

      // Back-right 45° chamfered face (from x=6.20, z=-3.35 to x=6.56, z=-2.99)
      const backChamferPanel = new THREE.Mesh(railChamferPanelGeo, stairPanelMat);
      backChamferPanel.position.set(6.38, yMid, -3.17);
      backChamferPanel.rotation.y = -Math.PI / 4;
      parent.add(backChamferPanel);
      const backChamferTop = new THREE.Mesh(railChamferTopGeo, stairTrimMat);
      backChamferTop.position.set(6.38, yTop, -3.17);
      backChamferTop.rotation.y = -Math.PI / 4;
      parent.add(backChamferTop);
      const backChamferBot = new THREE.Mesh(railChamferTopGeo, stairTrimMat);
      backChamferBot.position.set(6.38, yBot, -3.17);
      backChamferBot.rotation.y = -Math.PI / 4;
      parent.add(backChamferBot);

      // Short side returns on z = -1.35 and z = -3.35 (x from 5.88 to 6.20)
      for (const rz of [-1.35, -3.35]) {
        const sPanel = new THREE.Mesh(railShortSidePanelGeo, stairPanelMat);
        sPanel.position.set(6.04, yMid, rz);
        parent.add(sPanel);
        const sTop = new THREE.Mesh(railShortSideTopGeo, stairTrimMat);
        sTop.position.set(6.04, yTop, rz);
        parent.add(sTop);
        const sBot = new THREE.Mesh(railShortSideTopGeo, stairTrimMat);
        sBot.position.set(6.04, yBot, rz);
        parent.add(sBot);
      }

      // Corner vertical plum steel posts
      const postCoords: Array<[number, number]> = [
        [6.2, -1.35],
        [6.54, -1.71],
        [6.54, -2.99],
        [6.2, -3.35],
      ];
      for (const [px, pz] of postCoords) {
        const post = new THREE.Mesh(stairPostGeo, stairTrimMat);
        post.position.set(px, yDeck + 0.22, pz);
        parent.add(post);
      }
    };

    const addSlopedFlight = (
      parent: THREE.Group,
      panelGeo: THREE.BoxGeometry,
      railGeo: THREE.BoxGeometry,
      soffitGeo: THREE.BoxGeometry,
      centerX: number,
      centerY: number,
      centerZ: number,
      rotZ: number,
      startX: number,
      endX: number,
      startY: number,
      endY: number
    ) => {
      // Dark steel soffit slab underneath treads
      const soffit = new THREE.Mesh(soffitGeo, stairSteelDarkMat);
      soffit.position.set(centerX, centerY - 0.05, centerZ);
      soffit.rotation.z = rotZ;
      parent.add(soffit);

      // 5 stepped individual treads
      const steps = 5;
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        const tread = new THREE.Mesh(stairTreadGeo, stairSteelDarkMat);
        tread.position.set(startX + (endX - startX) * t, startY + (endY - startY) * t, centerZ);
        parent.add(tread);
      }

      // Guardrail panels & plum steel top/bottom stringers on both sides of the flight
      for (const sideOffset of [-0.45, 0.45]) {
        const rz = centerZ + sideOffset;
        const panel = new THREE.Mesh(panelGeo, stairPanelMat);
        panel.position.set(centerX, centerY + 0.16, rz);
        panel.rotation.z = rotZ;
        parent.add(panel);

        const topRail = new THREE.Mesh(railGeo, stairTrimMat);
        topRail.position.set(centerX, centerY + 0.31, rz);
        topRail.rotation.z = rotZ;
        parent.add(topRail);

        const botStringer = new THREE.Mesh(railGeo, stairTrimMat);
        botStringer.position.set(centerX, centerY - 0.01, rz);
        botStringer.rotation.z = rotZ;
        parent.add(botStringer);
      }
    };

    sortedFloors.forEach((floor) => {
      const group = new THREE.Group();
      const isSotano = floor.code === 'SOTANO';
      const isExteriores = floor.code === 'EXTERIORES';

      // Determine Y coordinates
      let baseY = 0.25;
      let explodedY = 0.25;
      if (isSotano) {
        baseY = -1.42;
        explodedY = -2.25;
      } else if (isExteriores) {
        baseY = 0.06;
        explodedY = -0.35;
      } else {
        // PISO-01..PISO-10
        baseY = 0.55 + (floor.sortOrder - 1) * 1.04;
        explodedY = 0.95 + (floor.sortOrder - 1) * 1.48;
      }
      group.position.y = baseY;

      let slabMesh: THREE.Mesh;
      if (isSotano) {
        const parkMat = trackMat(
          new THREE.MeshStandardMaterial({
            map: parkingTex,
            roughness: 0.78,
            metalness: 0.08,
          })
        );
        slabMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.8, 0.24, 7.8)), parkMat);
        slabMesh.receiveShadow = !isSoftwareGl;
        group.add(slabMesh);

        // Ramp into parking
        const rampMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85, metalness: 0.1 }));
        const ramp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.14, 3.3)), rampMat);
        ramp.position.set(5.4, 0.62, 1.6);
        ramp.rotation.z = 0.38;
        group.add(ramp);

        // Safety bollards & columns in Sótano
        const bollardGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8));
        const colPositions: Array<[number, number]> = [
          [-3.8, -2.9],
          [0, -2.9],
          [3.8, -2.9],
          [-3.8, 2.9],
          [0, 2.9],
          [3.8, 2.9],
        ];
        for (const [cx, cz] of colPositions) {
          const col = new THREE.Mesh(pillarGeo, pillarMat);
          col.position.set(cx, 0.58, cz);
          group.add(col);
          const bol = new THREE.Mesh(bollardGeo, yellowBollardMat);
          bol.position.set(cx + 0.25, 0.39, cz);
          group.add(bol);
        }

        // Stylized parked vehicles so Sótano y Parqueadero reads immediately
        const car1 = buildParkedVehicle(0x0284c7);
        car1.position.set(-2.6, 0.12, -2.1);
        car1.rotation.y = Math.PI / 2;
        group.add(car1);

        const car2 = buildParkedVehicle(0x059669);
        car2.position.set(-0.9, 0.12, -2.1);
        car2.rotation.y = Math.PI / 2;
        group.add(car2);

        const car3 = buildParkedVehicle(0xe2e8f0);
        car3.position.set(2.4, 0.12, 2.1);
        car3.rotation.y = -Math.PI / 2;
        group.add(car3);
      } else if (isExteriores) {
        const extMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xdbeafe,
            roughness: 0.78,
            metalness: 0.06,
          })
        );
        // Front exterior walkway apron + side border curbs framing the building (never covering Sótano cutaway)
        slabMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.2, 0.14, 2.2)), extMat);
        slabMesh.position.set(0, 0, 5.55);
        group.add(slabMesh);

        const curbBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.2, 0.14, 1.0)), extMat);
        curbBack.position.set(0, 0, -4.95);
        group.add(curbBack);

        const curbLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.0, 0.14, 9.5)), extMat);
        curbLeft.position.set(-5.6, 0, 0.3);
        group.add(curbLeft);

        const curbRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.0, 0.14, 9.5)), extMat);
        curbRight.position.set(5.6, 0, 0.3);
        group.add(curbRight);

        // Entrance canopy arch at front access
        const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.45, metalness: 0.35 }));
        const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 0.16, 1.6)), canopyMat);
        canopy.position.set(0, 0.98, 4.95);
        group.add(canopy);

        // Exterior emergency stairs ground arrival pad & readable signage (right-rear side)
        const exitPad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.45, 0.16, 2.35)), stairPilasterMat);
        exitPad.position.set(5.6, 0.02, -2.35);
        group.add(exitPad);

        const exitStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.04, 0.35)), stairExitSignMat);
        exitStripe.position.set(5.6, 0.1, -1.25);
        group.add(exitStripe);

        const stairLabelTex = trackTex(
          createFeatureLabelTexture('ESCALERAS EMERG.', '#6e3b53', '#ffffff', maxAniso)
        );
        const stairLabel = new THREE.Mesh(
          trackGeo(new THREE.PlaneGeometry(2.25, 0.52)),
          trackMat(new THREE.MeshBasicMaterial({ map: stairLabelTex, side: THREE.DoubleSide }))
        );
        stairLabel.position.set(6.75, 1.15, -2.35);
        stairLabel.rotation.y = Math.PI / 2;
        group.add(stairLabel);
      } else {
        const slabMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.65,
            metalness: 0.1,
          })
        );
        slabMesh = new THREE.Mesh(slabGeo, slabMat);
        slabMesh.castShadow = !isSoftwareGl;
        slabMesh.receiveShadow = !isSoftwareGl;
        group.add(slabMesh);

        // 4 corner structural columns + atrium core
        const corners: Array<[number, number]> = [
          [-4.15, -3.15],
          [4.15, -3.15],
          [-4.15, 3.15],
          [4.15, 3.15],
        ];
        for (const [px, pz] of corners) {
          const p = new THREE.Mesh(pillarGeo, pillarMat);
          p.position.set(px, 0.57, pz);
          group.add(p);
        }

        const core = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.9, 1.6)), coreMat);
        core.position.set(0, 0.56, 0);
        group.add(core);

        // Glass curtain walls (subtle transparent perimeter)
        const gFront = new THREE.Mesh(glassFrontGeo, glassMat);
        gFront.position.set(0, 0.52, 3.38);
        gFront.renderOrder = 3;
        group.add(gFront);

        const gBack = new THREE.Mesh(glassFrontGeo, glassMat);
        gBack.position.set(0, 0.52, -3.38);
        gBack.renderOrder = 3;
        group.add(gBack);

        const gLeft = new THREE.Mesh(glassSideGeo, glassMat);
        gLeft.position.set(-4.38, 0.52, 0);
        gLeft.renderOrder = 3;
        group.add(gLeft);

        const gRight = new THREE.Mesh(glassSideGeo, glassMat);
        gRight.position.set(4.38, 0.52, 0);
        gRight.renderOrder = 3;
        group.add(gRight);

        // Interior room blocks reflecting actual registered spaces count/availability
        const floorSpaces = spaces.filter((s) => s.floorId === floor.id);
        const isAuditoriumFloor =
          floor.code === 'PISO-01' ||
          floor.code === 'PISO-02' ||
          floorSpaces.some((s) => s.category === 'Auditorio' || s.name.toLowerCase().includes('auditorio'));
        const isLibraryFloor =
          floor.code === 'PISO-01' ||
          floorSpaces.some((s) => s.category === 'Biblioteca' || s.name.toLowerCase().includes('biblioteca'));
        const isTerraceFloor =
          floor.code === 'PISO-04' ||
          floor.code === 'PISO-07' ||
          floorSpaces.some((s) => s.name.toLowerCase().includes('terraza'));

        const blockGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.42, 1.05));
        const maxBlocks = Math.min(floorSpaces.length, 10);
        for (let idx = 0; idx < maxBlocks; idx++) {
          const sp = floorSpaces[idx];
          if (sp.category === 'Auditorio' || sp.category === 'Biblioteca' || sp.category === 'Terraza / Alimentación') continue;
          const color =
            sp.availability === 'En formación'
              ? 0xd97706
              : sp.availability === 'En limpieza'
                ? 0x2563eb
                : sp.availability === 'Mantenimiento'
                  ? 0xdc2626
                  : 0x10b981;
          const bMat = trackMat(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.12 }));
          const bMesh = new THREE.Mesh(blockGeo, bMat);
          const row = idx < 5 ? -2.25 : 2.25;
          const colX = -3.0 + (idx % 5) * 1.5;
          bMesh.position.set(colX, 0.34, row);
          group.add(bMesh);
        }

        // Auditorios (Piso 1 y Piso 2): stepped acoustic auditorium wing & readable plaque
        if (isAuditoriumFloor) {
          const audGroup = new THREE.Group();
          const audBaseMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45, metalness: 0.18 }));
          const audTierMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5, metalness: 0.12 }));
          const audStageMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.2 }));

          const audBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 0.24, 2.3)), audBaseMat);
          audBase.position.set(-2.35, 0.22, 1.85);
          audGroup.add(audBase);

          for (let tier = 0; tier < 3; tier++) {
            const seatRow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.12, 0.38)), audTierMat);
            seatRow.position.set(-2.35, 0.38 + tier * 0.11, 2.45 - tier * 0.48);
            audGroup.add(seatRow);
          }

          const stage = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.28, 0.5)), audStageMat);
          stage.position.set(-2.35, 0.38, 1.0);
          audGroup.add(stage);

          const audTex = trackTex(createFeatureLabelTexture('AUDITORIO', '#1e3a8a', '#ffffff', maxAniso));
          const audBadge = new THREE.Mesh(
            trackGeo(new THREE.PlaneGeometry(1.9, 0.48)),
            trackMat(new THREE.MeshBasicMaterial({ map: audTex, side: THREE.DoubleSide }))
          );
          audBadge.position.set(-2.35, 1.08, 3.45);
          audGroup.add(audBadge);

          group.add(audGroup);
        }

        // Biblioteca (Piso 1): estanterías, mesas de lectura y placa BIBLIOTECA
        if (isLibraryFloor) {
          const libGroup = new THREE.Group();
          const libFloorMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7, metalness: 0.05 }));
          const shelfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.72, metalness: 0.08 }));
          const deskMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.1 }));

          const libZone = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 0.12, 2.2)), libFloorMat);
          libZone.position.set(2.35, 0.16, 1.85);
          libGroup.add(libZone);

          for (let sIdx = 0; sIdx < 3; sIdx++) {
            const shelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.52, 1.5)), shelfMat);
            shelf.position.set(1.4 + sIdx * 0.52, 0.42, 1.65);
            libGroup.add(shelf);
          }

          for (const dz of [1.3, 2.35]) {
            const table = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 0.24, 0.52)), deskMat);
            table.position.set(3.25, 0.28, dz);
            libGroup.add(table);
          }

          const libTex = trackTex(createFeatureLabelTexture('BIBLIOTECA', '#78350f', '#fef3c7', maxAniso));
          const libBadge = new THREE.Mesh(
            trackGeo(new THREE.PlaneGeometry(1.9, 0.48)),
            trackMat(new THREE.MeshBasicMaterial({ map: libTex, side: THREE.DoubleSide }))
          );
          libBadge.position.set(2.35, 1.08, 3.45);
          libGroup.add(libBadge);

          group.add(libGroup);
        }

        // Terrazas (Piso 4 y Piso 7): UNA A CADA LADO DEL PISO (Izquierda -X y Derecha +X, nunca juntas)
        // Desplazadas ligeramente al frente (z = +0.90) para dejar libre la torre de escaleras de emergencia en z = [-3.35, -1.35]
        if (isTerraceFloor) {
          const deckMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.82, metalness: 0.08 }));
          const parapetMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7, metalness: 0.06 }));
          const steelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.75 }));
          const plantMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, metalness: 0.0 }));
          const planterMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85, metalness: 0.05 }));

          const terraceSides: Array<{ xOffset: number; dir: number; label: string }> = [
            { xOffset: -5.65, dir: -1, label: 'TERRAZA IZQ.' },
            { xOffset: 5.65, dir: 1, label: 'TERRAZA DER.' },
          ];

          for (const side of terraceSides) {
            const tGroup = new THREE.Group();
            tGroup.position.set(side.xOffset, 0, 0.9);

            // Tiled open terrace deck slab
            const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.18, 3.8)), deckMat);
            deck.castShadow = !isSoftwareGl;
            deck.receiveShadow = !isSoftwareGl;
            tGroup.add(deck);

            // Ochre outer parapet walls (3 open-air sides)
            const outerWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.44, 3.8)), parapetMat);
            outerWall.position.set(side.dir * 1.12, 0.31, 0);
            tGroup.add(outerWall);

            const frontWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.44, 0.16)), parapetMat);
            frontWall.position.set(0, 0.31, 1.82);
            tGroup.add(frontWall);

            const backWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.44, 0.16)), parapetMat);
            backWall.position.set(0, 0.31, -1.82);
            tGroup.add(backWall);

            // Open pergola canopy beams overhead
            const post1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.88, 0.08)), pillarMat);
            post1.position.set(side.dir * 1.05, 0.52, 1.72);
            tGroup.add(post1);

            const post2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.88, 0.08)), pillarMat);
            post2.position.set(side.dir * 1.05, 0.52, -1.72);
            tGroup.add(post2);

            for (let lz = -1.4; lz <= 1.4; lz += 0.7) {
              const slat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.25, 0.05, 0.14)), steelMat);
              slat.position.set(0, 0.95, lz);
              tGroup.add(slat);
            }

            // Stainless-steel dining tables & green planters
            for (const tz of [-0.82, 0.82]) {
              const table = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.24, 0.85)), steelMat);
              table.position.set(-side.dir * 0.18, 0.21, tz);
              tGroup.add(table);
            }

            const planter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.24, 1.15)), planterMat);
            planter.position.set(side.dir * 0.76, 0.21, 0);
            tGroup.add(planter);

            const foliage = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.34, 1.0)), plantMat);
            foliage.position.set(side.dir * 0.76, 0.44, 0);
            tGroup.add(foliage);

            // Readable TERRAZA plaque
            const tTex = trackTex(createFeatureLabelTexture(side.label, '#fffbeb', '#92400e', maxAniso));
            const tBadge = new THREE.Mesh(
              trackGeo(new THREE.PlaneGeometry(1.75, 0.44)),
              trackMat(new THREE.MeshBasicMaterial({ map: tTex, side: THREE.DoubleSide }))
            );
            tBadge.position.set(side.dir * 1.24, 0.65, 0);
            tBadge.rotation.y = side.dir * (Math.PI / 2);
            tGroup.add(tBadge);

            group.add(tGroup);
          }
        }

        // Exterior Emergency Staircase Module (Piso 1 .. Piso 10, attached along right-rear facade x=4.4..6.56, z=-3.35..-1.35)
        const stairGroup = new THREE.Group();

        // Beige stone-clad corner pilasters connecting stair tower to glass curtain wall
        for (const pz of [-1.36, -3.34]) {
          const pilaster = new THREE.Mesh(stairPilasterGeo, stairPilasterMat);
          pilaster.position.set(4.46, 0.52, pz);
          stairGroup.add(pilaster);
        }

        // Dark vertical steel support columns inside outer stair bay
        for (const cz of [-1.48, -3.22]) {
          const col = new THREE.Mesh(stairColGeo, stairSteelDarkMat);
          col.position.set(5.96, 0.52, cz);
          stairGroup.add(col);
        }

        // Floor-level inner bridge landing & emergency exit doorway on building side wall
        const innerLanding = new THREE.Mesh(stairInnerLandingGeo, stairPilasterMat);
        innerLanding.position.set(4.76, 0.0, -2.35);
        stairGroup.add(innerLanding);

        const exitDoor = new THREE.Mesh(stairExitDoorGeo, stairExitSignMat);
        exitDoor.position.set(4.41, 0.48, -2.35);
        stairGroup.add(exitDoor);

        // Horizontal structural tie beams connecting inner slab to outer column bay
        for (const tz of [-1.38, -3.32]) {
          const tie = new THREE.Mesh(stairTieBeamGeo, stairTrimMat);
          tie.position.set(5.2, 0.01, tz);
          stairGroup.add(tie);
        }

        if (floor.sortOrder === 1) {
          // Ground-to-Piso 1 starter run descending to exterior plaza
          addSlopedFlight(
            stairGroup,
            flightPanelGeoA,
            flightRailGeoA,
            flightSoffitGeoA,
            5.5,
            -0.21,
            -1.85,
            -flightAngleA,
            5.06,
            5.94,
            0.03,
            -0.42
          );
        }

        if (floor.sortOrder < 10) {
          // Outer cantilevered chamfered mid-landing at y = 0.52 with plum-framed beige guardrails
          const midDeck = new THREE.Mesh(chamferDeckGeo, stairPilasterMat);
          midDeck.position.set(5.88, 0.46, -2.35);
          midDeck.castShadow = !isSoftwareGl;
          midDeck.receiveShadow = !isSoftwareGl;
          stairGroup.add(midDeck);
          addChamferedBalconyRail(stairGroup, 0.52);

          // Lower switchback flight (front lane z = -1.85): inner floor landing -> outer chamfered mid-landing
          addSlopedFlight(
            stairGroup,
            flightPanelGeoA,
            flightRailGeoA,
            flightSoffitGeoA,
            5.5,
            0.29,
            -1.85,
            flightAngleA,
            5.06,
            5.94,
            0.05,
            0.51
          );

          // Upper switchback flight (back lane z = -2.85): outer chamfered mid-landing -> next floor inner landing
          addSlopedFlight(
            stairGroup,
            flightPanelGeoB,
            flightRailGeoB,
            flightSoffitGeoB,
            5.5,
            0.78,
            -2.85,
            -flightAngleB,
            5.94,
            5.06,
            0.52,
            1.02
          );
        } else {
          // Piso 10 top arrival balcony with chamfered safety parapet
          const topDeck = new THREE.Mesh(chamferDeckGeo, stairPilasterMat);
          topDeck.position.set(5.88, -0.05, -2.35);
          stairGroup.add(topDeck);
          addChamferedBalconyRail(stairGroup, 0.01);
        }

        group.add(stairGroup);
      }

      // Roof cap above Piso 10
      if (floor.code === 'PISO-10') {
        const roofMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7, metalness: 0.15 }));
        const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.0, 0.24, 7.0)), roofMat);
        roof.position.set(0, 1.12, 0);
        group.add(roof);
      }

      // Readable floor plaque aligned cleanly at front-right corner (never overlapping right-side terraces)
      const shortCode = isSotano ? 'SÓT' : isExteriores ? 'EXT' : `P${floor.sortOrder}`;
      const countSpaces = spaces.filter((s) => s.floorId === floor.id).length;
      const badgeSubtitle = isSotano
        ? 'Parqueadero'
        : isExteriores
          ? 'Exteriores'
          : `${countSpaces} ${countSpaces === 1 ? 'área' : 'áreas'}`;
      const badgeTex = trackTex(createFloorBadgeTexture(shortCode, badgeSubtitle, false, maxAniso));
      const badgeMat = trackMat(new THREE.MeshBasicMaterial({ map: badgeTex }));
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(isExteriores ? -5.8 : 5.45, 0.42, isExteriores ? 3.85 : 3.85);
      badgeMesh.rotation.y = isExteriores ? 0.35 : 0.45;
      group.add(badgeMesh);

      // Raycast hit proxy (wider on Piso 4 & 7 so clicking either side terrace selects the floor)
      const hitMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));
      const hitBox = new THREE.Mesh(hitGeo, hitMat);
      if (isExteriores) {
        hitBox.scale.set(1.22, 0.2, 1.22);
        hitBox.position.y = 0.06;
      } else if (floor.code === 'PISO-04' || floor.code === 'PISO-07') {
        hitBox.scale.set(1.48, 1.0, 1.0);
        hitBox.position.y = 0.45;
      } else if (!isSotano) {
        hitBox.scale.set(1.22, 1.0, 1.0);
        hitBox.position.set(0.85, 0.45, 0);
      } else {
        hitBox.position.y = 0.45;
      }
      hitBox.layers.set(1);
      hitBox.userData = { floorId: floor.id, floorName: floor.name };
      group.add(hitBox);
      hitMeshes.push(hitBox);

      scene.add(group);
      floorNodes.push({
        floor,
        group,
        slabMesh,
        hitBox,
        badgeMesh,
        baseY,
        explodedY,
      });
    });

    // Update selection highlight & badges cleanly
    const updateSelectionVisuals = () => {
      const selId = selectedFloorIdRef.current;
      for (const node of floorNodes) {
        const isSel = node.floor.id === selId;
        const mat = node.slabMesh.material as THREE.MeshStandardMaterial;
        if (node.floor.code === 'SOTANO') {
          mat.emissive.setHex(isSel ? 0x065f46 : 0x000000);
          mat.emissiveIntensity = isSel ? 0.35 : 0;
        } else if (node.floor.code === 'EXTERIORES') {
          mat.color.setHex(isSel ? 0x34d399 : 0xdbeafe);
        } else {
          mat.color.setHex(isSel ? 0xa7f3d0 : 0xf8fafc);
          mat.emissive.setHex(isSel ? 0x047857 : 0x000000);
          mat.emissiveIntensity = isSel ? 0.18 : 0;
        }

        const isSotano = node.floor.code === 'SOTANO';
        const isExteriores = node.floor.code === 'EXTERIORES';
        const shortCode = isSotano ? 'SÓT' : isExteriores ? 'EXT' : `P${node.floor.sortOrder}`;
        const countSpaces = spaces.filter((s) => s.floorId === node.floor.id).length;
        const badgeSubtitle = isSotano
          ? 'Parqueadero'
          : isExteriores
            ? 'Exteriores'
            : `${countSpaces} ${countSpaces === 1 ? 'área' : 'áreas'}`;

        const badgeMat = node.badgeMesh.material as THREE.MeshBasicMaterial;
        const oldTex = badgeMat.map;
        const newTex = trackTex(createFloorBadgeTexture(shortCode, badgeSubtitle, isSel, maxAniso));
        badgeMat.map = newTex;
        badgeMat.needsUpdate = true;
        if (oldTex) oldTex.dispose();
      }
      requestRender();
    };
    rebuildHighlightRef.current = updateSelectionVisuals;

    // Camera transition state
    let camAnimActive = false;
    const camTargetPos = new THREE.Vector3(...PRESET_VIEWS.general.pos);
    const camTargetLook = new THREE.Vector3(...PRESET_VIEWS.general.target);

    // On-demand render scheduler (with software WebGL afterDraw pacing)
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    let lastClock = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastClock) / 1000, 0.1);
        lastClock = now;

        let needsMoreFrames = false;

        // Smooth exploded-view interpolation
        const wantExploded = explodedRef.current;
        for (const node of floorNodes) {
          const targetY = wantExploded ? node.explodedY : node.baseY;
          if (Math.abs(node.group.position.y - targetY) > 0.005) {
            node.group.position.y = THREE.MathUtils.damp(node.group.position.y, targetY, 8, dt);
            needsMoreFrames = true;
          } else {
            node.group.position.y = targetY;
          }
        }

        // Smooth camera preset glide
        if (camAnimActive) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, 7, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, 7, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, camTargetPos.z, 7, dt);

          controls.target.x = THREE.MathUtils.damp(controls.target.x, camTargetLook.x, 7, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, camTargetLook.y, 7, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, camTargetLook.z, 7, dt);

          if (
            camera.position.distanceTo(camTargetPos) < 0.04 &&
            controls.target.distanceTo(camTargetLook) < 0.04
          ) {
            camera.position.copy(camTargetPos);
            controls.target.copy(camTargetLook);
            camAnimActive = false;
          } else {
            needsMoreFrames = true;
          }
        }

        const controlsChanged = controls.update();
        if (controlsChanged) needsMoreFrames = true;

        // Keep floor badges facing camera horizontally
        for (const node of floorNodes) {
          node.badgeMesh.getWorldPosition(_badgeWorldPos);
          _vecTarget.set(camera.position.x, _badgeWorldPos.y, camera.position.z);
          node.badgeMesh.lookAt(_vecTarget);
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    presetTriggerRef.current = (preset: CameraPreset) => {
      const cfg = PRESET_VIEWS[preset];
      camTargetPos.set(...cfg.pos);
      camTargetLook.set(...cfg.target);
      camAnimActive = true;
      requestRender();
    };

    const handleControlStart = () => {
      camAnimActive = false;
    };
    const handleControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('change', handleControlChange);

    // Raycasting for click-to-select floor & hover tooltip
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6) return; // Ignore drag-orbit gestures
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        const floorId = hits[0].object.userData.floorId as number | undefined;
        if (floorId !== undefined) {
          onSelectFloorRef.current(floorId);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        const name = String(hits[0].object.userData.floorName || '');
        renderer.domElement.style.cursor = 'pointer';
        setHoveredName(name);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredName(null);
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 390;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    // Initial highlight + render
    updateSelectionVisuals();
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('change', handleControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      for (const g of geometriesToDispose) g.dispose();
      for (const m of materialsToDispose) m.dispose();
      for (const t of texturesToDispose) t.dispose();
      renderer.dispose();
    };
    // Re-initialize only if floor list changes structurally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors.length]);

  useEffect(() => {
    rebuildHighlightRef.current?.();
  }, [exploded]);

  function applyPreset(preset: CameraPreset) {
    setActivePreset(preset);
    presetTriggerRef.current?.(preset);
  }

  function toggleExplode() {
    setExploded((prev) => !prev);
  }

  const selectedFloor = floors.find((f) => f.id === selectedFloorId);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Vista 3D Interactiva Torre Norte (Sótano y Parqueadero a Piso 10)
            </h3>
            <p className="text-[11px] text-slate-500">
              Arrastre para rotar, use la rueda para acercar y haga clic en cualquier nivel. Incluye Sótano/Parqueadero, Biblioteca (P1), Auditorios (P1 y P2), Terrazas separadas a cada lado (P4 y P7) y Escaleras de Emergencia exteriores.
            </p>
          </div>
        </div>
        <div className="text-xs font-medium text-slate-700">
          {hoveredName ? (
            <span className="text-blue-700 font-semibold">Nivel señalado: {hoveredName}</span>
          ) : selectedFloor ? (
            <span className="text-emerald-800 font-semibold">Seleccionado: {selectedFloor.name}</span>
          ) : null}
        </div>
      </div>

      <div className="relative w-full h-[360px] sm:h-[420px] bg-slate-100">
        {/* Isolated WebGL mount container */}
        <div ref={mountRef} className="w-full h-full" />

        {/* Unified compact bottom control dock (zero backdrop-filter over WebGL) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[95%] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setControlsCollapsed((v) => !v)}
            className="mb-1 inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-t-md hover:bg-slate-50"
          >
            {controlsCollapsed ? (
              <>
                <ChevronUp className="w-3 h-3" /> Controles 3D
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Ocultar barra
              </>
            )}
          </button>

          {!controlsCollapsed && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 bg-white/95 border border-slate-300 rounded-xl shadow-sm text-xs">
              <button
                type="button"
                onClick={() => applyPreset('general')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activePreset === 'general'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Torre Completa
              </button>
              <button
                type="button"
                onClick={() => applyPreset('stairs')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activePreset === 'stairs'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Escaleras Emerg.
              </button>
              <button
                type="button"
                onClick={() => applyPreset('parking')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activePreset === 'parking'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Parqueadero / Sótano
              </button>
              <button
                type="button"
                onClick={() => applyPreset('front')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activePreset === 'front'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Vista Frontal
              </button>
              <span className="h-4 w-px bg-slate-300 mx-0.5 hidden sm:inline-block" />
              <button
                type="button"
                onClick={toggleExplode}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  exploded
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {exploded ? 'Unir Pisos' : 'Separar Pisos'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExploded(false);
                  applyPreset('general');
                }}
                title="Restablecer vista 3D"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restablecer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
