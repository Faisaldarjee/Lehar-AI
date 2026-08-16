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
    scene.background = new THREE.Color(0x030712);
    scene.fog = new THREE.FogExp2(0x030712, 0.035);

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
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6);
    scene.add(ambientLight);

    const topSunLight = new THREE.DirectionalLight(0x67e8f9, 1.8);
    topSunLight.position.set(10, 30, 10);
    scene.add(topSunLight);

    const bottomDeepLight = new THREE.PointLight(0x818cf8, 2.5, 50);
    bottomDeepLight.position.set(0, -15, 0);
    scene.add(bottomDeepLight);

    // Main Ocean Depth Column Mesh (Wireframe + Glass bounding cylinder)
    const oceanDepthGeo = new THREE.CylinderGeometry(8, 8, 20, 32, 12, true);
    const oceanDepthMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.15,
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
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // Surface Sunlit Layer Plane (0m - Epipelagic)
    const surfaceGeo = new THREE.CircleGeometry(8, 32);
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
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
      color: 0x6366f1,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const thermoclinePlane = new THREE.Mesh(surfaceGeo, thermoclineMat);
    thermoclinePlane.rotation.x = Math.PI / 2;
    thermoclinePlane.position.y = 5;
    scene.add(thermoclinePlane);

    // Deep Abyssal Floor Plane (2000m - Bathypelagic)
    const deepMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const deepPlane = new THREE.Mesh(surfaceGeo, deepMat);
    deepPlane.rotation.x = Math.PI / 2;
    deepPlane.position.y = -10;
    scene.add(deepPlane);

    // Floating Ocean Particles (Marine Snow / Plankton)
    const particleCount = 600;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const r = Math.random() * 7.5;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 20;

      particlePositions[i * 3] = r * Math.cos(theta);
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = r * Math.sin(theta);

      // Color based on depth
      if (y > 5) {
        particleColors[i * 3] = 0.2;
        particleColors[i * 3 + 1] = 0.8;
        particleColors[i * 3 + 2] = 0.9;
      } else if (y > -2) {
        particleColors[i * 3] = 0.3;
        particleColors[i * 3 + 1] = 0.5;
        particleColors[i * 3 + 2] = 0.9;
      } else {
        particleColors[i * 3] = 0.5;
        particleColors[i * 3 + 1] = 0.3;
        particleColors[i * 3 + 2] = 0.8;
      }
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 3D ARGO Float Object
    const floatGroup = new THREE.Group();

    // Float Hull Cylinder
    const floatHullGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 16);
    const floatHullMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Yellow ARGO standard casing
      roughness: 0.3,
      metalness: 0.6,
    });
    const floatHull = new THREE.Mesh(floatHullGeo, floatHullMat);
    floatGroup.add(floatHull);

    // Float Antenna Mast
    const antennaGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 1.35;
    floatGroup.add(antenna);

    // CTD Sensor Pod Cap
    const ctdGeo = new THREE.SphereGeometry(0.36, 16, 16);
    const ctdMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const ctdCap = new THREE.Mesh(ctdGeo, ctdMat);
    ctdCap.position.y = -0.9;
    floatGroup.add(ctdCap);

    // Sonar ring pulse around float
    const sonarGeo = new THREE.RingGeometry(0.6, 0.8, 32);
    const sonarMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const sonarRing = new THREE.Mesh(sonarGeo, sonarMat);
    sonarRing.rotation.x = Math.PI / 2;
    sonarRing.position.y = 0;
    floatGroup.add(sonarRing);

    scene.add(floatGroup);

    // Interactive mouse rotation variables
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

      scene.rotation.y += deltaX * 0.006;
      camera.position.y += deltaY * 0.05;
      camera.position.y = Math.max(-10, Math.min(25, camera.position.y));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation Loop (Simulating 10-Day Float Dive Cycle)
    let clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Slow ambient ocean column rotation
      if (isPlayingRef.current) {
        oceanVolume.rotation.y += 0.002;
        particles.rotation.y += 0.001;

        // Float diving cycle animation: oscillates from y = 9.5 (Surface) down to y = -9.0 (2000m Depth)
        const floatY = Math.sin(elapsedTime * 0.35) * 9.2;
        floatGroup.position.y = floatY;
        floatGroup.position.x = Math.cos(elapsedTime * 0.2) * 3.5;
        floatGroup.position.z = Math.sin(elapsedTime * 0.2) * 3.5;

        // Pulse sonar ring
        const scale = 1 + (Math.sin(elapsedTime * 4) + 1) * 0.5;
        sonarRing.scale.set(scale, scale, 1);

        // Surface (y ~ 9.5) = 0m. Telemetry comes from the selected float's
        // observed CTD profile whenever profile data has been loaded.
        const normalizedDepth = (9.2 - floatY) / 18.4; // 0 to 1
        const depthMeters = Math.round(normalizedDepth * (observedMaxDepth || 2000));
        setCurrentDepthSlice(depthMeters);
        const closestObservation = observedProfile.reduce<typeof observedProfile[number] | null>(
          (closest, sample) => {
            if (!closest) return sample;
            return Math.abs((sample.depth ?? 0) - depthMeters) < Math.abs((closest.depth ?? 0) - depthMeters)
              ? sample
              : closest;
          },
          null,
        );
        setTempAtDepth(closestObservation?.temperature ?? null);
        setSalAtDepth(closestObservation?.salinity ?? null);
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
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 shadow-2xl flex flex-col">
      
      {/* Top Telemetry Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Title Badge */}
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-500/30 text-cyan-400 shadow-xl pointer-events-auto">
          <Box className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            OceanLens 3D — WebGL Depth Cross-Section
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
            Float #{selectedFloatId || '2902150'}
          </span>
        </div>

        {/* Live Depth Telemetry Gauge */}
        <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 shadow-xl pointer-events-auto">
          <span className="text-slate-500">Live Dive:</span>
          <span className="font-bold text-white text-sm">{currentDepthSlice}m</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-bold">{tempAtDepth}°C</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-bold">{salAtDepth} PSU</span>
        </div>

      </div>

      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      <div className="absolute bottom-12 right-3 z-10 max-w-xs rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-[10px] text-slate-300 shadow-xl">
        {observedSampleCount > 0
          ? `Telemetry is sampled from ${observedSampleCount} observed CTD depth levels.`
          : 'Select a float or run a depth-profile query to load observed CTD telemetry.'}
      </div>

      {/* Layer Explanatory Legend / Overlay */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-[11px] text-slate-300 shadow-xl pointer-events-auto">
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span>Epipelagic (0-200m)</span>
        </div>
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
          <span>Mesopelagic (200-1000m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
          <span>Bathypelagic (1000-2000m)</span>
        </div>
      </div>

      {/* Bottom Right Controls */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition shadow-xl cursor-pointer"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isPlaying ? 'Pause Dive' : 'Resume Dive'}</span>
        </button>
      </div>

    </div>
  );
};
