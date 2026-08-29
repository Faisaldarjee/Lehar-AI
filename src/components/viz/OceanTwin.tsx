import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Play, 
  Pause, 
  Compass, 
  Volume2, 
  VolumeX, 
  Fish, 
  Wind, 
  Waves, 
  Glasses, 
  X,
  Camera
} from 'lucide-react';
import { speakText, stopVoice } from '../../services/voiceSynthesis';

interface OceanTwinProps {
  selectedFloatId?: string | null;
  profileData?: Array<{ depth?: number | null; temperature?: number | null; salinity?: number | null }>;
  isMHWMode?: boolean;
  onClose?: () => void;
}

interface FishSpeciesData {
  id: string;
  name: string;
  scientificName: string;
  localName: string;
  depthRange: string;
  optimalSST: string;
  commercialTier: string;
  gearType: string;
  diet: string;
  description: string;
}

const SPECIES_KNOWLEDGE: Record<string, FishSpeciesData> = {
  tuna: {
    id: 'tuna',
    name: 'Yellowfin Tuna',
    scientificName: 'Thunnus albacares',
    localName: 'Kera / Kuppa Tuna',
    depthRange: '30m – 80m (Thermocline Front)',
    optimalSST: '24.5°C – 28.5°C',
    commercialTier: 'Tier-1 High-Value Export',
    gearType: 'Deep Oceanic Longline & Trolling',
    diet: 'Squid, flying fish, pelagic crustaceans',
    description: 'High-speed hydrodynamic apex predator hunting along the thermocline temperature break where cold nutrient upwelling meets warm surface waters.',
  },
  manta: {
    id: 'manta',
    name: 'Oceanic Manta Ray',
    scientificName: 'Mobula birostris',
    localName: 'Kombu Thirandi / Shingro',
    depthRange: '5m – 40m (Sunlit Water Column)',
    optimalSST: '25.0°C – 29.5°C',
    commercialTier: 'Ecological Flagship (Protected)',
    gearType: 'Non-Targeted / Conservation Watch',
    diet: 'Planktonic copepods, krill blooms',
    description: 'Majestic pelagic filter feeder performing barrel-roll feeding maneuvers in plankton-rich tidal rips and coral reef passages.',
  },
  mackerel: {
    id: 'mackerel',
    name: 'Indian Mackerel',
    scientificName: 'Rastrelliger kanagurta',
    localName: 'Bangda',
    depthRange: '10m – 30m (Epipelagic)',
    optimalSST: '25.5°C – 29.0°C',
    commercialTier: 'High-Volume Coastal Staple',
    gearType: 'Purse Seine & Ring Net',
    diet: 'Phytoplankton blooms, diatoms, larvae',
    description: 'Forms massive, synchronized rotating baitballs to confuse predators and maximize filter-feeding efficiency in high-chlorophyll zones.',
  },
  jellyfish: {
    id: 'jellyfish',
    name: 'Bioluminescent Sea Jelly',
    scientificName: 'Aequorea victoria',
    localName: 'Zal Phul',
    depthRange: '40m – 120m (Mesopelagic Twilight)',
    optimalSST: '22.0°C – 27.0°C',
    commercialTier: 'Bio-Indicator Species',
    gearType: 'Non-Targeted',
    diet: 'Micro-zooplankton, fish eggs',
    description: 'Drifting cnidarian that glows with cyan-green bioluminescence when agitated by ocean currents and thermohaline shears.',
  },
};

