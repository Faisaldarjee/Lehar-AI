import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Box, 
  Play, 
  Pause, 
  Scissors, 
  Sparkles, 
  Flame, 
  Layers, 
  Volume2, 
  VolumeX,
  Radio,
  Activity
} from 'lucide-react';
import { speakText, stopVoice } from '../../services/voiceSynthesis';

interface OceanLens3DProps {
  selectedFloatId?: string | null;
  profileData?: Array<{ depth?: number | null; temperature?: number | null; salinity?: number | null }>;
  isMHWMode?: boolean;
  onClose?: () => void;
}

export const OceanLens3D: React.FC<OceanLens3DProps> = ({
  selectedFloatId,
  profileData = [],
  isMHWMode = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // UI & Playback Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [mhwActive, setMhwActive] = useState<boolean>(isMHWMode);
  const [slicePercent, setSlicePercent] = useState<number>(0);
  const [showSliceControls, setShowSliceControls] = useState<boolean>(false);
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [mldDepth, setMldDepth] = useState<number | null>(null);

  // Probe Hover Telemetry State
  const [hoveredProbe, setHoveredProbe] = useState<{
    depthM: number;
    tempC: number;
    salPSU: number;
    density: number;
    zoneName: string;
    screenX: number;
    screenY: number;
    visible: boolean;
  }>({
    depthM: 0,
    tempC: 28.5,
    salPSU: 35.2,
    density: 1023.2,
    zoneName: 'Surface Sunlit Zone',
    screenX: 0,
    screenY: 0,
    visible: false,
  });

  // Telemetry DOM Refs for 60fps high performance updates
  const depthValueRef = useRef<HTMLSpanElement>(null);
  const tempValueRef = useRef<HTMLSpanElement>(null);
  const salValueRef = useRef<HTMLSpanElement>(null);
  const zoneNameRef = useRef<HTMLSpanElement>(null);

  // Live mutable animation state refs
  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;
  const slicePercentRef = useRef(0);
  slicePercentRef.current = slicePercent;
  const mhwActiveRef = useRef(isMHWMode);
  mhwActiveRef.current = mhwActive;
  const showParticlesRef = useRef(true);
  showParticlesRef.current = showParticles;
  const showWireframeRef = useRef(true);
  showWireframeRef.current = showWireframe;
  const isTourActiveRef = useRef(false);
  isTourActiveRef.current = isTourActive;

  // Filter and sort observed profile
  const observedProfile = useMemo(() => {
    return profileData
      .filter((s) => typeof s.depth === 'number')
      .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  }, [profileData]);

  const observedMaxDepth = useMemo(() => {
    return Math.max(...observedProfile.map((s) => s.depth ?? 0), 2000);
  }, [observedProfile]);

  // Compute Mixed Layer Depth (MLD)
  useEffect(() => {
    if (observedProfile.length > 1) {
      const surfaceRef = observedProfile[0].temperature ?? 28.5;
      for (const sample of observedProfile) {
        if (typeof sample.temperature === 'number' && typeof sample.depth === 'number') {
          if (surfaceRef - sample.temperature >= 0.5) {
            setMldDepth(Math.round(sample.depth));
            return;
          }
        }
      }
      setMldDepth(38); // default ocean average
    } else {
      setMldDepth(38);
    }
  }, [observedProfile]);

  // Three.js Scene Engine
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let width = currentMount.clientWidth || 800;
    let height = currentMount.clientHeight || 500;

    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010814);
    scene.fog = new THREE.FogExp2(0x010814, 0.024);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(19, 11, 23);
    camera.lookAt(0, 0, 0);

    // 3. Renderer with ACES Tone Mapping & Shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    currentMount.appendChild(renderer.domElement);

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0x14b8a6, 0.55);
    scene.add(ambientLight);

    // Top Sunlight Spotlight with Caustics Warmth
    const sunLight = new THREE.DirectionalLight(0x7dd3fc, 2.2);
    sunLight.position.set(12, 35, 12);
    scene.add(sunLight);

    // Secondary Rim Light
    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 1.2);
    rimLight.position.set(-15, 15, -15);
    scene.add(rimLight);

    // Deep Abyssal Glow PointLight
    const deepLight = new THREE.PointLight(0x0284c7, 3.5, 45, 1.8);
    deepLight.position.set(0, -12, 0);
    scene.add(deepLight);

    // 5. Volumetric Water Column Shader Mesh
    const cylinderRadius = 7.5;
    const cylinderHeight = 20.0; // Y from +10 (0m) to -10 (2000m)
    const oceanGeo = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 48, true);

    // Custom Ocean Absorption & Light Extinction Shader
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSlicePercent: { value: 0 },
        uIsMHW: { value: mhwActiveRef.current ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vDepthRatio;

        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          // Y goes from +10.0 (Surface, 0m) to -10.0 (Abyss, 2000m)
          vDepthRatio = clamp((10.0 - position.y) / 20.0, 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSlicePercent;
        uniform float uIsMHW;

        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vDepthRatio;

        void main() {
          // Angle-based slice clipping
          if (uSlicePercent > 0.001) {
            float angle = atan(vPosition.z, vPosition.x); // [-PI, PI]
            float normAngle = (angle + 3.14159265) / (2.0 * 3.14159265);
            if (normAngle < uSlicePercent) {
              discard;
            }
          }

          // Layer 1: Sunlit Epipelagic (0 - 50m) -> Cyan/Teal
          vec3 sunlitColor = vec3(0.18, 0.72, 0.95);
          // Layer 2: Thermocline Mesopelagic (50 - 300m) -> Emerald/Teal
          vec3 thermoColor = vec3(0.05, 0.58, 0.52);
          // Layer 3: Twilight Bathypelagic (300 - 1000m) -> Deep Indigo/Navy
          vec3 twilightColor = vec3(0.04, 0.16, 0.32);
          // Layer 4: Abyssal Midnight (1000 - 2000m) -> Pitch Black with cyan sheen
          vec3 abyssColor = vec3(0.01, 0.04, 0.10);

          vec3 baseWaterColor;
          if (vDepthRatio < 0.15) {
            baseWaterColor = mix(sunlitColor, thermoColor, vDepthRatio / 0.15);
          } else if (vDepthRatio < 0.45) {
            baseWaterColor = mix(thermoColor, twilightColor, (vDepthRatio - 0.15) / 0.30);
          } else {
            baseWaterColor = mix(twilightColor, abyssColor, (vDepthRatio - 0.45) / 0.55);
          }

          // Marine Heatwave (MHW) Thermal Anomaly Spike injection at surface (0 - 80m)
          if (uIsMHW > 0.5 && vDepthRatio < 0.12) {
            vec3 heatwaveColor = vec3(0.98, 0.32, 0.08); // Hot Crimson Amber
            float heatIntensity = (1.0 - (vDepthRatio / 0.12));
            baseWaterColor = mix(baseWaterColor, heatwaveColor, heatIntensity * 0.75);
          }

          // Fresnel Edge Glow for Glassmorphic Depth Feeling
          vec3 viewDir = normalize(vPosition);
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.2);

          // Subtle Caustic Wave Ripple Simulation
          float ripple = sin(vPosition.y * 3.5 + uTime * 2.0) * cos(vPosition.x * 3.5 + uTime * 1.5) * 0.08;
          baseWaterColor += vec3(ripple * 0.4, ripple * 0.7, ripple * 0.9);

          float alpha = mix(0.35, 0.85, vDepthRatio) + fresnel * 0.35;
          gl_FragColor = vec4(baseWaterColor + fresnel * 0.25, clamp(alpha, 0.25, 0.92));
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const oceanVolume = new THREE.Mesh(oceanGeo, oceanMat);
    scene.add(oceanVolume);

    // 6. Wireframe Structural Cage Mesh
    const wireGeo = new THREE.CylinderGeometry(cylinderRadius + 0.06, cylinderRadius + 0.06, cylinderHeight, 16, 12, true);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // 7. Glowing Surface Water Plane (0m)
    const discGeo = new THREE.CircleGeometry(cylinderRadius, 48);
    const surfaceDiscMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const surfaceDisc = new THREE.Mesh(discGeo, surfaceDiscMat);
    surfaceDisc.rotation.x = Math.PI / 2;
    surfaceDisc.position.y = 10.0;
    scene.add(surfaceDisc);

    // 8. Glowing MLD / Thermocline Boundary Ring & Disc (Calculated dynamically)
    const calcMldVal = mldDepth ?? 38;
    const mldY = 10.0 - (Math.min(calcMldVal, 2000) / 2000) * 20.0;

    const mldRingGeo = new THREE.RingGeometry(cylinderRadius - 0.25, cylinderRadius + 0.35, 48);
    const mldRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const mldRing = new THREE.Mesh(mldRingGeo, mldRingMat);
    mldRing.rotation.x = Math.PI / 2;
    mldRing.position.y = mldY;
    scene.add(mldRing);

    const mldDiscMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14,
    });
    const mldDisc = new THREE.Mesh(discGeo, mldDiscMat);
    mldDisc.rotation.x = Math.PI / 2;
    mldDisc.position.y = mldY;
    scene.add(mldDisc);

    // 9. Procedural 3D ARGO Robot Float Model
    const argoFloatGroup = new THREE.Group();

    // 9a. Yellow Pressure Hull
    const hullGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xeab308, // INCOIS High-Vis ARGO Yellow
      roughness: 0.3,
      metalness: 0.2,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    argoFloatGroup.add(hull);

    // 9b. Black Stability Collar
    const collarGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.25, 16);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 0.35;
    argoFloatGroup.add(collar);

    // 9c. Top CTD Sensor Intake Ring
    const ctdGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 16);
    const ctdMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const ctdHead = new THREE.Mesh(ctdGeo, ctdMat);
    ctdHead.position.y = 0.85;
    argoFloatGroup.add(ctdHead);

    // 9d. Satellite & GPS Antenna Mast
    const antennaGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 1.35;
    argoFloatGroup.add(antenna);

    // 9e. Blinking Comms LED Sphere
    const ledGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.y = 1.82;
    argoFloatGroup.add(led);

    // Position float in ocean space
    argoFloatGroup.position.set(2.2, 10.0, 1.8);
    argoFloatGroup.scale.set(1.4, 1.4, 1.4);
    scene.add(argoFloatGroup);

    // Dynamic Slicing Scanner Ring
    const scanRingGeo = new THREE.RingGeometry(cylinderRadius - 0.1, cylinderRadius + 0.15, 48);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
    scanRing.rotation.x = Math.PI / 2;
    scanRing.position.y = 10.0;
    scene.add(scanRing);

    // 10. 1,200+ Dynamic Bioluminescent Marine Snow & Flow Particles
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const r = Math.random() * (cylinderRadius - 0.5);
      const theta = Math.random() * Math.PI * 2;
      particlePositions[i * 3] = Math.cos(theta) * r;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * cylinderHeight;
      particlePositions[i * 3 + 2] = Math.sin(theta) * r;
      particleSpeeds[i] = 0.015 + Math.random() * 0.025;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.15,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 11. Interactive Raycasting Depth Probe
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(oceanVolume);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitY = hit.point.y; // [-10, 10]
        const normRatio = (10.0 - hitY) / 20.0;
        const depthM = Math.round(normRatio * 2000);

        // Interpolate scientific values
        let tempAtDepth = 28.5;
        let salAtDepth = 35.2;
        if (observedProfile.length > 0) {
          const depthSpan = observedMaxDepth > 0 ? observedMaxDepth : 2000;
          const targetD = normRatio * depthSpan;
          const nearest = observedProfile.reduce((p, c) =>
            Math.abs((c.depth ?? 0) - targetD) < Math.abs((p.depth ?? 0) - targetD) ? c : p
          );
          if (typeof nearest.temperature === 'number') tempAtDepth = nearest.temperature;
          if (typeof nearest.salinity === 'number') salAtDepth = nearest.salinity;
        } else {
          tempAtDepth = parseFloat((29.5 - normRatio * 26.0).toFixed(2));
          salAtDepth = parseFloat((35.0 + Math.sin(normRatio * Math.PI) * 0.8).toFixed(2));
        }

        // Density approximation (UNESCO equation of state simplified)
        const density = 1000 + 0.8 * salAtDepth - 0.2 * tempAtDepth + (depthM * 0.0045);

        let zone = 'Epipelagic (Sunlit Zone)';
        if (depthM > 1000) zone = 'Bathypelagic (Abyssal Cold Zone)';
        else if (depthM > 200) zone = 'Mesopelagic (Twilight Layer)';
        else if (depthM >= (calcMldVal - 15) && depthM <= (calcMldVal + 25)) zone = 'Thermocline Gradient Peak';

        setHoveredProbe({
          depthM,
          tempC: parseFloat(tempAtDepth.toFixed(2)),
          salPSU: parseFloat(salAtDepth.toFixed(2)),
          density: parseFloat(density.toFixed(1)),
          zoneName: zone,
          screenX: e.clientX - rect.left,
          screenY: e.clientY - rect.top,
          visible: true,
        });
      } else {
        setHoveredProbe((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    };

    // 12. Mouse Drag Orbit Controls with Smooth Damping
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraAngle = 0.85;
    let cameraDistance = 29.0;
    let cameraHeight = 11.0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        handlePointerMove(e);
        return;
      }
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      cameraAngle += dx * 0.008;
      cameraHeight = Math.max(-12, Math.min(26, cameraHeight - dy * 0.06));

      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(14.0, Math.min(48.0, cameraDistance + e.deltaY * 0.03));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('wheel', handleWheel, { passive: false });

    // 13. 60FPS Main Animation Loop
    let animationFrameId: number;
    let time = 0;
    let diveTime = 0;
    let lastDomWrite = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      time += 0.016;

      // Update shader uniforms
      oceanMat.uniforms.uTime.value = time;
      oceanMat.uniforms.uSlicePercent.value = slicePercentRef.current / 100.0;
      oceanMat.uniforms.uIsMHW.value = mhwActiveRef.current ? 1.0 : 0.0;

      // Toggle mesh visibilities
      wireMesh.visible = showWireframeRef.current;
      particleSystem.visible = showParticlesRef.current;

      // Float robot dive animation
      if (isPlayingRef.current) {
        diveTime += 0.014;
        const currentY = Math.sin(diveTime) * 9.5;
        scanRing.position.y = currentY;
        argoFloatGroup.position.y = currentY;

        // Blinking LED pulse
        ledMat.color.setHex((Math.sin(time * 8.0) > 0.3) ? 0x38bdf8 : 0x075985);

        // Map telemetry to DOM
        const normRatio = (10.0 - currentY) / 20.0;
        const liveDepthM = Math.round(normRatio * 2000);

        let liveTemp = 28.5;
        let liveSal = 35.2;
        if (observedProfile.length > 0) {
          const depthSpan = observedMaxDepth > 0 ? observedMaxDepth : 2000;
          const targetD = normRatio * depthSpan;
          const nearest = observedProfile.reduce((p, c) =>
            Math.abs((c.depth ?? 0) - targetD) < Math.abs((p.depth ?? 0) - targetD) ? c : p
          );
          if (typeof nearest.temperature === 'number') liveTemp = nearest.temperature;
          if (typeof nearest.salinity === 'number') liveSal = nearest.salinity;
        } else {
          liveTemp = parseFloat((29.5 - normRatio * 26.0).toFixed(2));
          liveSal = parseFloat((35.0 + Math.sin(normRatio * Math.PI) * 0.8).toFixed(2));
        }

        const now = performance.now();
        if (now - lastDomWrite > 200) {
          lastDomWrite = now;
          if (depthValueRef.current) depthValueRef.current.textContent = `${liveDepthM}m`;
          if (tempValueRef.current) tempValueRef.current.textContent = `${liveTemp.toFixed(1)}°C`;
          if (salValueRef.current) salValueRef.current.textContent = `${liveSal.toFixed(1)} PSU`;
          if (zoneNameRef.current) {
            zoneNameRef.current.textContent =
              liveDepthM > 1000 ? 'Bathypelagic (Abyss)' : liveDepthM > 200 ? 'Mesopelagic (Twilight)' : 'Epipelagic (Sunlit)';
          }
        }
      }

      // Bioluminescent Particles Flow & Helical Coriolis Drift
      if (showParticlesRef.current) {
        const positions = particleGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] -= particleSpeeds[i];
          if (positions[i * 3 + 1] < -10.0) {
            positions[i * 3 + 1] = 10.0;
          }
        }
        particleGeo.attributes.position.needsUpdate = true;
        particleSystem.rotation.y += 0.0012;
      }

      // Camera Orbit Navigation (Smooth Damping or Guided Tour Mode)
      if (!isTourActiveRef.current) {
        camera.position.x = Math.sin(cameraAngle) * cameraDistance;
        camera.position.z = Math.cos(cameraAngle) * cameraDistance;
        camera.position.y = cameraHeight;
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
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
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('wheel', handleWheel);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }

      // Complete GPU memory cleanup
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [profileData, mldDepth]);

  // 1-Click 2-Minute Cinematic Guided Judge Tour Handler
  const handleStartGuidedTour = () => {
    if (isTourActive) {
      setIsTourActive(false);
      stopVoice();
      return;
    }
    setIsTourActive(true);
    setTourStep(1);

    const steps = [
      { step: 1, text: "Step 1: Epipelagic Zone (0 to 50m). Solar penetration drives high phytoplankton bio-productivity and pelagic fish feeding.", duration: 6000 },
      { step: 2, text: `Step 2: Mixed Layer Depth at ${mldDepth || 38}m. Wind-driven vertical mixing keeps temperature stable before the steep thermocline drop.`, duration: 6500 },
      { step: 3, text: "Step 3: Thermocline Boundary (200m). Rapid thermal gradient drops temperature from 28°C to below 12°C, creating a natural acoustic sound channel.", duration: 7000 },
      { step: 4, text: "Step 4: Bathypelagic Abyssal Zone (1,000m to 2,000m). Total darkness where deep ARGO park cycles monitor long-term global ocean heat content.", duration: 7500 },
    ];

    let currentIdx = 0;
    if (voiceEnabled) {
      speakText(steps[0].text, 'en');
    }

    const interval = setInterval(() => {
      currentIdx++;
      if (currentIdx < steps.length) {
        setTourStep(steps[currentIdx].step);
        if (voiceEnabled) {
          speakText(steps[currentIdx].text, 'en');
        }
      } else {
        clearInterval(interval);
        setIsTourActive(false);
        setTourStep(0);
      }
    }, 6500);
  };

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-2xl overflow-hidden border border-abyssal-800/80 bg-abyssal-950 shadow-2xl flex flex-col font-sans select-none">
      
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive Raycast Probe Tooltip (Floats dynamically over 3D Water Column) */}
      {hoveredProbe.visible && (
        <div
          className="absolute z-30 pointer-events-none p-3 rounded-xl bg-abyssal-950/95 backdrop-blur-xl border border-cyan-500/50 shadow-2xl space-y-1 transform -translate-x-1/2 -translate-y-full transition-all duration-75 min-w-[210px]"
          style={{ left: `${hoveredProbe.screenX}px`, top: `${hoveredProbe.screenY - 12}px` }}
        >
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1">
            <span className="text-[10px] font-mono text-ocean-cyan font-bold uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>In-Situ Probe</span>
            </span>
            <span className="text-[11px] font-bold font-mono text-white bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-500/40">
              {hoveredProbe.depthM}m
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div>
              <span className="text-[9px] text-slate-400 block">Temperature</span>
              <span className="font-bold text-amber-300 text-sm">{hoveredProbe.tempC}°C</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block">Salinity</span>
              <span className="font-bold text-emerald-300 text-sm">{hoveredProbe.salPSU} PSU</span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-abyssal-800 flex justify-between">
            <span>Density: {hoveredProbe.density} kg/m³</span>
          </div>
          <div className="text-[9px] font-sans font-semibold text-cyan-300/90 truncate">
            {hoveredProbe.zoneName}
          </div>
        </div>
      )}

      {/* Top Floating Telemetry & Title Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left Title Badge */}
        <div className="flex items-center gap-2 bg-abyssal-950/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-500/40 text-ocean-cyan shadow-glow-cyan-sm pointer-events-auto">
          <Box className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '12s' }} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-white font-heading">
                Ocean Twin 3D
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                {mhwActive ? '🚨 MHW HEATWAVE ACTIVE' : 'ARGO IN-SITU'}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono">
              Float #{selectedFloatId || '2902150'} • 0–2,000m Volumetric Twin
            </p>
          </div>
        </div>

        {/* Right Real-time Telemetry Gauge */}
        <div className="flex items-center gap-3 bg-abyssal-950/95 backdrop-blur-md px-4 py-1.5 rounded-xl border border-abyssal-800 font-mono text-xs text-slate-300 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase">Dive:</span>
            <span ref={depthValueRef} className="font-bold text-white text-sm">0m</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase">Temp:</span>
            <span ref={tempValueRef} className="text-amber-400 font-bold">28.4°C</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase">Sal:</span>
            <span ref={salValueRef} className="text-emerald-400 font-bold">35.2 PSU</span>
          </div>
          <span className="text-slate-700">|</span>
          <span ref={zoneNameRef} className="text-[10px] text-cyan-300 font-sans font-semibold hidden md:inline">
            Epipelagic (Sunlit)
          </span>
        </div>
      </div>

      {/* Guided Tour Narrative Banner (When Tour is Active) */}
      {isTourActive && (
        <div className="absolute top-16 left-3 right-3 z-20 p-3 rounded-xl bg-abyssal-950/95 backdrop-blur-xl border border-amber-500/60 shadow-glow-amber-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0 font-bold font-mono text-xs">
              0{tourStep}
            </div>
            <p className="text-xs font-medium text-slate-100 leading-relaxed">
              {tourStep === 1 && "Sunlit Epipelagic Zone (0-50m): Maximum chlorophyll photosynthesis and pelagic feeding activity."}
              {tourStep === 2 && `Mixed Layer Depth (${mldDepth || 38}m): Active turbulent mixing boundary separating warm surface and cold deep water.`}
              {tourStep === 3 && "Thermocline Barrier (200m): Steep vertical temperature gradient (dT/dz) dropping to below 12°C."}
              {tourStep === 4 && "Abyssal Midnight Zone (1,000m-2,000m): Deep ocean baseline monitoring long-term oceanic heat capacity."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsTourActive(false);
              stopVoice();
            }}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer"
          >
            End Tour
          </button>
        </div>
      )}

      {/* Interactive Slicing Plane Tool / Slider Bar */}
      {showSliceControls && (
        <div className="absolute top-16 right-3 z-10 p-3 rounded-xl bg-abyssal-950/95 backdrop-blur-xl border border-cyan-500/30 shadow-2xl space-y-2 w-64 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Cross-Section Slicing</span>
            </span>
            <span className="font-mono text-cyan-300 text-[11px]">{slicePercent}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="75"
            value={slicePercent}
            onChange={(e) => setSlicePercent(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <p className="text-[9px] text-slate-400 leading-tight font-mono">
            Cut through the water column to inspect internal thermal stratification.
          </p>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left Action Buttons: Play/Pause, Slicing, MHW Toggle & Guided Tour */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          
          {/* 1. Play / Pause Dive Animation */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              isPlaying
                ? 'bg-abyssal-900/95 border-abyssal-800 text-slate-200 hover:text-white'
                : 'bg-amber-500/25 border-amber-500/60 text-amber-300'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Pause Dive' : 'Resume Dive'}</span>
          </button>

          {/* 2. Slicing Plane Toggle */}
          <button
            type="button"
            onClick={() => setShowSliceControls(!showSliceControls)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              showSliceControls || slicePercent > 0
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-abyssal-900/95 border-abyssal-800 text-slate-300 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cross-Section</span>
          </button>

          {/* 3. Marine Heatwave (MHW) Thermal Anomaly Toggle */}
          <button
            type="button"
            onClick={() => setMhwActive(!mhwActive)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              mhwActive
                ? 'bg-rose-500/25 border-rose-500/60 text-rose-300 shadow-glow-rose-sm'
                : 'bg-abyssal-900/95 border-abyssal-800 text-slate-300 hover:text-white'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${mhwActive ? 'text-rose-400' : 'text-slate-400'}`} />
            <span>{mhwActive ? 'Heatwave On' : 'Simulate MHW'}</span>
          </button>

          {/* 4. 1-Click 2-Minute Cinematic Guided Judge Tour */}
          <button
            type="button"
            onClick={handleStartGuidedTour}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
              isTourActive
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-abyssal-950 font-black shadow-glow-amber-lg'
                : 'bg-gradient-to-r from-teal-500/25 to-cyan-500/25 border-teal-400/50 text-teal-200 hover:from-teal-500/35 hover:to-cyan-500/35'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isTourActive ? 'text-abyssal-950 animate-spin' : 'text-teal-300'}`} />
            <span>{isTourActive ? 'Tour in Progress...' : 'Cinematic Guided Tour'}</span>
          </button>
        </div>

        {/* Right Section: Layer Toggles & Voice Mute */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          
          {/* Wireframe toggle */}
          <button
            type="button"
            onClick={() => setShowWireframe(!showWireframe)}
            title="Toggle Structural Grid Wireframe"
            className={`p-1.5 rounded-xl border text-xs transition cursor-pointer active:scale-95 ${
              showWireframe ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300' : 'bg-abyssal-900 border-abyssal-800 text-slate-500'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Bioluminescent Particles Flow toggle */}
          <button
            type="button"
            onClick={() => setShowParticles(!showParticles)}
            title="Toggle Bioluminescent Current Flow"
            className={`p-1.5 rounded-xl border text-xs transition cursor-pointer active:scale-95 ${
              showParticles ? 'bg-teal-950/80 border-teal-500/40 text-teal-300' : 'bg-abyssal-900 border-abyssal-800 text-slate-500'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          {/* Voice Mute / Unmute */}
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? 'Voice narration active' : 'Voice muted'}
            className={`p-1.5 rounded-xl border text-xs transition cursor-pointer active:scale-95 ${
              voiceEnabled ? 'bg-teal-950/80 border-teal-500/40 text-teal-300' : 'bg-abyssal-900 border-abyssal-800 text-slate-500'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

    </div>
  );
};
