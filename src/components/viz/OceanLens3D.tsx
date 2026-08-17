import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Play, Pause } from 'lucide-react';

interface OceanLens3DProps {
  selectedFloatId?: string | null;
  profileData?: Array<{ depth?: number | null; temperature?: number | null; salinity?: number | null }>;
}

export const OceanLens3D: React.FC<OceanLens3DProps> = ({ selectedFloatId, profileData = [] }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentDepthSlice, setCurrentDepthSlice] = useState(0);
  const [tempAtDepth, setTempAtDepth] = useState<number | null>(null);
  const [salAtDepth, setSalAtDepth] = useState<number | null>(null);
  const observedSampleCount = profileData.filter((sample) => typeof sample.depth === 'number').length;

  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const observedProfile = profileData
      .filter((sample) => typeof sample.depth === 'number')
      .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
    const observedMaxDepth = Math.max(...observedProfile.map((sample) => sample.depth ?? 0), 0);

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020710);
    scene.fog = new THREE.FogExp2(0x020710, 0.035);

    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(18, 12, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0x2dd4bf, 0.6);
    scene.add(ambientLight);

    const topSunLight = new THREE.DirectionalLight(0x67e8f9, 1.8);
    topSunLight.position.set(10, 30, 10);
    scene.add(topSunLight);

    const bottomDeepLight = new THREE.PointLight(0x0d9488, 2.5, 50);
    bottomDeepLight.position.set(0, -15, 0);
    scene.add(bottomDeepLight);

    // Main Ocean Depth Column Mesh (Wireframe + Glass bounding cylinder)
    const oceanDepthGeo = new THREE.CylinderGeometry(8, 8, 20, 32, 12, true);
    const oceanDepthMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      transparent: true,
      opacity: 0.18,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false,
      side: THREE.DoubleSide,
    });
    const oceanVolume = new THREE.Mesh(oceanDepthGeo, oceanDepthMat);
    scene.add(oceanVolume);

    // Wireframe grid lines on ocean cylinder
    const wireGeo = new THREE.CylinderGeometry(8.05, 8.05, 20, 16, 8, true);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // Surface Sunlit Layer Plane (0m - Epipelagic)
    const surfaceGeo = new THREE.CircleGeometry(8, 32);
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const surfacePlane = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfacePlane.rotation.x = Math.PI / 2;
    surfacePlane.position.y = 10;
    scene.add(surfacePlane);

    // Thermocline Layer Plane (200m - Mesopelagic)
    const thermoclineMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const thermoclinePlane = new THREE.Mesh(surfaceGeo, thermoclineMat);
    thermoclinePlane.rotation.x = Math.PI / 2;
    thermoclinePlane.position.y = 8;
    scene.add(thermoclinePlane);

    // Abyssal Deep Layer Plane (1000m - Bathypelagic)
    const deepMat = new THREE.MeshStandardMaterial({
      color: 0x042f2e,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const deepPlane = new THREE.Mesh(surfaceGeo, deepMat);
    deepPlane.rotation.x = Math.PI / 2;
    deepPlane.position.y = 0;
    scene.add(deepPlane);

    // Dynamic Depth Slicing Ring (Sweeps up and down to represent real-time dive)
    const ringGeo = new THREE.RingGeometry(7.8, 8.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      side: THREE.DoubleSide,
    });
    const depthRing = new THREE.Mesh(ringGeo, ringMat);
    depthRing.rotation.x = Math.PI / 2;
    depthRing.position.y = 10;
    scene.add(depthRing);

    // Active Argo Float Indicator Sphere in 3D Space
    const floatGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const floatMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
    });
    const floatSphere = new THREE.Mesh(floatGeo, floatMat);
    floatSphere.position.set(2, 10, 2);
    scene.add(floatSphere);

    // Volumetric Marine Snow / Ocean Particle Field
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = Math.random() * 7.5;
      const angle = Math.random() * Math.PI * 2;
      particlePos[i] = Math.cos(angle) * radius;
      particlePos[i + 1] = (Math.random() - 0.5) * 20;
      particlePos[i + 2] = Math.sin(angle) * radius;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.12,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Mouse Drag Rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      oceanVolume.rotation.y += deltaX * 0.008;
      wireMesh.rotation.y += deltaX * 0.008;
      particles.rotation.y += deltaX * 0.005;

      camera.position.y = Math.max(-10, Math.min(25, camera.position.y - deltaY * 0.05));
      camera.lookAt(0, 0, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation Loop
    let animationFrameId: number;
    let diveTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (isPlayingRef.current) {
        diveTime += 0.015;
        const currentY = Math.sin(diveTime) * 10;
        depthRing.position.y = currentY;
        floatSphere.position.y = currentY;

        // Map Y from [10, -10] to Depth [0m, 2000m]
        const normalizedDepthRatio = (10 - currentY) / 20;
        const mappedDepth = Math.round(normalizedDepthRatio * 2000);
        setCurrentDepthSlice(mappedDepth);

        // Interpolate profile values
        if (observedProfile.length > 0) {
          const depthSpan = observedMaxDepth > 0 ? observedMaxDepth : 2000;
          const targetDepth = normalizedDepthRatio * depthSpan;
          const nearestSample = observedProfile.reduce((prev, curr) =>
            Math.abs((curr.depth ?? 0) - targetDepth) < Math.abs((prev.depth ?? 0) - targetDepth) ? curr : prev
          );

          if (nearestSample) {
            setTempAtDepth(
              typeof nearestSample.temperature === 'number'
                ? parseFloat(nearestSample.temperature.toFixed(2))
                : 28.5
            );
            setSalAtDepth(
              typeof nearestSample.salinity === 'number'
                ? parseFloat(nearestSample.salinity.toFixed(2))
                : 35.2
            );
          }
        } else {
          const mockTemp = (29.5 - normalizedDepthRatio * 26.0).toFixed(2);
          const mockSal = (35.0 + Math.sin(normalizedDepthRatio * Math.PI) * 0.8).toFixed(2);
          setTempAtDepth(parseFloat(mockTemp));
          setSalAtDepth(parseFloat(mockSal));
        }

        // Gentle auto rotation
        oceanVolume.rotation.y += 0.002;
        wireMesh.rotation.y += 0.002;
        particles.rotation.y += 0.001;
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!currentMount) return;
      const w = currentMount.clientWidth;
      const h = currentMount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [profileData]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-abyssal-800/80 bg-abyssal-950 shadow-2xl flex flex-col">
      
      {/* Top Telemetry Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Title Badge */}
        <div className="flex items-center gap-2 bg-abyssal-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-ocean-cyan/30 text-ocean-cyan shadow-glow-cyan-sm pointer-events-auto">
          <Box className="w-4 h-4 text-ocean-cyan animate-spin" style={{ animationDuration: '10s' }} />
          <span className="text-xs font-black uppercase tracking-wider text-white font-heading">
            OceanLens 3D — WebGL Depth Cross-Section
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-ocean-cyan/20 text-ocean-cyan">
            Float #{selectedFloatId || '2902150'}
          </span>
        </div>

        {/* Live Depth Telemetry Gauge */}
        <div className="flex items-center gap-2 bg-abyssal-950/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-abyssal-800 font-mono text-xs text-slate-300 shadow-xl pointer-events-auto">
          <span className="text-slate-500">Live Dive:</span>
          <span className="font-bold text-white text-sm">{currentDepthSlice}m</span>
          <span className="text-slate-600">|</span>
          <span className="text-ocean-cyan font-bold">{tempAtDepth}°C</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-bold">{salAtDepth} PSU</span>
        </div>

      </div>

      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      <div className="absolute bottom-12 right-3 z-10 max-w-xs rounded-xl border border-abyssal-800 bg-abyssal-950/95 px-2.5 py-1.5 text-[10px] text-slate-400 shadow-2xl backdrop-blur-md">
        {observedSampleCount > 0
          ? `Telemetry sampled from ${observedSampleCount} observed CTD depth levels.`
          : 'Select a float or run a depth-profile query to load observed CTD telemetry.'}
      </div>

      {/* Layer Explanatory Legend / Overlay */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-abyssal-950/95 backdrop-blur-md p-2 rounded-xl border border-abyssal-800 text-[10px] text-slate-300 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-1.5 pr-2 border-r border-abyssal-800">
          <span className="w-2.5 h-2.5 rounded-full bg-ocean-cyan shadow-sm"></span>
          <span>Epipelagic (0-200m)</span>
        </div>
        <div className="flex items-center gap-1.5 pr-2 border-r border-abyssal-800">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-sm"></span>
          <span>Mesopelagic (200-1000m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600 shadow-sm"></span>
          <span>Bathypelagic (1000-2000m)</span>
        </div>
      </div>

      {/* Bottom Right Controls */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-abyssal-900/90 hover:bg-abyssal-850 border border-abyssal-800 text-xs text-slate-300 hover:text-white transition shadow-2xl cursor-pointer active:scale-95"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isPlaying ? 'Pause Dive' : 'Resume Dive'}</span>
        </button>
      </div>

    </div>
  );
};
