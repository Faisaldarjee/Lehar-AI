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
  X
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
  description: string;
}

const SPECIES_KNOWLEDGE: Record<string, FishSpeciesData> = {
  tuna: {
    id: 'tuna',
    name: 'Yellowfin Tuna',
    scientificName: 'Thunnus albacares',
    localName: 'Kera / Kuppa Tuna',
    depthRange: '30m – 80m (Thermocline)',
    optimalSST: '24.5°C – 28.5°C',
    commercialTier: 'Tier-1 Premium Export',
    gearType: 'Longline & Deep Hook-and-Line',
    description: 'Fast pelagic apex predator cruising along oceanic thermal fronts and the mixed layer depth boundary in search of squid and sardines.',
  },
  mackerel: {
    id: 'mackerel',
    name: 'Indian Mackerel',
    scientificName: 'Rastrelliger kanagurta',
    localName: 'Bangda',
    depthRange: '10m – 30m (Sunlit Epipelagic)',
    optimalSST: '25.5°C – 29.0°C',
    commercialTier: 'High-Volume Coastal Staple',
    gearType: 'Purse Seine & Ring Net',
    description: 'Forms massive, coordinated circular baitballs in chlorophyll-rich coastal waters to feed on diatom blooms and planktonic copepods.',
  },
  pomfret: {
    id: 'pomfret',
    name: 'Silver Pomfret',
    scientificName: 'Pampus argenteus',
    localName: 'Safed Paplet',
    depthRange: '20m – 50m (Continental Shelf)',
    optimalSST: '25.0°C – 28.0°C',
    commercialTier: 'High-Value Domestic Premium',
    gearType: 'Bottom Drift Gillnet',
    description: 'Found in schools along sandy and muddy coastal bottoms of Gujarat, Maharashtra, and Bengal shelves near gentle upwelling currents.',
  },
};

