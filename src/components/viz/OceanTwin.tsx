import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
    depthRange: '25m – 75m (Thermocline Front)',
    optimalSST: '24.5°C – 28.5°C',
    commercialTier: 'Tier-1 High-Value Pelagic Export',
    gearType: 'Oceanic Longline & Trolling',
    diet: 'Squid, flying fish, pelagic crustaceans',
    description: 'High-speed apex predator cruising along oceanic thermal breaks where cold nutrient upwelling meets warm surface waters.',
  },
  manta: {
    id: 'manta',
    name: 'Oceanic Manta Ray',
    scientificName: 'Mobula birostris',
    localName: 'Kombu Thirandi / Shingro',
    depthRange: '5m – 35m (Sunlit Water Column)',
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
    depthRange: '8m – 25m (Epipelagic)',
    optimalSST: '25.5°C – 29.0°C',
    commercialTier: 'High-Volume Coastal Staple',
    gearType: 'Purse Seine & Ring Net',
    diet: 'Phytoplankton blooms, diatoms, copepod larvae',
    description: 'Forms massive, synchronized rotating baitballs to confuse predators and maximize filter-feeding efficiency in high-chlorophyll zones.',
  },
  jellyfish: {
    id: 'jellyfish',
    name: 'Bioluminescent Sea Jelly',
    scientificName: 'Aequorea victoria',
    localName: 'Zal Phul',
    depthRange: '30m – 100m (Mesopelagic Twilight)',
    optimalSST: '22.0°C – 27.0°C',
    commercialTier: 'Bio-Indicator Species',
    gearType: 'Non-Targeted',
    diet: 'Micro-zooplankton, fish eggs',
    description: 'Drifting cnidarian that glows with cyan-green bioluminescence when agitated by ocean currents and thermohaline shears.',
  },
};

// -----------------------------------------------------------------------------
// PROCEDURAL TEXTURE GENERATORS (Zero external file dependencies, 100% in-memory)
// -----------------------------------------------------------------------------

