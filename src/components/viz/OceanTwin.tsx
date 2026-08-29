import React from 'react';
import { OceanLens3D } from './OceanLens3D';

interface OceanTwinProps {
  selectedFloatId?: string | null;
  profileData?: Array<{ depth?: number | null; temperature?: number | null; salinity?: number | null }>;
  isMHWMode?: boolean;
  onClose?: () => void;
}

/**
 * OceanTwin — Flagship Volumetric 3D Ocean Digital Twin for Lehar AI.
 * Powered by Three.js WebGL with light extinction, 3D ARGO robot float,
 * 1,200+ bioluminescent flow particles, interactive raycast depth probing,
 * cross-section slicing plane, and 1-click Cinematic Guided Tour.
 */
export const OceanTwin: React.FC<OceanTwinProps> = (props) => {
  return <OceanLens3D {...props} />;
};

export default OceanTwin;