export const OceanTwin: React.FC<OceanTwinProps> = ({
  selectedFloatId,
  profileData = [],
  isMHWMode = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Simulation Controls & Modes
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'swim'>('orbit');
  const [selectedSpecies, setSelectedSpecies] = useState<FishSpeciesData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [showControlsHint, setShowControlsHint] = useState<boolean>(true);

  // Live Telemetry Readouts derived from live ARGO profile
  const telemetry = useMemo(() => {
    const validPoint = profileData.find(p => p && p.temperature != null && p.depth != null);
    return {
      floatId: selectedFloatId || 'INCOIS-ARGO-2902187',
      depthM: validPoint?.depth != null ? Math.round(validPoint.depth) : 28,
      tempC: validPoint?.temperature != null ? Number(validPoint.temperature.toFixed(1)) : 27.8,
      salPSU: validPoint?.salinity != null ? Number(validPoint.salinity.toFixed(1)) : 35.3,
      windKts: 14,
      swellM: 1.6,
      seaState: 'Moderate (Douglas 3)',
    };
  }, [profileData, selectedFloatId]);

  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;
  const cameraModeRef = useRef<'orbit' | 'swim'>('orbit');
  cameraModeRef.current = cameraMode;

  // Web Audio Context for Procedural Hydro-Acoustic Ambience
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{ gain?: GainNode; filter?: BiquadFilterNode } | null>(null);

  // Check WebXR hardware support
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      (navigator as any).xr?.isSessionSupported?.('immersive-vr')?.then((supported: boolean) => {
        setVrSupported(supported);
      }).catch(() => setVrSupported(false));
    }
  }, []);

  // Web Audio Procedural Ocean Ambience
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

        // Generate pink noise buffer for deep ocean swell
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
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
          b6 = white * 0.115926;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;

        const gain = ctx.createGain();
        gain.gain.value = 0.45;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(0);

        audioNodesRef.current = { gain, filter };
      } else {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio context initialization note:', e);
    }

    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
    };
  }, [soundEnabled]);

  // Main Three.js Living Ocean Ecosystem Scene
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let width = currentMount.clientWidth || 800;
    let height = currentMount.clientHeight || 500;

    // 1. Scene & Deep Ocean Fog
    const scene = new THREE.Scene();
    const deepOceanColor = isMHWMode ? 0x06141a : 0x020d1c;
    scene.background = new THREE.Color(deepOceanColor);
    scene.fog = new THREE.FogExp2(deepOceanColor, 0.018);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    camera.position.set(0, 5, 26);

    // 3. High-Performance WebGL Renderer with XR enabled
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.xr.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // 4. Underwater Lighting & Sunlit Caustics
    const ambientLight = new THREE.AmbientLight(0x0ea5e9, 0.65);
    scene.add(ambientLight);

    const sunCausticLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    sunCausticLight.position.set(10, 45, 10);
    scene.add(sunCausticLight);

    const deepGlowLight = new THREE.PointLight(0x059669, 2.8, 60);
    deepGlowLight.position.set(0, -25, 0);
    scene.add(deepGlowLight);

    // 5. Dynamic Ocean Surface Waves Plane (0m Surface)
    const waveGeo = new THREE.PlaneGeometry(90, 90, 64, 64);
    const waveMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const oceanSurface = new THREE.Mesh(waveGeo, waveMat);
    oceanSurface.rotation.x = -Math.PI / 2;
    oceanSurface.position.y = 12.0;
    scene.add(oceanSurface);

    // 6. Sandy Seabed & Bathymetric Reef Terrain (-30m Bottom)
    const seabedGeo = new THREE.PlaneGeometry(100, 100, 48, 48);
    const seabedPositions = seabedGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < seabedPositions.length; i += 3) {
      const x = seabedPositions[i];
      const y = seabedPositions[i + 1];
      // Generate rolling sand dunes and underwater reef mounds
      seabedPositions[i + 2] = Math.sin(x * 0.12) * Math.cos(y * 0.12) * 2.5 + Math.sin(x * 0.05) * 1.5;
    }
    seabedGeo.computeVertexNormals();

    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0x0f3b46,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const seabed = new THREE.Mesh(seabedGeo, seabedMat);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -22.0;
    scene.add(seabed);

    // 7. Soft Corals & Seaweed Flora on the Seabed
    const coralGroup = new THREE.Group();
    const coralMaterial = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 });
    for (let i = 0; i < 30; i++) {
      const coralGeo = new THREE.ConeGeometry(0.6 + Math.random() * 0.5, 3.5 + Math.random() * 2.0, 6);
      const coralMesh = new THREE.Mesh(coralGeo, coralMaterial);
      const cx = (Math.random() - 0.5) * 60;
      const cz = (Math.random() - 0.5) * 60;
      coralMesh.position.set(cx, -20.5, cz);
      coralMesh.rotation.y = Math.random() * Math.PI;
      coralGroup.add(coralMesh);
    }
    scene.add(coralGroup);

    // 8. 3D ARGO Float Robot Model bobbing near surface
    const argoFloat = new THREE.Group();
    const hullGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.8, 16);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.3, roughness: 0.3 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    argoFloat.add(hull);

    const collarGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.3, 16);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 0.5;
    argoFloat.add(collar);

    const antennaGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 1.5;
    argoFloat.add(antenna);

    const beaconGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 2.15;
    argoFloat.add(beacon);

    argoFloat.position.set(12, 9.5, -8);
    scene.add(argoFloat);

    // 9. Procedural 3D Marine Life Shoals
    // 9a. Yellowfin Tuna Shoal (Fast apex predators at Thermocline - 40m depth)
    const tunaGroup = new THREE.Group();
    const tunaCount = 6;
    const tunaMeshes: THREE.Group[] = [];

    for (let i = 0; i < tunaCount; i++) {
      const tuna = new THREE.Group();

      // Torpedo Body
      const bodyGeo = new THREE.ConeGeometry(0.6, 2.8, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.z = Math.PI / 2;
      tuna.add(body);

      // Yellow Dorsal Fin
      const finGeo = new THREE.ConeGeometry(0.25, 0.7, 4);
      const finMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.2 });
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.set(0.2, 0.6, 0);
      fin.rotation.z = -0.4;
      tuna.add(fin);

      // Tail
      const tailGeo = new THREE.BoxGeometry(0.1, 0.9, 0.4);
      const tail = new THREE.Mesh(tailGeo, finMat);
      tail.position.set(-1.4, 0, 0);
      tuna.add(tail);

      (tuna as any).userData = { species: 'tuna', index: i };
      tunaMeshes.push(tuna);
      tunaGroup.add(tuna);
    }
    scene.add(tunaGroup);

    // 9b. Indian Mackerel / Sardine Baitball (45 fish in rotating cluster at 15m depth)
    const mackerelGroup = new THREE.Group();
    const mackerelCount = 42;
    const mackerelMeshes: THREE.Mesh[] = [];
    const mackGeo = new THREE.ConeGeometry(0.18, 0.9, 6);
    const mackMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });

    for (let i = 0; i < mackerelCount; i++) {
      const mack = new THREE.Mesh(mackGeo, mackMat);
      mack.rotation.z = Math.PI / 2;
      (mack as any).userData = { species: 'mackerel', index: i };
      mackerelMeshes.push(mack);
      mackerelGroup.add(mack);
    }
    mackerelGroup.position.set(-10, 4, -4);
    scene.add(mackerelGroup);

    // 9c. Silver Pomfret Group (Diamond fish near continental slope)
    const pomfretGroup = new THREE.Group();
    const pomfretCount = 5;
    const pomfretMeshes: THREE.Group[] = [];

    for (let i = 0; i < pomfretCount; i++) {
      const pom = new THREE.Group();
      const pBodyGeo = new THREE.CylinderGeometry(0.08, 0.7, 1.2, 6);
      const pBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
      const pBody = new THREE.Mesh(pBodyGeo, pBodyMat);
      pBody.rotation.z = Math.PI / 2;
      pBody.scale.set(0.3, 1, 1.4);
      pom.add(pBody);
      (pom as any).userData = { species: 'pomfret', index: i };
      pomfretMeshes.push(pom);
      pomfretGroup.add(pom);
    }
    pomfretGroup.position.set(6, -8, 8);
    scene.add(pomfretGroup);

    // 10. 1,000+ Marine Snow & Plankton Particles
    const pCount = 1000;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 80;
      pPositions[i + 1] = (Math.random() - 0.5) * 40;
      pPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.18,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const planktonField = new THREE.Points(pGeo, pMat);
    scene.add(planktonField);

    // 11. Interactive Raycasting Point & Click for Marine Life
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allFishObjects = [...tunaMeshes, ...mackerelMeshes, ...pomfretMeshes];
      const hits = raycaster.intersectObjects(allFishObjects, true);

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

    // 12. Free-Swim Keyboard & Orbit Controls
    const keysPressed: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Orbit Navigation
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraAngle = 0.2;
    let cameraPitch = 0.15;
    let cameraDist = 28.0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      cameraAngle += dx * 0.006;
      cameraPitch = Math.max(-0.6, Math.min(0.8, cameraPitch + dy * 0.005));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDist = Math.max(8.0, Math.min(55.0, cameraDist + e.deltaY * 0.03));
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('click', handlePointerDown);

    // 13. 60FPS Ecosystem Animation Loop
    let animId: number;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isPlayingRef.current) {
        clock += 0.016;

        // Wave surface undulation
        const wavePos = waveGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < wavePos.length; i += 3) {
          const u = wavePos[i];
          const v = wavePos[i + 1];
          wavePos[i + 2] = Math.sin(u * 0.25 + clock * 2.0) * Math.cos(v * 0.25 + clock * 1.5) * 0.45;
        }
        waveGeo.attributes.position.needsUpdate = true;

        // ARGO Float bobbing
        argoFloat.position.y = 9.5 + Math.sin(clock * 2.0) * 0.35;
        beacon.material.color.setHex(Math.sin(clock * 6.0) > 0 ? 0x38bdf8 : 0x0369a1);

        // 1. Tuna Predatory Cruising Shoal Animation
        const tunaRadius = 18.0;
        const tunaSpeed = clock * 0.85;
        tunaMeshes.forEach((tuna, idx) => {
          const offsetAngle = idx * 0.45;
          const tx = Math.cos(tunaSpeed + offsetAngle) * (tunaRadius + idx * 1.2);
          const tz = Math.sin(tunaSpeed + offsetAngle) * (tunaRadius + idx * 0.8);
          const ty = -6.0 + Math.sin(clock * 1.5 + idx) * 1.5;

          tuna.position.set(tx, ty, tz);
          tuna.rotation.y = -(tunaSpeed + offsetAngle) + Math.PI / 2;
          // Tail swimming wag
          tuna.rotation.y += Math.sin(clock * 9.0 + idx) * 0.15;
        });

        // 2. Mackerel Baitball Swirl Animation
        mackerelMeshes.forEach((mack, idx) => {
          const bAngle = clock * 1.6 + (idx / mackerelCount) * Math.PI * 2;
          const bRadius = 3.5 + Math.sin(clock * 2.0 + idx) * 0.8;
          const bY = 4.0 + Math.cos(clock * 1.8 + idx * 0.5) * 1.8;

          mack.position.set(Math.cos(bAngle) * bRadius, bY, Math.sin(bAngle) * bRadius);
          mack.rotation.y = -bAngle + Math.PI / 2;
        });

        // 3. Pomfret Coastal Drift
        pomfretMeshes.forEach((pom, idx) => {
          const px = 6 + Math.sin(clock * 0.5 + idx * 0.8) * 4.0;
          const pz = 8 + Math.cos(clock * 0.5 + idx * 0.8) * 3.5;
          pom.position.x = px;
          pom.position.z = pz;
          pom.rotation.y = Math.sin(clock * 0.8 + idx) * 0.3;
        });

        // Plankton slow drift
        planktonField.rotation.y += 0.0008;

        // Swim Navigation Mode (WASD)
        if (cameraModeRef.current === 'swim') {
          const moveSpeed = 0.35;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

          if (keysPressed['w'] || keysPressed['arrowup']) camera.position.addScaledVector(forward, moveSpeed);
          if (keysPressed['s'] || keysPressed['arrowdown']) camera.position.addScaledVector(forward, -moveSpeed);
          if (keysPressed['a'] || keysPressed['arrowleft']) camera.position.addScaledVector(right, -moveSpeed);
          if (keysPressed['d'] || keysPressed['arrowright']) camera.position.addScaledVector(right, moveSpeed);
          if (keysPressed[' ']) camera.position.y = Math.min(11.0, camera.position.y + moveSpeed);
          if (keysPressed['shift'] || keysPressed['c']) camera.position.y = Math.max(-20.0, camera.position.y - moveSpeed);
        } else {
          // Orbit Camera Mode
          camera.position.x = Math.sin(cameraAngle) * Math.cos(cameraPitch) * cameraDist;
          camera.position.z = Math.cos(cameraAngle) * Math.cos(cameraPitch) * cameraDist;
          camera.position.y = Math.sin(cameraPitch) * cameraDist;
          camera.lookAt(0, 0, 0);
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
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#020b18] shadow-2xl flex flex-col font-sans select-none">
      
      {/* 3D WebGL / WebXR Viewport */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Telemetry & Atmosphere Banner */}
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
                LIVING ECOSYSTEM
              </span>
            </div>
            <p className="text-[10px] text-cyan-300/80 font-mono">
              Real 3D Fish Shoaling • ARGO Float • Surface Caustics &amp; Seabed
            </p>
          </div>
        </div>

        {/* Right Marine Meteorology & Hydro-Telemetry Bar */}
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

      {/* Interactive Species Educational & Fishery Inspection Modal / Badge */}
      {selectedSpecies && (
        <div className="absolute top-16 left-3 z-30 max-w-sm w-full p-4 rounded-2xl bg-[#061224]/98 backdrop-blur-2xl border border-cyan-500/60 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2 ring-1 ring-cyan-500/30">
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

      {/* Free-Swim WASD Keyboard Controls Banner (Dismissable) */}
      {cameraMode === 'swim' && showControlsHint && (
        <div className="absolute top-16 right-3 z-20 p-3 rounded-2xl bg-[#071322]/95 backdrop-blur-xl border border-teal-500/40 text-xs font-mono text-slate-200 shadow-2xl max-w-xs space-y-1.5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-bold text-teal-300 flex items-center gap-1.5">
              <span>🎮</span>
              <span>Free-Swim Navigation</span>
            </span>
            <button
              type="button"
              onClick={() => setShowControlsHint(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
            <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold">W/A/S/D</kbd> Move</div>
            <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold">Mouse</kbd> 360° Look</div>
            <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold">Space</kbd> Surface Up</div>
            <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold">Shift</kbd> Dive Down</div>
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
            <span>{isPlaying ? 'Pause Ocean' : 'Resume Ocean'}</span>
          </button>

          {/* 2. Camera Mode Toggle: Orbit vs Free-Swim */}
          <button
            type="button"
            onClick={() => {
              setCameraMode(cameraMode === 'orbit' ? 'swim' : 'orbit');
              if (cameraMode === 'orbit') setShowControlsHint(true);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              cameraMode === 'swim'
                ? 'bg-teal-500/25 border-teal-400 text-teal-200 shadow-glow-teal-sm'
                : 'bg-[#09182a] border-cyan-500/30 text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-teal-400" />
            <span>{cameraMode === 'swim' ? 'Swim Mode (Active)' : 'Free-Swim WASD'}</span>
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
            <span>{soundEnabled ? 'Ocean Audio (On)' : 'Hydro-Audio'}</span>
          </button>
        </div>

        {/* Right Section: WebXR VR & Fullscreen */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          
          {/* WebXR VR Button */}
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