// 1. Soft Volumetric God-Ray Alpha Texture (No hard geometric edges)
function createGodRayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, 'rgba(210, 245, 255, 0.0)');
  grad.addColorStop(0.12, 'rgba(180, 235, 255, 0.45)');
  grad.addColorStop(0.5, 'rgba(120, 215, 255, 0.7)');
  grad.addColorStop(0.85, 'rgba(56, 189, 248, 0.25)');
  grad.addColorStop(1.0, 'rgba(6, 182, 212, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Soft horizontal feathering to ensure 0-opacity at side edges
  const hGrad = ctx.createLinearGradient(0, 0, 256, 0);
  hGrad.addColorStop(0.0, 'rgba(0,0,0,1)');
  hGrad.addColorStop(0.18, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.82, 'rgba(0,0,0,0)');
  hGrad.addColorStop(1.0, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 256, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 2. Animated Ocean Caustic Light Texture
function createCausticTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const u = x / 512;
      const v = y / 512;
      // Multi-wave procedural caustic interference pattern
      const w1 = Math.sin(u * 22.0 + v * 14.0);
      const w2 = Math.sin(u * 14.0 - v * 24.0);
      const w3 = Math.cos(u * 32.0 + v * 28.0);
      const val = Math.pow(Math.max(0, (w1 + w2 + w3) / 3.0), 2.2);
      const idx = (y * 512 + x) * 4;
      data[idx] = Math.floor(val * 210);     // Red
      data[idx + 1] = Math.floor(val * 245); // Green
      data[idx + 2] = Math.floor(val * 255); // Blue
      data[idx + 3] = Math.floor(val * 220); // Alpha
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

// 3. Soft Glowing Circular Marine Snow Particle Texture
function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.3, 'rgba(165, 243, 252, 0.85)');
  grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.25)');
  grad.addColorStop(1.0, 'rgba(6, 182, 212, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 4. Custom Cinematic Dive-Mask Shader (Barrel Distortion, Chromatic Aberration & Vignette)
const UnderwaterLensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDistortion: { value: 0.045 },
    uAberration: { value: 0.0028 },
    uVignetteDarkness: { value: 0.95 },
    uVignetteOffset: { value: 0.85 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDistortion;
    uniform float uAberration;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    varying vec2 vUv;

    void main() {
      // 1. Mild Barrel Distortion (Dive-Mask Optics)
      vec2 center = vec2(0.5, 0.5);
      vec2 uv = vUv - center;
      float r2 = dot(uv, uv);
      vec2 distortedUv = center + uv * (1.0 + uDistortion * r2);

      // Clamp to edge
      if (distortedUv.x < 0.0 || distortedUv.x > 1.0 || distortedUv.y < 0.0 || distortedUv.y > 1.0) {
        gl_FragColor = vec4(0.01, 0.04, 0.08, 1.0);
        return;
      }

      // 2. Chromatic Aberration (Lens water dispersion)
      vec2 dir = normalize(distortedUv - center);
      float dist = length(distortedUv - center);
      vec2 redUv = distortedUv + dir * (uAberration * dist);
      vec2 blueUv = distortedUv - dir * (uAberration * dist);

      float r = texture2D(tDiffuse, redUv).r;
      float g = texture2D(tDiffuse, distortedUv).g;
      float b = texture2D(tDiffuse, blueUv).b;
      vec3 color = vec3(r, g, b);

      // 3. Underwater Blue-Green Atmospheric Tonemap / Tint
      color.r *= 0.88;
      color.g *= 1.04;
      color.b *= 1.12;

      // 4. Soft Vignette (Dive-Mask Oval Border)
      float vignette = smoothstep(uVignetteOffset, uVignetteOffset - 0.45, dist * 1.35);
      color = mix(color * (1.0 - uVignetteDarkness), color, vignette);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export const OceanTwin: React.FC<OceanTwinProps> = ({
  selectedFloatId,
  profileData = [],
  isMHWMode = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Simulation Controls & Modes
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'swim' | 'cinematic'>('cinematic');
  const [selectedSpecies, setSelectedSpecies] = useState<FishSpeciesData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [currentDepthM, setCurrentDepthM] = useState<number>(18);
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);

  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;
  const cameraModeRef = useRef<'orbit' | 'swim' | 'cinematic'>('cinematic');
  cameraModeRef.current = cameraMode;

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Live Telemetry Readouts derived from live ARGO profile
  const telemetry = useMemo(() => {
    const validPoint = profileData.find(p => p && p.temperature != null && p.depth != null);
    return {
      floatId: selectedFloatId || 'INCOIS-ARGO-2902187',
      depthM: validPoint?.depth != null ? Math.round(validPoint.depth) : 18,
      tempC: validPoint?.temperature != null ? Number(validPoint.temperature.toFixed(1)) : 28.2,
      salPSU: validPoint?.salinity != null ? Number(validPoint.salinity.toFixed(1)) : 35.4,
      windKts: 12,
      swellM: 1.4,
      seaState: 'Calm-Moderate (Douglas 2)',
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

        // Submarine pink noise buffer
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
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.038;
          b6 = white * 0.115926;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 340;

        const gain = ctx.createGain();
        gain.gain.value = 0.45;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(0);

        // Periodic ARGO Sonar Ping (Every 6 seconds)
        const sonarInterval = setInterval(() => {
          if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
          try {
            const osc = ctx.createOscillator();
            const sGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.38);
            sGain.gain.setValueAtTime(0.07, ctx.currentTime);
            sGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
            osc.connect(sGain);
            sGain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.39);
          } catch (err) {}
        }, 6000);

        return () => clearInterval(sonarInterval);
      } else {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio setup note:', e);
    }
  }, [soundEnabled]);

  // Main Three.js Living Ocean Ecosystem Scene
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let width = currentMount.clientWidth || 800;
    let height = currentMount.clientHeight || 500;

    // 1. Scene & Depth-Interpolated Exponential Fog
    const scene = new THREE.Scene();
    const shallowColor = new THREE.Color(0x0f8a8a); // Vivid sunlit teal-cyan
    const midColor = new THREE.Color(0x023e59);     // Rich pelagic blue
    const deepColor = new THREE.Color(0x010814);    // Deep abyssal midnight

    const fog = new THREE.FogExp2(shallowColor.getHex(), 0.022);
    scene.fog = fog;

    // 2. Camera Setup (First-Person Diver POV)
    const camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 1000);
    camera.position.set(0, 1.6, 24);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.xr.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // 4. Post-Processing Stack (EffectComposer with Bloom & Dive-Mask Optics)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Subtle bloom for sunburst, caustics & bioluminescence
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.36,  // Strength
      0.55,  // Radius
      0.82   // Threshold
    );
    composer.addPass(bloomPass);

    // Screen Space Ambient Occlusion - Cinematic depth realism
    const ssaoPass = new SSAOPass(scene, camera, width, height);
    ssaoPass.kernelRadius = 0.6;      // Larger radius for soft underwater ambient occlusion
    ssaoPass.minDistance = 0.001;
    ssaoPass.maxDistance = 0.025;     // Tighter for underwater details
    ssaoPass.output = SSAOPass.OUTPUT.Default;
    composer.addPass(ssaoPass);

    // Final output pass (required for SSAO)
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Underwater Dive-Mask Chromatic & Barrel Shader Pass
    const lensPass = new ShaderPass(UnderwaterLensShader);
    lensPass.renderToScreen = true;
    composer.addPass(lensPass);

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x06b6d4, 1.1);
    scene.add(ambientLight);

    const sunDirectional = new THREE.DirectionalLight(0xdbeafe, 3.8);
    sunDirectional.position.set(5, 50, 10);
    scene.add(sunDirectional);

    // 6. VOLUMETRIC SUN GOD-RAYS (CRITICAL FIX: Soft Alpha Gradient Planes)
    const godRayTexture = createGodRayTexture();
    const godRayGroup = new THREE.Group();
    const godRayCount = 14;
    const godRayPlanes: THREE.Mesh[] = [];

    const rayMat = new THREE.MeshBasicMaterial({
      map: godRayTexture,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < godRayCount; i++) {
      const rayWidth = 6.0 + Math.random() * 5.0;
      const rayHeight = 38.0 + Math.random() * 8.0;
      const rayGeo = new THREE.PlaneGeometry(rayWidth, rayHeight);
      const rayMesh = new THREE.Mesh(rayGeo, rayMat);

      const angle = (i / godRayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const distFromCenter = 2.0 + Math.random() * 8.0;
      rayMesh.position.set(Math.cos(angle) * distFromCenter, 6.0, Math.sin(angle) * distFromCenter);
      
      // Fan outward from implied overhead sun source
      rayMesh.rotation.y = angle + Math.PI / 2;
      rayMesh.rotation.x = (Math.random() - 0.5) * 0.25;
      rayMesh.rotation.z = (Math.random() - 0.5) * 0.2;

      godRayPlanes.push(rayMesh);
      godRayGroup.add(rayMesh);
    }
    scene.add(godRayGroup);

    // 7. Water Surface (0m) with Refraction & Ripples
    const surfaceGeo = new THREE.PlaneGeometry(120, 120, 80, 80);
    const surfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x075985,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.08,
      transmission: 0.7,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const oceanSurface = new THREE.Mesh(surfaceGeo, surfaceMat);
    oceanSurface.rotation.x = -Math.PI / 2;
    oceanSurface.position.y = 15.0;
    scene.add(oceanSurface);

    // 8. White Rippled Sand Seabed with Caustic Projection (-18m)
    const causticTexture = createCausticTexture();
    const seabedGeo = new THREE.PlaneGeometry(140, 140, 64, 64);
    const seabedPos = seabedGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < seabedPos.length; i += 3) {
      const x = seabedPos[i];
      const y = seabedPos[i + 1];
      // Fine water-current sand ripples
      seabedPos[i + 2] = Math.sin(x * 0.35) * 0.35 + Math.cos(y * 0.25) * 0.25 + Math.sin(x * 0.08 + y * 0.08) * 1.8;
    }
    seabedGeo.computeVertexNormals();

    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0xe2d9cc, // Clean warm white/beige coral sand (Ref: Photo 4)
      map: causticTexture,
      roughness: 0.65,
      metalness: 0.1,
    });
    const seabed = new THREE.Mesh(seabedGeo, seabedMat);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -18.0;
    scene.add(seabed);

    // 9. Coral Formations & Seaweed on Sand Dunes
    const coralReefGroup = new THREE.Group();
    const brainCoralMat = new THREE.MeshStandardMaterial({ color: 0xc29b62, roughness: 0.7 });
    const staghornCoralMat = new THREE.MeshStandardMaterial({ color: 0xdd6b20, roughness: 0.6 });
    const softPurpleMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.5 });

    for (let i = 0; i < 30; i++) {
      const type = i % 3;
      const coralGeo = type === 0 
        ? new THREE.DodecahedronGeometry(1.2 + Math.random() * 0.8, 1)
        : type === 1
        ? new THREE.CylinderGeometry(0.2, 0.9, 2.5 + Math.random() * 1.5, 6)
        : new THREE.SphereGeometry(0.9 + Math.random() * 0.6, 8, 8);

      const coral = new THREE.Mesh(coralGeo, type === 0 ? brainCoralMat : type === 1 ? staghornCoralMat : softPurpleMat);
      const cx = (Math.random() - 0.5) * 70;
      const cz = (Math.random() - 0.5) * 70;
      coral.position.set(cx, -17.2, cz);
      coralReefGroup.add(coral);
    }
    scene.add(coralReefGroup);

    // 10. ARGO CTD Robot Float Bobbing in Sunbeams (Ref: Photo 5)
    const argoFloat = new THREE.Group();
    const hullGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.2, 24);
    const hullMat = new THREE.MeshPhysicalMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.25, clearcoat: 0.8 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    argoFloat.add(hull);

    const collarGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.35, 24);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 0.55;
    argoFloat.add(collar);

    const antGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.y = 1.8;
    argoFloat.add(ant);

    const beaconGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 2.6;
    argoFloat.add(beacon);

    // Trailing sensor cable into deep water
    const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 8.0, 6);
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.y = -5.0;
    argoFloat.add(cable);

    argoFloat.position.set(12, 12.0, -8);
    scene.add(argoFloat);

    // 12. Educational CTD Data Overlay (Floating 3D Panels)
    const createDataPanel = (label: string, value: string, color: number, offset: number) => {
      const panelGroup = new THREE.Group();

      // Background panel
      const panelGeo = new THREE.PlaneGeometry(3.5, 0.8);
      const panelMat = new THREE.MeshBasicMaterial({
        color: 0x0a1929,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panelGroup.add(panel);

      // Label text (simulated with geometry)
      const labelGeo = new THREE.PlaneGeometry(1.2, 0.2);
      const labelMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.set(-1.0, 0.2, 0.01);
      panelGroup.add(labelMesh);

      // Value text
      const valueGeo = new THREE.PlaneGeometry(1.5, 0.3);
      const valueMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      });
      const valueMesh = new THREE.Mesh(valueGeo, valueMat);
      valueMesh.position.set(0.8, -0.15, 0.01);
      panelGroup.add(valueMesh);

      // Connect line to ARGO float
      const lineGeo = new THREE.CylinderGeometry(0.005, 0.005, offset, 4);
      const lineMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, -offset / 2, 0);
      line.rotation.z = Math.PI / 2;
      panelGroup.add(line);

      panelGroup.position.set(0, offset, 0);
      panelGroup.userData = { label, value, type: 'dataPanel' };

      return panelGroup;
    };

    // Create CTD data panels
    const temperaturePanel = createDataPanel('TEMPERATURE', `${telemetry.tempC}°C`, 0xf59e0b, 3.5);
    const salinityPanel = createDataPanel('SALINITY', `${telemetry.salPSU} PSU`, 0x3b82f6, 2.5);
    const depthPanel = createDataPanel('DEPTH', `${telemetry.depthM}m`, 0x10b981, 1.5);

    const ctdOverlay = new THREE.Group();
    ctdOverlay.add(temperaturePanel);
    ctdOverlay.add(salinityPanel);
    ctdOverlay.add(depthPanel);

    ctdOverlay.position.set(12, 16.0, -8); // Above ARGO float
    scene.add(ctdOverlay);

    // 11. ANATOMICAL 3D MARINE LIFE (NO MORE FLAT CONES!)
    
    // 11a. Yellowfin Tuna Shoal (Ref: Photo 2) — Metallic countershading & golden finlets
    const tunaGroup = new THREE.Group();
    const tunaCount = 9;
    const tunaMeshes: THREE.Group[] = [];

    const createAnatomicalTuna = (index: number) => {
      const tuna = new THREE.Group();

      // Fusiform Torpedo Body with Countershading
      const bodyGeo = new THREE.ConeGeometry(0.65, 3.6, 20);
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x075985,
        emissiveIntensity: 0.25,
        metalness: 0.88,
        roughness: 0.12,
        clearcoat: 1.0,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.z = Math.PI / 2;
      tuna.add(body);

      // Yellow Sickle Dorsal Fin
      const finMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.3, roughness: 0.3 });
      const finGeo = new THREE.ConeGeometry(0.28, 1.2, 8);
      const dFin = new THREE.Mesh(finGeo, finMat);
      dFin.position.set(0.3, 0.9, 0);
      dFin.rotation.z = -0.55;
      tuna.add(dFin);

      // Yellow Sickle Ventral Fin
      const vFin = new THREE.Mesh(finGeo, finMat);
      vFin.position.set(0.3, -0.9, 0);
      vFin.rotation.z = 0.55;
      vFin.rotation.x = Math.PI;
      tuna.add(vFin);

      // Crescent Caudal Tail Fin
      const tailUpper = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.0, 6), finMat);
      tailUpper.position.set(-1.9, 0.45, 0);
      tailUpper.rotation.z = -0.65;
      tuna.add(tailUpper);

      const tailLower = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.0, 6), finMat);
      tailLower.position.set(-1.9, -0.45, 0);
      tailLower.rotation.z = 0.65;
      tuna.add(tailLower);

      (tuna as any).userData = { species: 'tuna', index };
      return tuna;
    };

    for (let i = 0; i < tunaCount; i++) {
      const tuna = createAnatomicalTuna(i);
      tunaMeshes.push(tuna);
      tunaGroup.add(tuna);
    }
    scene.add(tunaGroup);

    // 11b. Oceanic Manta Ray (Ref: Photo 3) — Realistic wings & countershading
    const manta = new THREE.Group();
    const mantaBodyGeo = new THREE.CylinderGeometry(0.25, 1.3, 3.8, 12);
    const mantaMatDorsal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.4 });
    const mantaBody = new THREE.Mesh(mantaBodyGeo, mantaMatDorsal);
    mantaBody.rotation.z = Math.PI / 2;
    mantaBody.scale.set(0.22, 1, 1.35);
    manta.add(mantaBody);

    // Left & Right Wings
    const wingGeo = new THREE.PlaneGeometry(6.5, 4.2, 12, 12);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, side: THREE.DoubleSide, roughness: 0.35 });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(0, 0, 3.8);
    leftWing.rotation.x = Math.PI / 2;
    manta.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0, 0, -3.8);
    rightWing.rotation.x = -Math.PI / 2;
    manta.add(rightWing);

    // Whip Tail
    const mTailGeo = new THREE.CylinderGeometry(0.04, 0.01, 5.2, 6);
    const mTail = new THREE.Mesh(mTailGeo, mantaMatDorsal);
    mTail.position.set(-3.2, 0, 0);
    mTail.rotation.z = Math.PI / 2;
    manta.add(mTail);

    (manta as any).userData = { species: 'manta' };
    manta.position.set(0, 6.5, -4);
    scene.add(manta);

    // 11c. Indian Mackerel / Sardine Baitball (Ref: Photo 1)
    const mackerelGroup = new THREE.Group();
    const mackerelCount = 65;
    const mackerelMeshes: THREE.Mesh[] = [];
    const mackGeo = new THREE.ConeGeometry(0.14, 1.0, 8);
    const mackMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      metalness: 0.95,
      roughness: 0.08,
      clearcoat: 1.0,
    });

    for (let i = 0; i < mackerelCount; i++) {
      const mack = new THREE.Mesh(mackGeo, mackMat);
      mack.rotation.z = Math.PI / 2;
      (mack as any).userData = { species: 'mackerel', index: i };
      mackerelMeshes.push(mack);
      mackerelGroup.add(mack);
    }
    mackerelGroup.position.set(-12, 4.5, -4);
    scene.add(mackerelGroup);

    // 11d. Translucent Bioluminescent Jellyfish
    const jellyGroup = new THREE.Group();
    const jellyMeshes: THREE.Group[] = [];
    const jellyMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      transmission: 0.8,
    });

    for (let j = 0; j < 6; j++) {
      const jelly = new THREE.Group();
      const bellGeo = new THREE.SphereGeometry(0.85 + Math.random() * 0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const bell = new THREE.Mesh(bellGeo, jellyMat);
      jelly.add(bell);

      for (let t = 0; t < 6; t++) {
        const tGeo = new THREE.CylinderGeometry(0.02, 0.01, 3.2, 4);
        const tentacle = new THREE.Mesh(tGeo, jellyMat);
        const tAngle = (t / 6) * Math.PI * 2;
        tentacle.position.set(Math.cos(tAngle) * 0.5, -1.6, Math.sin(tAngle) * 0.5);
        jelly.add(tentacle);
      }

      (jelly as any).userData = { species: 'jellyfish', index: j };
      const jx = (Math.random() - 0.5) * 45;
      const jy = -2.0 - Math.random() * 10.0;
      const jz = (Math.random() - 0.5) * 45;
      jelly.position.set(jx, jy, jz);
      jellyMeshes.push(jelly);
      jellyGroup.add(jelly);
    }
    scene.add(jellyGroup);

    // 12. 1,400+ Soft Marine Snow Particulates
    const pCount = 1400;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 90;
      pPositions[i + 1] = (Math.random() - 0.5) * 45;
      pPositions[i + 2] = (Math.random() - 0.5) * 90;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      map: createParticleTexture(),
      size: 0.4,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const planktonField = new THREE.Points(pGeo, pMat);
    scene.add(planktonField);

    // 13. Bubble Stream Particle System (ARGO Float & Fish Respiration)
    const bubbleCount = 200;
    const bubbleGeo = new THREE.BufferGeometry();
    const bubblePositions = new Float32Array(bubbleCount * 3);
    const bubbleVelocities = new Float32Array(bubbleCount * 3);
    const bubbleSizes = new Float32Array(bubbleCount);
    const bubbleOpacities = new Float32Array(bubbleCount);

    for (let i = 0; i < bubbleCount; i++) {
      const idx = i * 3;
      // Start bubbles at random positions near ARGO float and fish
      bubblePositions[idx] = (Math.random() - 0.5) * 5 + 12; // ARGO x position
      bubblePositions[idx + 1] = Math.random() * 5 + 10;     // Start at different depths
      bubblePositions[idx + 2] = (Math.random() - 0.5) * 5 - 8; // ARGO z position

      // Random upward velocity with slight horizontal drift
      bubbleVelocities[idx] = (Math.random() - 0.5) * 0.02; // x drift
      bubbleVelocities[idx + 1] = 0.08 + Math.random() * 0.04; // y speed (upward)
      bubbleVelocities[idx + 2] = (Math.random() - 0.5) * 0.02; // z drift

      bubbleSizes[i] = 0.08 + Math.random() * 0.12;
      bubbleOpacities[i] = 0.4 + Math.random() * 0.4;
    }

    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
    const bubbleMat = new THREE.PointsMaterial({
      size: 0.1,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: createParticleTexture(),
    });

    const bubbleField = new THREE.Points(bubbleGeo, bubbleMat);
    scene.add(bubbleField);

    // 13. Interactive Raycast Target Inspect
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

    // 14. Free-Swim Navigation & Mouse Controls (FULLY REWORKED)
    const keysPressed: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = true;
      // Prevent page scroll when in swim mode
      if (['w','a','s','d',' ','e','q','c','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    
    // Orbit mode camera state
    let cameraAngle = 0.25;
    let cameraPitch = 0.15;
    let cameraDist = 26.0;

    // Swim mode first-person state (Euler angles in radians)
    let swimYaw = 0;       // horizontal rotation (left/right look)
    let swimPitch = 0;     // vertical rotation (up/down look)
    let swimPos = new THREE.Vector3(0, 1.6, 24);
    let swimVelocity = new THREE.Vector3(0, 0, 0);
    const SWIM_ACCEL = 0.08;
    const SWIM_FRICTION = 0.88; // smooth deceleration
    const SWIM_MAX_SPEED = 0.6;
    const MOUSE_SENSITIVITY = 0.003;
    let isPointerLocked = false;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      
      // Request pointer lock in swim mode for seamless mouse look
      if (cameraModeRef.current === 'swim' && !isPointerLocked) {
        renderer.domElement.requestPointerLock?.();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e);
      
      if (cameraModeRef.current === 'swim') {
        // In swim mode, always use mouse movement for look (pointer lock or drag)
        if (isPointerLocked) {
          swimYaw -= e.movementX * MOUSE_SENSITIVITY;
          swimPitch -= e.movementY * MOUSE_SENSITIVITY;
          swimPitch = Math.max(-1.2, Math.min(1.2, swimPitch));
        } else if (isDragging) {
          const dx = e.clientX - prevMouse.x;
          const dy = e.clientY - prevMouse.y;
          swimYaw -= dx * MOUSE_SENSITIVITY;
          swimPitch -= dy * MOUSE_SENSITIVITY;
          swimPitch = Math.max(-1.2, Math.min(1.2, swimPitch));
          prevMouse = { x: e.clientX, y: e.clientY };
        }
      } else if (isDragging) {
        // Orbit / cinematic mouse drag
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        cameraAngle += dx * 0.005;
        cameraPitch = Math.max(-0.65, Math.min(0.8, cameraPitch + dy * 0.004));
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDist = Math.max(6.0, Math.min(60.0, cameraDist + e.deltaY * 0.035));
    };

    // Pointer lock change handler
    const handlePointerLockChange = () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement;
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('click', handlePointerDown);

    // Touch support for mobile swim
    let touchStartPos = { x: 0, y: 0 };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (cameraModeRef.current === 'swim' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartPos.x;
        const dy = e.touches[0].clientY - touchStartPos.y;
        swimYaw -= dx * MOUSE_SENSITIVITY * 0.5;
        swimPitch -= dy * MOUSE_SENSITIVITY * 0.5;
        swimPitch = Math.max(-1.2, Math.min(1.2, swimPitch));
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    dom.addEventListener('touchstart', handleTouchStart, { passive: true });
    dom.addEventListener('touchmove', handleTouchMove, { passive: true });

    // 15. 60 FPS Physically-Inspired Underwater Render Loop
    let animId: number;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isPlayingRef.current) {
        clock += 0.016;

        // 1. Dynamic Depth-Interpolated Exponential Fog & ClearColor
        const depthNorm = THREE.MathUtils.clamp((15.0 - camera.position.y) / 30.0, 0.0, 1.0);
        const currentFogColor = new THREE.Color();
        if (depthNorm < 0.5) {
          currentFogColor.lerpColors(shallowColor, midColor, depthNorm * 2.0);
        } else {
          currentFogColor.lerpColors(midColor, deepColor, (depthNorm - 0.5) * 2.0);
        }
        fog.color.copy(currentFogColor);
        renderer.setClearColor(currentFogColor);

        // Dynamic fog density based on depth (denser deeper = less visibility)
        fog.density = 0.018 + depthNorm * 0.015;

        // Dynamic sun intensity based on depth
        sunDirectional.intensity = Math.max(0.2, 3.8 - depthNorm * 3.2);
        ambientLight.intensity = Math.max(0.3, 1.1 - depthNorm * 0.6);

        // 2. Animated Caustic Pattern Scrolling on Seabed
        causticTexture.offset.x = (clock * 0.04) % 1;
        causticTexture.offset.y = (clock * 0.03) % 1;

        // 3. Volumetric God-Ray Light Shaft Pulsing & Noise
        godRayPlanes.forEach((ray, idx) => {
          const rayOpacity = Math.max(0, 0.06 + Math.sin(clock * 1.4 + idx * 0.8) * 0.025);
          // Fade god rays with depth
          (ray.material as THREE.MeshBasicMaterial).opacity = rayOpacity * (1 - depthNorm * 0.8);
        });

        // 4. Water Surface Ripples
        const wavePos = surfaceGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < wavePos.length; i += 3) {
          const u = wavePos[i];
          const v = wavePos[i + 1];
          wavePos[i + 2] = Math.sin(u * 0.2 + clock * 2.0) * Math.cos(v * 0.2 + clock * 1.6) * 0.5;
        }
        surfaceGeo.attributes.position.needsUpdate = true;

        // 5. ARGO Float Bobbing & Pulsing Beacon
        argoFloat.position.y = 12.0 + Math.sin(clock * 1.8) * 0.35;
        beacon.material.color.setHex(Math.sin(clock * 5.0) > 0 ? 0x38bdf8 : 0x0369a1);

        // 6. Tuna Predatory Cruising & Spine Flexing
        const tunaRadius = 20.0;
        const tunaSpeed = clock * 0.9;
        tunaMeshes.forEach((tuna, idx) => {
          const offsetAngle = idx * 0.45;
          const tx = Math.cos(tunaSpeed + offsetAngle) * (tunaRadius + idx * 1.0);
          const tz = Math.sin(tunaSpeed + offsetAngle) * (tunaRadius + idx * 0.8);
          const ty = -3.0 + Math.sin(clock * 1.5 + idx) * 1.5;

          tuna.position.set(tx, ty, tz);
          tuna.rotation.y = -(tunaSpeed + offsetAngle) + Math.PI / 2;
          tuna.rotation.y += Math.sin(clock * 9.0 + idx) * 0.16;
        });

        // 7. Majestic Manta Ray Gliding with Flapping Wings
        const mantaAngle = clock * 0.32;
        manta.position.x = Math.cos(mantaAngle) * 16.0;
        manta.position.z = Math.sin(mantaAngle) * 16.0;
        manta.position.y = 6.5 + Math.sin(clock * 1.1) * 1.2;
        manta.rotation.y = -mantaAngle + Math.PI / 2;
        leftWing.rotation.z = Math.sin(clock * 2.0) * 0.32;
        rightWing.rotation.z = -Math.sin(clock * 2.0) * 0.32;

        // 8. Mackerel Baitball Swirl
        mackerelMeshes.forEach((mack, idx) => {
          const bAngle = clock * 1.6 + (idx / mackerelCount) * Math.PI * 2;
          const bRadius = 4.0 + Math.sin(clock * 2.2 + idx) * 0.9;
          const bY = 4.5 + Math.cos(clock * 1.5 + idx * 0.4) * 1.8;

          mack.position.set(Math.cos(bAngle) * bRadius, bY, Math.sin(bAngle) * bRadius);
          mack.rotation.y = -bAngle + Math.PI / 2;
        });

        // 9. Jellyfish Breathing Pulsation
        jellyMeshes.forEach((jelly, idx) => {
          const pulse = 1.0 + Math.sin(clock * 2.8 + idx) * 0.2;
          jelly.scale.set(pulse, 1.0 / pulse, pulse);
          jelly.position.y += Math.sin(clock * 1.2 + idx) * 0.012;
        });

        // 10. Particulate Drift & Upward Current
        planktonField.rotation.y += 0.0005;

        // 11. Bubble Stream Animation
        const bubblePos = bubbleGeo.attributes.position.array as Float32Array;
        const timeFactor = clock * 0.5;

        for (let i = 0; i < bubbleCount; i++) {
          const idx = i * 3;

          // Update bubble position based on velocity
          bubblePos[idx] += bubbleVelocities[idx];
          bubblePos[idx + 1] += bubbleVelocities[idx + 1];
          bubblePos[idx + 2] += bubbleVelocities[idx + 2];

          // Add slight oscillation for natural movement
          bubblePos[idx] += Math.sin(timeFactor + i * 0.1) * 0.002;
          bubblePos[idx + 2] += Math.cos(timeFactor + i * 0.15) * 0.002;

          // When bubble reaches surface, reset it to bottom
          if (bubblePos[idx + 1] > 14.0) {
            bubblePos[idx + 1] = 8.0;
            bubblePos[idx] = (Math.random() - 0.5) * 15;
            bubblePos[idx + 2] = (Math.random() - 0.5) * 15;

            if (i % 3 === 0) {
              bubblePos[idx] = 12 + (Math.random() - 0.5) * 2;
              bubblePos[idx + 2] = -8 + (Math.random() - 0.5) * 2;
            }
            else if (i % 5 === 0 && tunaMeshes.length > 0) {
              const tunaIdx = i % tunaMeshes.length;
              bubblePos[idx] = tunaMeshes[tunaIdx].position.x;
              bubblePos[idx + 1] = tunaMeshes[tunaIdx].position.y;
              bubblePos[idx + 2] = tunaMeshes[tunaIdx].position.z;
            }
          }
        }
        bubbleGeo.attributes.position.needsUpdate = true;

        // ============================================================
        // 12. CAMERA MODES — Cinematic / Free-Swim (WASD) / Orbit
        // ============================================================
        const buoyancyBob = Math.sin(clock * 0.5) * 0.035;
        const buoyancySway = Math.sin(clock * 0.35) * 0.012;

        if (cameraModeRef.current === 'cinematic') {
          // Guided Submarine Dive Tour — smooth cinematic orbit
          const tourAngle = clock * 0.22;
          const tourRadius = 22.0 + Math.sin(clock * 0.15) * 4.0;
          camera.position.x = Math.cos(tourAngle) * tourRadius;
          camera.position.z = Math.sin(tourAngle) * tourRadius;
          camera.position.y = -1.0 + Math.sin(clock * 0.35) * 7.0 + buoyancyBob;
          camera.rotation.z = buoyancySway;
          camera.lookAt(0, -2, 0);
          setCurrentDepthM(Math.round(Math.abs(camera.position.y - 15) * 3));

        } else if (cameraModeRef.current === 'swim') {
          // =====================================================
          // FIRST-PERSON FREE-SWIM — Euler-based mouse look + WASD
          // =====================================================
          
          // Build forward direction from Euler yaw & pitch
          const forward = new THREE.Vector3(
            Math.sin(swimYaw) * Math.cos(swimPitch),
            Math.sin(swimPitch),
            Math.cos(swimYaw) * Math.cos(swimPitch)
          ).normalize();
          
          // Horizontal forward (for WASD — no vertical component)
          const flatForward = new THREE.Vector3(Math.sin(swimYaw), 0, Math.cos(swimYaw)).normalize();
          
          // Right vector
          const right = new THREE.Vector3();
          right.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

          // Build acceleration from key input
          const accel = new THREE.Vector3(0, 0, 0);
          
          if (keysPressed['w'] || keysPressed['arrowup']) {
            accel.addScaledVector(flatForward, SWIM_ACCEL);
          }
          if (keysPressed['s'] || keysPressed['arrowdown']) {
            accel.addScaledVector(flatForward, -SWIM_ACCEL);
          }
          if (keysPressed['a'] || keysPressed['arrowleft']) {
            accel.addScaledVector(right, -SWIM_ACCEL);
          }
          if (keysPressed['d'] || keysPressed['arrowright']) {
            accel.addScaledVector(right, SWIM_ACCEL);
          }
          
          // Vertical (ascend/descend)
          if (keysPressed[' '] || keysPressed['e']) {
            accel.y += SWIM_ACCEL;
          }
          if (keysPressed['shift'] || keysPressed['c'] || keysPressed['q']) {
            accel.y -= SWIM_ACCEL;
          }
          
          // Apply acceleration and friction for smooth inertial movement
          swimVelocity.add(accel);
          swimVelocity.multiplyScalar(SWIM_FRICTION);
          
          // Clamp speed
          if (swimVelocity.length() > SWIM_MAX_SPEED) {
            swimVelocity.normalize().multiplyScalar(SWIM_MAX_SPEED);
          }
          
          // Update position
          swimPos.add(swimVelocity);
          
          // Clamp to world bounds
          swimPos.y = Math.max(-17.0, Math.min(14.5, swimPos.y));
          swimPos.x = Math.max(-55, Math.min(55, swimPos.x));
          swimPos.z = Math.max(-55, Math.min(55, swimPos.z));
          
          // Apply position + natural buoyancy sway
          camera.position.copy(swimPos);
          camera.position.y += buoyancyBob * 0.15;
          
          // Apply look direction from Euler angles
          const lookTarget = new THREE.Vector3().copy(swimPos).add(forward);
          camera.lookAt(lookTarget);
          
          // Subtle diver roll sway
          camera.rotation.z = buoyancySway * 0.5;
          
          setCurrentDepthM(Math.round(Math.abs(camera.position.y - 15) * 3));
          
        } else {
          // Smooth Orbit Mode
          camera.position.x = Math.sin(cameraAngle) * Math.cos(cameraPitch) * cameraDist;
          camera.position.z = Math.cos(cameraAngle) * Math.cos(cameraPitch) * cameraDist;
          camera.position.y = Math.sin(cameraPitch) * cameraDist + buoyancyBob;
          camera.rotation.z = buoyancySway;
          camera.lookAt(0, 0, 0);
          setCurrentDepthM(Math.round(Math.abs(camera.position.y - 15) * 3));
        }
      }

      // Update lens shader time uniform
      if (lensPass.uniforms.uTime) {
        lensPass.uniforms.uTime.value = clock;
      }

      composer.render();
    };

    animate();

    const handleResize = () => {
      if (!currentMount) return;
      width = currentMount.clientWidth;
      height = currentMount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
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
      dom.removeEventListener('touchstart', handleTouchStart);
      dom.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      if (isPointerLocked) {
        document.exitPointerLock?.();
      }
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isMHWMode]);

  return (
    <div className="relative w-full h-full min-h-[540px] rounded-2xl overflow-hidden border border-cyan-500/40 bg-[#010915] shadow-2xl flex flex-col font-sans select-none">
      
      {/* 3D Living Ocean WebGL & Post-Processing Viewport */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Diver Depth HUD Gauge (Left) */}
      <div className="absolute top-20 left-4 z-20 hidden md:flex flex-col items-center bg-[#071322]/90 backdrop-blur-xl px-2.5 py-3 rounded-2xl border border-cyan-500/40 text-cyan-300 font-mono text-[10px] shadow-2xl space-y-2 pointer-events-none">
        <span className="text-[9px] font-bold text-slate-400 uppercase">DEPTH</span>
        <div className="text-sm font-black text-white font-heading">{currentDepthM}m</div>
        <div className="w-1.5 h-28 bg-slate-800 rounded-full overflow-hidden relative">
          <div 
            className="w-full bg-gradient-to-b from-cyan-400 via-teal-400 to-amber-400 absolute top-0 transition-all duration-300 rounded-full"
            style={{ height: `${Math.min(100, (currentDepthM / 100) * 100)}%` }}
          />
        </div>
        <span className="text-[8px] text-slate-400">100m</span>
      </div>

      {/* Swim Mode Crosshair Reticle */}
      {cameraMode === 'swim' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-2.5 bg-cyan-400/60" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-2.5 bg-cyan-400/60" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-[1px] bg-cyan-400/60" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-[1px] bg-cyan-400/60" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-400/90" />
          </div>
        </div>
      )}

      {/* WASD Control Hint Overlay — appears only in Swim mode */}
      {cameraMode === 'swim' && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-1 bg-[#071322]/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-cyan-500/30 shadow-2xl">
            <div className="flex items-center gap-0.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold text-xs font-mono">W</div>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold text-xs font-mono">A</div>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold text-xs font-mono">S</div>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold text-xs font-mono">D</div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-mono text-slate-400">
                <span className="text-cyan-300 font-bold">SPACE</span> Ascend · <span className="text-cyan-300 font-bold">Q</span> Descend · <span className="text-cyan-300 font-bold">Mouse</span> Look
              </span>
            </div>
            <span className="text-[8px] text-slate-500 mt-0.5">Click viewport to lock mouse look · ESC to release</span>
          </div>
        </div>
      )}

      {/* Target Reticle Lock Indicator on Hover */}
      {hoveredObject && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-cyan-400/80 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="mt-2 px-2.5 py-1 rounded-lg bg-[#071322]/90 backdrop-blur-md border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold shadow-xl">
            🎯 Inspect: {hoveredObject}
          </div>
        </div>
      )}

      {/* Top Telemetry Banner */}
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
                CINEMATIC LIVING 3D
              </span>
            </div>
            <p className="text-[10px] text-cyan-300/80 font-mono">
              Soft God-Rays • Caustics • Manta Ray • Yellowfin Tuna • Sand Ripples
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
              setCameraMode(cameraMode === 'cinematic' ? 'swim' : cameraMode === 'swim' ? 'orbit' : 'cinematic');
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              cameraMode === 'cinematic'
                ? 'bg-gradient-to-r from-teal-500/30 to-cyan-500/30 border-teal-400 text-teal-200 shadow-glow-teal-sm'
                : cameraMode === 'swim'
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-[#09182a] border-cyan-500/30 text-slate-300 hover:text-white'
            }`}
          >
            {cameraMode === 'cinematic' ? (
              <Camera className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
            ) : (
              <Compass className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>
              {cameraMode === 'cinematic'
                ? 'Cinematic Diver Tour'
                : cameraMode === 'swim'
                ? 'Diver Free-Swim (WASD)'
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