export const OceanTwin: React.FC<OceanTwinProps> = ({
  selectedFloatId,
  profileData = [],
  isMHWMode = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Simulation Controls & State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'swim' | 'cinematic'>('orbit');
  const [selectedSpecies, setSelectedSpecies] = useState<FishSpeciesData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [currentDepthM, setCurrentDepthM] = useState<number>(32);
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);

  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;
  const cameraModeRef = useRef<'orbit' | 'swim' | 'cinematic'>('orbit');
  cameraModeRef.current = cameraMode;

  // Web Audio Context for Procedural Hydro-Acoustic Ambience & Sonar
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Live Telemetry Readouts
  const telemetry = useMemo(() => {
    const validPoint = profileData.find(p => p && p.temperature != null && p.depth != null);
    return {
      floatId: selectedFloatId || 'INCOIS-ARGO-2902187',
      depthM: validPoint?.depth != null ? Math.round(validPoint.depth) : 32,
      tempC: validPoint?.temperature != null ? Number(validPoint.temperature.toFixed(1)) : 27.8,
      salPSU: validPoint?.salinity != null ? Number(validPoint.salinity.toFixed(1)) : 35.4,
      windKts: 14,
      swellM: 1.7,
      seaState: 'Moderate (Douglas 3)',
    };
  }, [profileData, selectedFloatId]);

  // Check WebXR hardware support
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      (navigator as any).xr?.isSessionSupported?.('immersive-vr')?.then((supported: boolean) => {
        setVrSupported(supported);
      }).catch(() => setVrSupported(false));
    }
  }, []);

  // Web Audio Procedural Hydro-Acoustic Synthesizer
  useEffect(() => {
    if (!soundEnabled) {
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend().catch(() => {});
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        // 1. Deep Submarine Swell White Noise Generator
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
          b6 = white * 0.115926;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 280;

        const gain = ctx.createGain();
        gain.gain.value = 0.5;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(0);

        // 2. Periodic ARGO CTD Sonar Ping (Every 5 seconds)
        const sonarInterval = setInterval(() => {
          if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
          try {
            const osc = ctx.createOscillator();
            const sGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(840, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.35);
            sGain.gain.setValueAtTime(0.08, ctx.currentTime);
            sGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(sGain);
            sGain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.36);
          } catch (err) {}
        }, 5000);

        return () => clearInterval(sonarInterval);
      } else {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio setup note:', e);
    }
  }, [soundEnabled]);

  // Main AAA-Grade Three.js Living Ocean Scene
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let width = currentMount.clientWidth || 800;
    let height = currentMount.clientHeight || 500;

    // 1. Scene & Depth Fog Gradient
    const scene = new THREE.Scene();
    const deepOceanColor = isMHWMode ? 0x071e29 : 0x021124;
    scene.background = new THREE.Color(deepOceanColor);
    scene.fog = new THREE.FogExp2(deepOceanColor, 0.022);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 4, 30);

    // 3. Renderer with High Dynamic Range Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.xr.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // 4. Volumetric Underwater Lighting & Sun God Rays
    const ambientLight = new THREE.AmbientLight(0x0284c7, 0.9);
    scene.add(ambientLight);

    const sunDirectional = new THREE.DirectionalLight(0x7dd3fc, 3.2);
    sunDirectional.position.set(15, 60, 15);
    scene.add(sunDirectional);

    // 4b. Volumetric Sun God Rays Shafts (Translucent light cones piercing the surface)
    const godRayGroup = new THREE.Group();
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 9; i++) {
      const rayGeo = new THREE.ConeGeometry(2.5 + Math.random() * 2, 45, 12, 1, true);
      const rayMesh = new THREE.Mesh(rayGeo, rayMat);
      const rx = (Math.random() - 0.5) * 45;
      const rz = (Math.random() - 0.5) * 45;
      rayMesh.position.set(rx, 2, rz);
      rayMesh.rotation.x = Math.PI + (Math.random() - 0.5) * 0.3;
      rayMesh.rotation.z = (Math.random() - 0.5) * 0.3;
      godRayGroup.add(rayMesh);
    }
    scene.add(godRayGroup);

    // 5. Water Surface Plane (0m) with Dynamic Waves & Caustics
    const surfaceGeo = new THREE.PlaneGeometry(120, 120, 96, 96);
    const surfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      metalness: 0.85,
      roughness: 0.12,
      transmission: 0.6,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const oceanSurface = new THREE.Mesh(surfaceGeo, surfaceMat);
    oceanSurface.rotation.x = -Math.PI / 2;
    oceanSurface.position.y = 16.0;
    scene.add(oceanSurface);

    // 6. Detailed Bathymetric Seabed Terrain (-24m)
    const seabedGeo = new THREE.PlaneGeometry(140, 140, 64, 64);
    const seabedPos = seabedGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < seabedPos.length; i += 3) {
      const x = seabedPos[i];
      const y = seabedPos[i + 1];
      // Generate rolling sand dunes and deep sea ridges
      seabedPos[i + 2] = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 3.5 + Math.sin(x * 0.04 + y * 0.04) * 2.2;
    }
    seabedGeo.computeVertexNormals();

    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0x0a3342,
      roughness: 0.88,
      metalness: 0.15,
      flatShading: true,
    });
    const seabed = new THREE.Mesh(seabedGeo, seabedMat);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -22.0;
    scene.add(seabed);

    // 7. Rich Coral Reef Garden & Swaying Sea Flora
    const coralReefGroup = new THREE.Group();
    
    // Brain Corals (Organic bumpy geodesics)
    const brainCoralMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.1 });
    const pinkCoralMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.6, metalness: 0.1 });
    const emeraldCoralMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5, metalness: 0.2 });

    for (let i = 0; i < 35; i++) {
      const isPink = i % 3 === 0;
      const isEmerald = i % 3 === 1;
      const coralGeo = new THREE.DodecahedronGeometry(1.2 + Math.random() * 1.5, 2);
      const coral = new THREE.Mesh(coralGeo, isPink ? pinkCoralMat : isEmerald ? emeraldCoralMat : brainCoralMat);
      const cx = (Math.random() - 0.5) * 80;
      const cz = (Math.random() - 0.5) * 80;
      coral.position.set(cx, -20.5 + Math.sin(cx * 0.1) * 1.2, cz);
      coral.scale.set(1 + Math.random() * 0.5, 0.7 + Math.random() * 0.6, 1 + Math.random() * 0.5);
      coralReefGroup.add(coral);
    }

    // Swaying Seaweed / Kelp Ribbons
    const seaweedMeshes: THREE.Mesh[] = [];
    const seaweedMat = new THREE.MeshStandardMaterial({ color: 0x059669, side: THREE.DoubleSide, roughness: 0.3 });
    for (let i = 0; i < 40; i++) {
      const sGeo = new THREE.PlaneGeometry(0.6, 7.0 + Math.random() * 4.0, 4, 12);
      const sMesh = new THREE.Mesh(sGeo, seaweedMat);
      const sx = (Math.random() - 0.5) * 75;
      const sz = (Math.random() - 0.5) * 75;
      sMesh.position.set(sx, -18.0, sz);
      sMesh.rotation.y = Math.random() * Math.PI;
      seaweedMeshes.push(sMesh);
      coralReefGroup.add(sMesh);
    }
    scene.add(coralReefGroup);

    // 8. Detailed ARGO Robot Float Model
    const argoFloat = new THREE.Group();
    // Yellow Aluminum Hull
    const hullGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.4, 24);
    const hullMat = new THREE.MeshPhysicalMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.25, clearcoat: 0.8 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    argoFloat.add(hull);

    // Black Rubber Stability Ring
    const collarGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.4, 24);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 0.6;
    argoFloat.add(collar);

    // CTD Sensor Probe Ring (Conductivity-Temperature-Depth)
    const ctdGeo = new THREE.TorusGeometry(0.4, 0.08, 12, 24);
    const ctdMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8 });
    const ctd = new THREE.Mesh(ctdGeo, ctdMat);
    ctd.position.y = -1.25;
    ctd.rotation.x = Math.PI / 2;
    argoFloat.add(ctd);

    // Satellite Iridium Antenna
    const antGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.y = 1.9;
    argoFloat.add(ant);

    // Flashing Comms Beacon LED
    const beaconGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 2.75;
    argoFloat.add(beacon);

    argoFloat.position.set(14, 13.5, -10);
    scene.add(argoFloat);

    // 9. Procedurally Sculpted Anatomical Marine Life
    // 9a. Yellowfin Tuna Shoal (Metallic blue apex predators with yellow finlets)
    const tunaGroup = new THREE.Group();
    const tunaCount = 7;
    const tunaMeshes: THREE.Group[] = [];

    const createTunaModel = (index: number) => {
      const tuna = new THREE.Group();

      // Fusiform Streamlined Hydrodynamic Body
      const bodyGeo = new THREE.ConeGeometry(0.65, 3.4, 16);
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x075985,
        emissiveIntensity: 0.2,
        metalness: 0.85,
        roughness: 0.15,
        clearcoat: 1.0,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.z = Math.PI / 2;
      tuna.add(body);

      // Yellow Sickle Dorsal Fin
      const finGeo = new THREE.ConeGeometry(0.3, 1.1, 8);
      const finMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.3 });
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.set(0.3, 0.8, 0);
      fin.rotation.z = -0.5;
      tuna.add(fin);

      // Yellow Sickle Ventral Fin
      const vFin = new THREE.Mesh(finGeo, finMat);
      vFin.position.set(0.3, -0.8, 0);
      vFin.rotation.z = 0.5;
      vFin.rotation.x = Math.PI;
      tuna.add(vFin);

      // Two-Lobed Crescent Tail Fin
      const tailUpper = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 6), finMat);
      tailUpper.position.set(-1.8, 0.4, 0);
      tailUpper.rotation.z = -0.6;
      tuna.add(tailUpper);

      const tailLower = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 6), finMat);
      tailLower.position.set(-1.8, -0.4, 0);
      tailLower.rotation.z = 0.6;
      tuna.add(tailLower);

      (tuna as any).userData = { species: 'tuna', index };
      return tuna;
    };

    for (let i = 0; i < tunaCount; i++) {
      const tuna = createTunaModel(i);
      tunaMeshes.push(tuna);
      tunaGroup.add(tuna);
    }
    scene.add(tunaGroup);

    // 9b. Majestic Gliding Oceanic Manta Ray (6m wingspan pelagic glider)
    const manta = new THREE.Group();
    const mantaBodyGeo = new THREE.CylinderGeometry(0.2, 1.2, 3.2, 8);
    const mantaMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
    const mantaBody = new THREE.Mesh(mantaBodyGeo, mantaMat);
    mantaBody.rotation.z = Math.PI / 2;
    mantaBody.scale.set(0.25, 1, 1.4);
    manta.add(mantaBody);

    // Left Wing
    const wingGeo = new THREE.PlaneGeometry(5.0, 3.5, 8, 8);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, side: THREE.DoubleSide, roughness: 0.3 });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(0, 0, 3.0);
    leftWing.rotation.x = Math.PI / 2;
    manta.add(leftWing);

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0, 0, -3.0);
    rightWing.rotation.x = -Math.PI / 2;
    manta.add(rightWing);

    // Long Whip Tail
    const mTailGeo = new THREE.CylinderGeometry(0.04, 0.01, 4.5, 6);
    const mTail = new THREE.Mesh(mTailGeo, mantaMat);
    mTail.position.set(-2.8, 0, 0);
    mTail.rotation.z = Math.PI / 2;
    manta.add(mTail);

    (manta as any).userData = { species: 'manta' };
    manta.position.set(0, 8, -5);
    scene.add(manta);

    // 9c. Indian Mackerel Vortex Baitball (50+ iridescent fish)
    const mackerelGroup = new THREE.Group();
    const mackerelCount = 52;
    const mackerelMeshes: THREE.Mesh[] = [];
    const mackGeo = new THREE.ConeGeometry(0.16, 1.1, 8);
    const mackMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.1,
    });

    for (let i = 0; i < mackerelCount; i++) {
      const mack = new THREE.Mesh(mackGeo, mackMat);
      mack.rotation.z = Math.PI / 2;
      (mack as any).userData = { species: 'mackerel', index: i };
      mackerelMeshes.push(mack);
      mackerelGroup.add(mack);
    }
    mackerelGroup.position.set(-14, 6, -6);
    scene.add(mackerelGroup);

    // 9d. Translucent Bioluminescent Jellyfish Group
    const jellyGroup = new THREE.Group();
    const jellyMeshes: THREE.Group[] = [];
    const jellyMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      transmission: 0.7,
    });

    for (let j = 0; j < 6; j++) {
      const jelly = new THREE.Group();
      const bellGeo = new THREE.SphereGeometry(0.8 + Math.random() * 0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const bell = new THREE.Mesh(bellGeo, jellyMat);
      jelly.add(bell);

      // Trailing Tentacles
      for (let t = 0; t < 6; t++) {
        const tGeo = new THREE.CylinderGeometry(0.02, 0.01, 2.8 + Math.random() * 1.5, 4);
        const tentacle = new THREE.Mesh(tGeo, jellyMat);
        const tAngle = (t / 6) * Math.PI * 2;
        tentacle.position.set(Math.cos(tAngle) * 0.5, -1.4, Math.sin(tAngle) * 0.5);
        jelly.add(tentacle);
      }

      (jelly as any).userData = { species: 'jellyfish', index: j };
      const jx = (Math.random() - 0.5) * 40;
      const jy = -4.0 - Math.random() * 12.0;
      const jz = (Math.random() - 0.5) * 40;
      jelly.position.set(jx, jy, jz);
      jellyMeshes.push(jelly);
      jellyGroup.add(jelly);
    }
    scene.add(jellyGroup);

    // 10. 1,400+ Bioluminescent Plankton & Marine Snow Particles
    const pCount = 1400;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 100;
      pPositions[i + 1] = (Math.random() - 0.5) * 50;
      pPositions[i + 2] = (Math.random() - 0.5) * 100;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.22,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const planktonField = new THREE.Points(pGeo, pMat);
    scene.add(planktonField);

    // 11. Interactive Raycasting Target Finder
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allLivingObjects = [...tunaMeshes, manta, ...mackerelMeshes, ...jellyMeshes];
      const hits = raycaster.intersectObjects(allLivingObjects, true);

      if (hits.length > 0) {
        let rootObj: THREE.Object3D | null = hits[0].object;
        while (rootObj && !(rootObj as any).userData?.species && rootObj.parent) {
          rootObj = rootObj.parent;
        }
        const spKey = (rootObj as any)?.userData?.species;
        if (spKey && SPECIES_KNOWLEDGE[spKey]) {
          setHoveredObject(SPECIES_KNOWLEDGE[spKey].name);
        }
      } else {
        setHoveredObject(null);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allLivingObjects = [...tunaMeshes, manta, ...mackerelMeshes, ...jellyMeshes];
      const hits = raycaster.intersectObjects(allLivingObjects, true);

      if (hits.length > 0) {
        let rootObj: THREE.Object3D | null = hits[0].object;
        while (rootObj && !(rootObj as any).userData?.species && rootObj.parent) {
          rootObj = rootObj.parent;
        }
        const spKey = (rootObj as any)?.userData?.species;
        if (spKey && SPECIES_KNOWLEDGE[spKey]) {
          setSelectedSpecies(SPECIES_KNOWLEDGE[spKey]);
          speakText(`${SPECIES_KNOWLEDGE[spKey].name}. ${SPECIES_KNOWLEDGE[spKey].description}`, 'en');
        }
      }
    };

    // 12. Free-Swim Navigation & Mouse Drag Controls
    const keysPressed: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraAngle = 0.35;
    let cameraPitch = 0.2;
    let cameraDist = 32.0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e);
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      cameraAngle += dx * 0.005;
      cameraPitch = Math.max(-0.7, Math.min(0.85, cameraPitch + dy * 0.004));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDist = Math.max(6.0, Math.min(65.0, cameraDist + e.deltaY * 0.035));
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('click', handlePointerDown);

    // 13. 60 FPS Organic Fluid Simulation Loop
    let animId: number;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isPlayingRef.current) {
        clock += 0.016;

        // Wave surface caustics displacement
        const wavePos = surfaceGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < wavePos.length; i += 3) {
          const u = wavePos[i];
          const v = wavePos[i + 1];
          wavePos[i + 2] = Math.sin(u * 0.2 + clock * 2.2) * Math.cos(v * 0.2 + clock * 1.8) * 0.6;
        }
        surfaceGeo.attributes.position.needsUpdate = true;

        // Swaying Kelp Flora
        seaweedMeshes.forEach((sw, idx) => {
          sw.rotation.z = Math.sin(clock * 1.8 + idx * 0.4) * 0.25;
        });

        // ARGO Float Bobbing & LED Beacon
        argoFloat.position.y = 13.5 + Math.sin(clock * 2.0) * 0.4;
        beacon.material.color.setHex(Math.sin(clock * 6.0) > 0 ? 0x38bdf8 : 0x0369a1);

        // 1. Tuna Predatory Cruising & Spine Flexing
        const tunaRadius = 22.0;
        const tunaSpeed = clock * 0.95;
        tunaMeshes.forEach((tuna, idx) => {
          const offsetAngle = idx * 0.42;
          const tx = Math.cos(tunaSpeed + offsetAngle) * (tunaRadius + idx * 1.1);
          const tz = Math.sin(tunaSpeed + offsetAngle) * (tunaRadius + idx * 0.85);
          const ty = -4.0 + Math.sin(clock * 1.6 + idx) * 1.8;

          tuna.position.set(tx, ty, tz);
          tuna.rotation.y = -(tunaSpeed + offsetAngle) + Math.PI / 2;
          // Organic tail fin wag
          tuna.rotation.y += Math.sin(clock * 10.0 + idx) * 0.18;
        });

        // 2. Majestic Manta Ray Gliding with Flapping Wings
        const mantaAngle = clock * 0.35;
        manta.position.x = Math.cos(mantaAngle) * 18.0;
        manta.position.z = Math.sin(mantaAngle) * 18.0;
        manta.position.y = 7.0 + Math.sin(clock * 1.2) * 1.4;
        manta.rotation.y = -mantaAngle + Math.PI / 2;
        leftWing.rotation.z = Math.sin(clock * 2.2) * 0.35;
        rightWing.rotation.z = -Math.sin(clock * 2.2) * 0.35;

        // 3. Mackerel Baitball Swirling Vortex
        mackerelMeshes.forEach((mack, idx) => {
          const bAngle = clock * 1.8 + (idx / mackerelCount) * Math.PI * 2;
          const bRadius = 4.2 + Math.sin(clock * 2.5 + idx) * 1.1;
          const bY = 5.5 + Math.cos(clock * 1.6 + idx * 0.4) * 2.2;

          mack.position.set(Math.cos(bAngle) * bRadius, bY, Math.sin(bAngle) * bRadius);
          mack.rotation.y = -bAngle + Math.PI / 2;
        });

        // 4. Jellyfish Pulsing & Vertical Drifting
        jellyMeshes.forEach((jelly, idx) => {
          const pulse = 1.0 + Math.sin(clock * 3.0 + idx) * 0.22;
          jelly.scale.set(pulse, 1.0 / pulse, pulse);
          jelly.position.y += Math.sin(clock * 1.2 + idx) * 0.015;
        });

        // Plankton Drift
        planktonField.rotation.y += 0.0006;

        // Camera Modes
        if (cameraModeRef.current === 'cinematic') {
          // Guided Submarine Dive Tour
          const tourAngle = clock * 0.25;
          camera.position.x = Math.cos(tourAngle) * 26.0;
          camera.position.z = Math.sin(tourAngle) * 26.0;
          camera.position.y = -2.0 + Math.sin(clock * 0.4) * 8.0;
          camera.lookAt(0, -2, 0);
          setCurrentDepthM(Math.round(Math.abs(camera.position.y - 16) * 4));
        } else if (cameraModeRef.current === 'swim') {
          // First-Person Free-Swim
          const moveSpeed = 0.4;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

          if (keysPressed['w'] || keysPressed['arrowup']) camera.position.addScaledVector(forward, moveSpeed);
          if (keysPressed['s'] || keysPressed['arrowdown']) camera.position.addScaledVector(forward, -moveSpeed);
          if (keysPressed['a'] || keysPressed['arrowleft']) camera.position.addScaledVector(right, -moveSpeed);
          if (keysPressed['d'] || keysPressed['arrowright']) camera.position.addScaledVector(right, moveSpeed);
          if (keysPressed[' ']) camera.position.y = Math.min(15.0, camera.position.y + moveSpeed);
          if (keysPressed['shift'] || keysPressed['c']) camera.position.y = Math.max(-20.0, camera.position.y - moveSpeed);

          setCurrentDepthM(Math.round(Math.abs(camera.position.y - 16) * 4));
        } else {
          // Smooth Orbit Mode
          camera.position.x = Math.sin(cameraAngle) * Math.cos(cameraPitch) * cameraDist;
          camera.position.z = Math.cos(cameraAngle) * Math.cos(cameraPitch) * cameraDist;
          camera.position.y = Math.sin(cameraPitch) * cameraDist;
          camera.lookAt(0, 0, 0);
          setCurrentDepthM(Math.round(Math.abs(camera.position.y - 16) * 4));
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!currentMount) return;
      width = currentMount.clientWidth;
      height = currentMount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      dom.removeEventListener('click', handlePointerDown);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isMHWMode]);

  return (
    <div className="relative w-full h-full min-h-[540px] rounded-2xl overflow-hidden border border-cyan-500/40 bg-[#010915] shadow-2xl flex flex-col font-sans select-none">
      
      {/* 3D Living Ocean WebGL Viewport */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Dynamic Submarine Depth Tape / Gauge (Left HUD) */}
      <div className="absolute top-20 left-4 z-20 hidden md:flex flex-col items-center bg-[#071322]/90 backdrop-blur-xl px-2.5 py-3 rounded-2xl border border-cyan-500/40 text-cyan-300 font-mono text-[10px] shadow-2xl space-y-2 pointer-events-none">
        <span className="text-[9px] font-bold text-slate-400 uppercase">DEPTH</span>
        <div className="text-sm font-black text-white font-heading">{currentDepthM}m</div>
        <div className="w-1.5 h-28 bg-slate-800 rounded-full overflow-hidden relative">
          <div 
            className="w-full bg-gradient-to-b from-cyan-400 via-teal-400 to-amber-400 absolute top-0 transition-all duration-300 rounded-full"
            style={{ height: `${Math.min(100, (currentDepthM / 150) * 100)}%` }}
          />
        </div>
        <span className="text-[8px] text-slate-400">150m</span>
      </div>

      {/* Target Reticle Lock Indicator on Hover */}
      {hoveredObject && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-cyan-400/80 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="mt-2 px-2.5 py-1 rounded-lg bg-[#071322]/90 backdrop-blur-md border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold shadow-xl">
            🎯 Inspect: {hoveredObject}
          </div>
        </div>
      )}

      {/* Top Marine Atmosphere & Sensor Telemetry Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left Title Badge */}
        <div className="flex items-center gap-2.5 bg-[#071322]/95 backdrop-blur-xl px-4 py-2 rounded-2xl border border-cyan-500/40 text-white shadow-2xl pointer-events-auto">
          <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-300">
            <Fish className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white font-heading">
                Ocean Twin VR/AR
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-950 border border-teal-500/40 text-teal-300 font-mono">
                LIVING 3D ECOSYSTEM
              </span>
            </div>
            <p className="text-[10px] text-cyan-300/80 font-mono">
              Tuna Shoals • Manta Ray • Baitballs • Sun Caustics &amp; Bathymetry
            </p>
          </div>
        </div>

        {/* Right Hydro-Atmospheric Telemetry Bar */}
        <div className="flex items-center gap-3 bg-[#071322]/95 backdrop-blur-xl px-4 py-2 rounded-2xl border border-cyan-500/30 font-mono text-xs text-slate-200 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            <span>{telemetry.windKts} kts WNW</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-teal-400" />
            <span>Swell {telemetry.swellM}m</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-300 font-bold">{telemetry.tempC}°C</span>
          </div>
        </div>
      </div>

      {/* Interactive Species Biology & Fishery Modal */}
      {selectedSpecies && (
        <div className="absolute top-16 left-3 md:left-20 z-30 max-w-sm w-full p-4 rounded-2xl bg-[#061224]/98 backdrop-blur-2xl border border-cyan-500/60 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2 ring-1 ring-cyan-500/30">
          <div className="flex items-start justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-heading">{selectedSpecies.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                  {selectedSpecies.localName}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 italic font-mono">{selectedSpecies.scientificName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSpecies(null);
                stopVoice();
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[9px] text-slate-400 block uppercase">Habitat Depth</span>
              <span className="font-bold text-cyan-300">{selectedSpecies.depthRange}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[9px] text-slate-400 block uppercase">Thermal Affinity</span>
              <span className="font-bold text-amber-300">{selectedSpecies.optimalSST}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {selectedSpecies.description}
          </p>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-teal-300 font-semibold">{selectedSpecies.commercialTier}</span>
            <span>Gear: {selectedSpecies.gearType}</span>
          </div>
        </div>
      )}

      {/* Bottom Action Controls */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          
          {/* 1. Play / Pause Ecosystem Animation */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              isPlaying
                ? 'bg-[#09182a] border-cyan-500/30 text-slate-200 hover:text-white'
                : 'bg-amber-500/25 border-amber-500/60 text-amber-300'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
          </button>

          {/* 2. Camera Mode Toggle: Orbit vs Free-Swim vs Cinematic */}
          <button
            type="button"
            onClick={() => {
              setCameraMode(cameraMode === 'orbit' ? 'swim' : cameraMode === 'swim' ? 'cinematic' : 'orbit');
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              cameraMode === 'cinematic'
                ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 border-amber-400 text-amber-200'
                : cameraMode === 'swim'
                ? 'bg-teal-500/25 border-teal-400 text-teal-200 shadow-glow-teal-sm'
                : 'bg-[#09182a] border-cyan-500/30 text-slate-300 hover:text-white'
            }`}
          >
            {cameraMode === 'cinematic' ? (
              <Camera className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            ) : (
              <Compass className="w-3.5 h-3.5 text-teal-400" />
            )}
            <span>
              {cameraMode === 'cinematic'
                ? 'Cinematic Dive Tour'
                : cameraMode === 'swim'
                ? 'Free-Swim WASD'
                : 'Orbit Camera'}
            </span>
          </button>

          {/* 3. Hydro-Acoustic Underwater Soundscape */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              soundEnabled
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                : 'bg-[#09182a] border-cyan-500/30 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            <span>{soundEnabled ? 'Hydro-Audio (On)' : 'Hydro-Audio'}</span>
          </button>
        </div>

        {/* Right Section: WebXR VR */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if ((navigator as any).xr && vrSupported) {
                (navigator as any).xr.requestSession('immersive-vr').catch((err: any) => {
                  alert('WebXR VR session request: ' + err.message);
                });
              } else {
                alert('WebXR Headset / Cardboard Mode: To experience immersive VR, open this page inside a Meta Quest Browser, Apple Vision Pro, or WebXR-enabled mobile device!');
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 hover:from-teal-400 hover:to-cyan-400 text-[#020b18] font-black text-xs shadow-glow-cyan-sm transition cursor-pointer active:scale-95"
            title="Enter Immersive WebXR Virtual Reality"
          >
            <Glasses className="w-3.5 h-3.5 text-[#020b18]" />
            <span>{vrSupported ? 'Enter WebXR VR' : 'WebXR VR'}</span>
          </button>
        </div>

      </div>

    </div>
  );
};

export default OceanTwin;