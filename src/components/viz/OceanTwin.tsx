import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Play, Pause } from 'lucide-react';

interface OceanTwinProps {
  selectedFloatId?: string | null;
  profileData?: Array<{ depth?: number | null; temperature?: number | null; salinity?: number | null }>;
  mhwIntensity?: number[];
}

export const OceanTwin: React.FC<OceanTwinProps> = ({
  selectedFloatId,
  profileData = [],
  mhwIntensity,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const depthValueRef = useRef<HTMLSpanElement>(null);
  const tempValueRef = useRef<HTMLSpanElement>(null);
  const salValueRef = useRef<HTMLSpanElement>(null);

  // Slice plane state
  const slicePlaneRef = useRef({
    point: new THREE.Vector3(0, 0, 0),
    normal: new THREE.Vector3(0, 1, 0),
  });

  return (
    <>
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        camera={{ position: [0, 1.6, 3] }}
      >
        {/* Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 30, 10]} intensity={1.8} />
        <pointLight position={[0, -15, 0]} intensity={2.5} distance={50} decay={2} />

        {/* Ocean volume (cylinder) */}
        <OceanVolume
          profileData={profileData}
          mhwIntensity={mhwIntensity}
          slicePlane={slicePlaneRef.current}
        />

        {/* Slice plane helper */}
        <SlicePlaneHelper slicePlane={slicePlaneRef.current} />
      </Canvas>

      {/* UI overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-abyssal-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-ocean-cyan/30 text-ocean-cyan shadow-glow-cyan-sm pointer-events-auto">
          <Box className="w-4 h-4 text-ocean-cyan animate-spin" style={{ animationDuration: '10s' }} />
          <span className="text-xs font-black uppercase tracking-wider text-white font-heading">
            Ocean Twin — Volumetric Digital Twin
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-ocean-cyan/20 text-ocean-cyan">
            Float #{selectedFloatId || '2902150'}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-abyssal-950/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-abyssal-800 font-mono text-xs text-slate-300 shadow-xl pointer-events-auto">
          <span className="text-slate-500">Live Dive:</span>
          <span ref={depthValueRef} className="font-bold text-white text-sm">0m</span>
          <span className="text-slate-600">|</span>
          <span ref={tempValueRef} className="text-ocean-cyan font-bold">28.4°C</span>
          <span className="text-slate-600">|</span>
          <span ref={salValueRef} className="text-emerald-400 font-bold">35.2 PSU</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-abyssal-900/90 hover:bg-abyssal-850 border border-abyssal-800 text-xs text-slate-300 hover:text-white transition shadow-2xl cursor-pointer active:scale-95"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isPlaying ? 'Pause Dive' : 'Resume Dive'}</span>
        </button>
      </div>
    </>
  );
};

function OceanVolume({
  profileData,
  mhwIntensity,
  slicePlane,
}: {
  profileData: Array<{ depth?: number | null; temperature?: number | null; salinity?: number | null }>;
  mhwIntensity?: number[];
  slicePlane: { point: THREE.Vector3; normal: THREE.Vector3 };
}) {
  const volumeRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);

  const geometry = React.useMemo(() => {
    const radius = 8;
    const height = 20;
    const radialSegments = 32;
    const heightSegments = 64;
    const cyl = new THREE.CylinderGeometry(radius, radius, height, radialSegments, heightSegments, true);

    const depthArray = new Float32Array(cyl.attributes.position.count);
    const pos = cyl.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      depthArray[i] = pos.getY(i);
    }
    cyl.setAttribute('depth', new THREE.BufferAttribute(depthArray, 1));

    if (mhwIntensity && mhwIntensity.length === pos.count) {
      cyl.setAttribute('mhw', new THREE.BufferAttribute(new Float32Array(mhwIntensity), 1));
    }

    return cyl;
  }, [profileData, mhwIntensity]);

  const material = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying float vDepth;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vDepth = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying float vDepth;
        uniform vec3 uSlicePoint;
        uniform vec3 uSliceNormal;
        void main() {
          if (vDepth < uSlicePoint.y) discard;
          float t = (vDepth + 10.0) / 20.0;
          vec3 tempColor = mix(vec3(0.0, 0.4, 0.8), vec3(0.8, 0.4, 0.0), t);
          float ndotl = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.5))), 0.0);
          vec3 color = tempColor * (0.5 + 0.5 * ndotl);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uSlicePoint: { value: new THREE.Vector3() },
        uSliceNormal: { value: new THREE.Vector3() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  React.useEffect(() => {
    if (volumeRef.current) {
      volumeRef.current.material.uniforms.uSlicePoint.value.copy(slicePlane.point);
      volumeRef.current.material.uniforms.uSliceNormal.value.copy(slicePlane.normal);
      volumeRef.current.material.needsUpdate = true;
    }
  }, [slicePlane.point, slicePlane.normal]);

  return <mesh ref={volumeRef} geometry={geometry} material={material} />;
}

function SlicePlaneHelper({ slicePlane }: { slicePlane: { point: THREE.Vector3; normal: THREE.Vector3 } }) {
  const planeRef = useRef<THREE.Mesh>(null);

  React.useEffect(() => {
    if (planeRef.current) {
      const size = 16;
      const geo = new THREE.PlaneGeometry(size, size);
      const look = new THREE.Vector3(0, 0, 1);
      const quat = new THREE.Quaternion().setFromUnitVectors(look, slicePlane.normal.clone().normalize());
      planeRef.current.geometry.dispose();
      planeRef.current.geometry = geo;
      planeRef.current.setRotationFromQuaternion(quat);
      planeRef.current.position.copy(slicePlane.point);
    }
  }, [slicePlane.point, slicePlane.normal]);

  return (
    <mesh ref={planeRef} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="orange" opacity={0.2} transparent />
    </mesh>
  );
}