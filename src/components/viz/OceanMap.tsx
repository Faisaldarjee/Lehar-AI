import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { 
  Fish, 
  ChevronDown, 
  Compass, 
  Satellite, 
  Leaf, 
  Navigation,
  Radio,
  Layers,
  Info,
  ChevronUp,
  Sparkles,
  Anchor,
  X 
} from 'lucide-react';
import type { FloatSummary, MapMarker, PFZAdvisory, SatelliteGridPoint } from '../../types';
import { getPFZAdvisories, getSatelliteGrid } from '../../services/api';
import { INDIAN_PORTS_DATABASE, type IndianPort } from '../../data/indianPorts';

// Dynamic Multi-Tier Port Marker Icon Generator based on Zoom & Tier
const createPortIcon = (tier: 1 | 2 | 3) => {
  if (tier === 1) {
    return L.divIcon({
      className: 'custom-harbour-tier1',
      html: `<div style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        width: 22px; 
        height: 22px; 
        border-radius: 50%; 
        background: rgba(10, 25, 47, 0.95); 
        border: 2px solid #38bdf8; 
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
        font-size: 11px;
        cursor: pointer;
      ">⚓</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    });
  }
  if (tier === 2) {
    return L.divIcon({
      className: 'custom-harbour-tier2',
      html: `<div style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        width: 17px; 
        height: 17px; 
        border-radius: 50%; 
        background: rgba(13, 31, 45, 0.92); 
        border: 1.5px solid #2dd4bf; 
        box-shadow: 0 0 8px rgba(45, 212, 191, 0.5);
        font-size: 9px;
        cursor: pointer;
      ">⚓</div>`,
      iconSize: [17, 17],
      iconAnchor: [8.5, 8.5],
      popupAnchor: [0, -9],
    });
  }
  return L.divIcon({
    className: 'custom-harbour-tier3',
    html: `<div style="
      display: flex; 
      align-items: center; 
      justify-content: center; 
      width: 13px; 
      height: 13px; 
      border-radius: 50%; 
      background: rgba(15, 23, 42, 0.9); 
      border: 1px solid #7dd3fc; 
      box-shadow: 0 0 5px rgba(125, 211, 252, 0.4);
      font-size: 7px;
      cursor: pointer;
    ">⚓</div>`,
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5],
    popupAnchor: [0, -7],
  });
};

// Custom Map Auto-Focuser & Dynamic Bounds Fitter Component
function MapBoundsController({
  highlightMarkers,
}: {
  highlightMarkers?: MapMarker[] | null;
}) {
  const map = useMap();
  const prevMarkersRef = useRef<MapMarker[] | null>(null);

  useEffect(() => {
    if (!highlightMarkers || highlightMarkers === prevMarkersRef.current) return;
    prevMarkersRef.current = highlightMarkers;

    if (highlightMarkers.length > 1) {
      const validPoints = highlightMarkers.filter(
        (m) => !isNaN(m.lat) && !isNaN(m.lon) && m.lat >= -10 && m.lat <= 28 && m.lon >= 55 && m.lon <= 98
      );
      if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints.map((m) => [m.lat, m.lon]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6, animate: true, duration: 1.0 });
        return;
      }
    }

    if (highlightMarkers.length === 1) {
      const p = highlightMarkers[0];
      if (!isNaN(p.lat) && !isNaN(p.lon)) {
        map.flyTo([p.lat, p.lon], 6.5, { duration: 1.0 });
        return;
      }
    }
  }, [highlightMarkers, map]);

  return null;
}

function MapSectorPanner({ target }: { target: { center: [number, number]; zoom: number } | null }) {
  const map = useMap();
  const prevTargetRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  useEffect(() => {
    if (!target || target === prevTargetRef.current) return;
    prevTargetRef.current = target;
    map.flyTo(target.center, target.zoom, { duration: 1.0 });
  }, [target, map]);

  return null;
}

// Helper to watch and update current zoom level for Level-of-Detail (LOD) decimation
function MapZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoomChange(map.getZoom());
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  return null;
}

interface OceanMapProps {
  floats: FloatSummary[];
  highlightMarkers?: MapMarker[] | null;
  onSelectFloat?: (floatId: string) => void;
  selectedFloatId?: string | null;
  trajectory?: FloatSummary[] | null;
}

// Function to create styled SVG pulsating markers for ARGO floats
function createFloatIcon(isHighlighted: boolean, isSelected: boolean) {
  // If selected: Ultra-bright Electric Cyan (#00f0ff) with glowing white core and double ring
  // If highlighted: Vibrant Coral (#f43f5e)
  // Default: Electric Ocean Cyan (#06b6d4)
  const color = isSelected ? '#00f0ff' : isHighlighted ? '#f43f5e' : '#06b6d4';
  const size = isSelected ? 24 : isHighlighted ? 18 : 12;
  const pulseColor = isSelected ? 'rgba(0, 240, 255, 0.9)' : isHighlighted ? 'rgba(244, 63, 94, 0.8)' : 'rgba(6, 182, 212, 0.7)';
  const borderRing = isSelected ? '3px solid #ffffff' : '2px solid #ffffff';
  const glow = isSelected ? '0 0 16px #00f0ff, 0 0 8px #ffffff' : isHighlighted ? '0 0 12px #f43f5e' : '0 0 10px #06b6d4';

  const svgHtml = `
    <div style="position: relative; width: ${size}px; height: ${size}px; cursor: pointer;">
      <span style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${pulseColor};
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></span>
      <span style="
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${color};
        border: ${borderRing};
        box-shadow: ${glow};
      "></span>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-float-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Function to create a distinct GPS Boat / Vessel icon with glowing radar pulse
function createVesselIcon() {
  const svgHtml = `
    <div style="position: relative; width: 34px; height: 34px;">
      <span style="
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.35);
        border: 1.5px solid rgba(16, 185, 129, 0.75);
        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></span>
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #064e3b;
        border: 2px solid #34d399;
        box-shadow: 0 0 16px #10b981;
        color: #ffffff;
        font-size: 16px;
      ">
        ⛵
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-vessel-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// Thermal palette for Satellite SST (Blue 26°C -> Cyan 27.5°C -> Yellow 28.5°C -> Red 30°C)
function getSSTColor(sst: number): string {
  if (sst >= 29.5) return '#ef4444'; // Hot red
  if (sst >= 28.5) return '#f97316'; // Warm orange
  if (sst >= 27.5) return '#06b6d4'; // Cyan
  if (sst >= 26.5) return '#0d9488'; // Teal
  return '#3b82f6';                  // Blue
}

// Bio-productivity palette for Chlorophyll-a (mg/m³)
function getChlColor(chl: number): string {
  if (chl >= 1.5) return '#059669'; // High emerald
  if (chl >= 0.8) return '#10b981'; // Green
  if (chl >= 0.4) return '#34d399'; // Mint green
  return '#14b8a6';                 // Cyan
}

function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TARGET_SPECIES_OPTIONS = [
  { id: 'all', label: 'All Marine Species', minSST: 0, maxSST: 40 },
  { id: 'surmai', label: '🐟 Surmai (King Mackerel)', minSST: 26.0, maxSST: 28.5 },
  { id: 'bangda', label: '🐟 Bangda (Indian Mackerel)', minSST: 25.0, maxSST: 29.0 },
  { id: 'rawas', label: '🐟 Rawas (Indian Salmon)', minSST: 24.5, maxSST: 28.0 },
  { id: 'paplet', label: '🐟 Paplet (Pomfret)', minSST: 25.5, maxSST: 28.5 },
  { id: 'tuna', label: '🐟 Tuna (Yellowfin)', minSST: 24.0, maxSST: 29.5 },
  { id: 'tarli', label: '🐟 Tarli / Sardine', minSST: 26.0, maxSST: 29.0 },
  { id: 'hilsa', label: '🐟 Hilsa (Ilish)', minSST: 25.0, maxSST: 30.0 },
];

// Global persistent cache to prevent re-fetching and map flicker across tab switches
let globalPfzCache: PFZAdvisory[] | null = null;
let globalSatGridCache: SatelliteGridPoint[] | null = null;

export const OceanMap: React.FC<OceanMapProps> = ({
  floats,
  highlightMarkers,
  onSelectFloat,
  selectedFloatId,
  trajectory,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.0, 75.0]); // Indian Ocean
  const [mapZoom, setMapZoom] = useState<number>(5);
  const [currentZoom, setCurrentZoom] = useState<number>(5);

  // Dynamic Level-of-Detail (LOD) Filtering for 150+ Indian Coastal Fishing Harbours
  const visiblePorts = useMemo(() => {
    if (currentZoom <= 5) {
      // High-Level National Overview: Show only Tier-1 Major Strategic Ports
      return INDIAN_PORTS_DATABASE.filter((p) => p.tier === 1);
    }
    if (currentZoom <= 7) {
      // Regional Sector View: Show Tier-1 & Tier-2 Commercial Mechanized Harbours
      return INDIAN_PORTS_DATABASE.filter((p) => p.tier <= 2);
    }
    // Inshore Coastal / In-depth Zoom: Show All 150+ Harbours, Jetties & Koli Fish Landing Centres
    return INDIAN_PORTS_DATABASE;
  }, [currentZoom]);
  
  // Layer Toggle States
  const [showPFZ, setShowPFZ] = useState<boolean>(true);
  const [showFloats, setShowFloats] = useState<boolean>(true);
  const [showHarbours, setShowHarbours] = useState<boolean>(true);
  const [showSatelliteSST, setShowSatelliteSST] = useState<boolean>(false);
  const [showChlorophyll, setShowChlorophyll] = useState<boolean>(false);
  
  // Target Species Filter State
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all');
  const [speciesMenuOpen, setSpeciesMenuOpen] = useState<boolean>(false);

  // Live Vessel GPS / NavIC Tracker State & Active Route Target
  const [userVesselPos, setUserVesselPos] = useState<[number, number] | null>(null);
  const [dockedPortName, setDockedPortName] = useState<string | null>(null);
  const [activeRoutePfz, setActiveRoutePfz] = useState<PFZAdvisory | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [targetSector, setTargetSector] = useState<{ center: [number, number]; zoom: number } | null>(null);

  // UI Dropdowns & Collapsible Legend
  const [sectorMenuOpen, setSectorMenuOpen] = useState<boolean>(false);
  const [satLayersMenuOpen, setSatLayersMenuOpen] = useState<boolean>(false);
  const [legendOpen, setLegendOpen] = useState<boolean>(false);

  const [pfzZones, setPfzZones] = useState<PFZAdvisory[]>(() => globalPfzCache || []);
  const [satelliteGrid, setSatelliteGrid] = useState<SatelliteGridPoint[]>(() => globalSatGridCache || []);

  // Load PFZ advisories & Satellite grid on mount (Zero flicker if already cached)
  useEffect(() => {
    async function loadData() {
      try {
        const [pfzRes, satRes] = await Promise.all([
          globalPfzCache ? { advisories: globalPfzCache } : getPFZAdvisories('all', 50).catch(() => ({ advisories: [] })),
          globalSatGridCache ? { points: globalSatGridCache } : getSatelliteGrid(2).catch(() => ({ points: [] })),
        ]);
        if (pfzRes && pfzRes.advisories && !globalPfzCache) {
          globalPfzCache = pfzRes.advisories;
          setPfzZones(pfzRes.advisories);
        }
        if (satRes && satRes.points && !globalSatGridCache) {
          globalSatGridCache = satRes.points;
          setSatelliteGrid(satRes.points);
        }
      } catch (err) {
        console.warn('Map data fetch warning:', err);
      }
    }
    loadData();
  }, []);

  // Handle focus on specific ocean sectors
  const handleFocusSector = (sector: 'arabian' | 'bengal' | 'equatorial' | 'south' | 'all') => {
    switch (sector) {
      case 'arabian':
        setTargetSector({ center: [16.0, 68.0], zoom: 6 });
        break;
      case 'bengal':
        setTargetSector({ center: [15.0, 88.0], zoom: 6 });
        break;
      case 'equatorial':
        setTargetSector({ center: [0.0, 78.0], zoom: 5 });
        break;
      case 'south':
        setTargetSector({ center: [-15.0, 80.0], zoom: 5 });
        break;
      case 'all':
      default:
        setTargetSector({ center: [14.0, 75.0], zoom: 5 });
        break;
    }
    setSectorMenuOpen(false);
  };

  // Live GPS / NavIC Vessel Tracker Handler (Zero-Internet Edge Ready)
  const handleLocateVessel = () => {
    if (userVesselPos) {
      setUserVesselPos(null);
      setDockedPortName(null);
      setActiveRoutePfz(null);
      return;
    }
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          let lat = pos.coords.latitude;
          let lon = pos.coords.longitude;
          // In indoor / desktop demo environments, simulate coastal trawler 15nm offshore Mumbai
          if (lat < -10 || lat > 30 || lon < 50 || lon > 100) {
            lat = 18.72;
            lon = 72.45;
          }
          setUserVesselPos([lat, lon]);
          setDockedPortName(null);
          setIsLocating(false);
        },
        () => {
          // Fallback: Deep-Sea Fishing Trawler (Offshore Mumbai / Ratnagiri)
          setUserVesselPos([18.72, 72.45]);
          setDockedPortName('Sassoon Dock (Mumbai)');
          setIsLocating(false);
        },
        { timeout: 4000, enableHighAccuracy: true }
      );
    } else {
      setUserVesselPos([18.72, 72.45]);
      setDockedPortName('Sassoon Dock (Mumbai)');
      setIsLocating(false);
    }
  };

  const activeSpecies = TARGET_SPECIES_OPTIONS.find((s) => s.id === selectedSpecies);
  const displayedPfzZones = pfzZones.filter((zone) => {
    if (selectedSpecies === 'all' || !activeSpecies) return true;
    const sst = zone.sst_celsius ?? 28.0;
    return sst >= activeSpecies.minSST && sst <= activeSpecies.maxSST;
  });

  const polylinePositions: [number, number][] =
    trajectory?.map((t) => [t.latitude, t.longitude] as [number, number]) || [];

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-abyssal-800/80 bg-abyssal-950 shadow-2xl flex flex-col">
      
      {/* Map Floating Control Header (Elevated to z-[1000] above Leaflet tiles) */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left: Sector Selector, Target Species & Vessel GPS Button */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto ml-11 sm:ml-12">
          
          {/* Sector Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSectorMenuOpen(!sectorMenuOpen);
                setSpeciesMenuOpen(false);
                setSatLayersMenuOpen(false);
              }}
              className="flex items-center space-x-2 bg-abyssal-950/98 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/30 text-xs font-bold text-slate-200 hover:text-white shadow-xl transition cursor-pointer active:scale-95"
            >
              <Compass className="w-3.5 h-3.5 text-ocean-cyan" />
              <span>Jump to sector</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${sectorMenuOpen ? 'rotate-180 text-ocean-cyan' : ''}`} />
            </button>

            {/* Sector Menu Popover */}
            {sectorMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-52 bg-[#071322] border border-cyan-500/30 rounded-xl shadow-2xl p-1.5 z-[1100] space-y-1 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-cyan-500/20">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  Indian Ocean Sectors
                </div>
                {[
                  { id: 'all', label: 'Entire Indian Ocean', coord: '14°N, 75°E' },
                  { id: 'arabian', label: 'Arabian Sea (West Coast)', coord: '16°N, 68°E' },
                  { id: 'bengal', label: 'Bay of Bengal (East Coast)', coord: '15°N, 88°E' },
                  { id: 'equatorial', label: 'Equatorial Indian Ocean', coord: '0°N, 78°E' },
                  { id: 'south', label: 'South Indian Ocean', coord: '15°S, 80°E' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleFocusSector(item.id as any)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-white hover:bg-[#0c1e34] transition cursor-pointer"
                  >
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-[10px] font-mono text-cyan-400">{item.coord}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target Species Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSpeciesMenuOpen(!speciesMenuOpen);
                setSectorMenuOpen(false);
                setSatLayersMenuOpen(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xl cursor-pointer active:scale-95 ${
                selectedSpecies !== 'all'
                  ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-glow-amber-sm'
                  : 'bg-abyssal-950/98 backdrop-blur-md border-cyan-500/30 text-slate-200 hover:text-white'
              }`}
            >
              <Fish className="w-3.5 h-3.5 text-amber-400" />
              <span>{selectedSpecies === 'all' ? 'Target Species' : activeSpecies?.label.split('(')[0].trim()}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${speciesMenuOpen ? 'rotate-180 text-amber-400' : ''}`} />
            </button>

            {speciesMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-60 bg-[#071322] border border-cyan-500/30 rounded-xl shadow-2xl p-1.5 z-[1100] space-y-1 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-cyan-500/20">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  Filter PFZ by Marine Species
                </div>
                {TARGET_SPECIES_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedSpecies(opt.id);
                      setSpeciesMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition font-medium flex items-center justify-between cursor-pointer ${
                      selectedSpecies === opt.id
                        ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40 font-bold'
                        : 'text-slate-300 hover:bg-[#0c1e34] hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.id !== 'all' && (
                      <span className="text-[10px] text-cyan-300 font-mono">
                        {opt.minSST}–{opt.maxSST}°C
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Clean Grouped Layer Toggles */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          
          {/* 1. ARGO Floats Toggle */}
          <button
            type="button"
            onClick={() => setShowFloats(!showFloats)}
            title="Toggle 97 Active ARGO Subsurface Floats"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl transition cursor-pointer active:scale-95 ${
              showFloats
                ? 'bg-cyan-950/85 border-cyan-500/50 text-cyan-300 shadow-cyan-950/40'
                : 'bg-abyssal-950/90 border-abyssal-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showFloats ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`}></span>
            <span>Floats ({floats.length})</span>
          </button>

          {/* 2. PFZ Fishing Advisories Toggle (Amber/Gold High Yield) */}
          <button
            type="button"
            onClick={() => setShowPFZ(!showPFZ)}
            title="Toggle Multi-Sensor Potential Fishing Zones"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl transition cursor-pointer active:scale-95 ${
              showPFZ
                ? 'bg-amber-950/85 border-amber-500/60 text-amber-300 shadow-amber-950/40'
                : 'bg-abyssal-950/90 border-abyssal-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fish className={`w-3.5 h-3.5 ${showPFZ ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>PFZ Zones ({displayedPfzZones.length})</span>
          </button>

          {/* 3. Major Fishing Harbours / Ports Toggle */}
          <button
            type="button"
            onClick={() => setShowHarbours(!showHarbours)}
            title="Toggle 150+ Indian Coastal Fishing Harbours & Jetties"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl transition cursor-pointer active:scale-95 ${
              showHarbours
                ? 'bg-sky-950/85 border-sky-500/60 text-sky-300 shadow-sky-950/40'
                : 'bg-abyssal-950/90 border-abyssal-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Anchor className={`w-3.5 h-3.5 ${showHarbours ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>Ports ({INDIAN_PORTS_DATABASE.length}+)</span>
          </button>

          {/* 4. Grouped Satellite Layers Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSatLayersMenuOpen(!satLayersMenuOpen);
                setSectorMenuOpen(false);
              }}
              title="Toggle continuous NOAA & NASA satellite layers"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl transition cursor-pointer active:scale-95 ${
                showSatelliteSST || showChlorophyll
                  ? 'bg-ocean-cyan/15 border-ocean-cyan/50 text-ocean-cyan shadow-glow-cyan-sm'
                  : 'bg-abyssal-950/90 border-abyssal-800 text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-ocean-cyan" />
              <span>Satellite Layers</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${satLayersMenuOpen ? 'rotate-180 text-ocean-cyan' : ''}`} />
            </button>

            {/* Satellite Layers Popover */}
            {satLayersMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-abyssal-950 border border-abyssal-800 rounded-xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center justify-between">
                  <span>Continuous Satellite Coverage</span>
                  <Satellite className="w-3 h-3 text-ocean-cyan" />
                </div>

                {/* Sub-Toggle 1: NOAA MUR SST */}
                <button
                  type="button"
                  onClick={() => setShowSatelliteSST(!showSatelliteSST)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer ${
                    showSatelliteSST
                      ? 'bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold'
                      : 'hover:bg-abyssal-850 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-left">
                    <Satellite className="w-3.5 h-3.5 text-rose-400" />
                    <div>
                      <div className="text-xs">NOAA MUR SST</div>
                      <div className="text-[9px] text-slate-400">1km Thermal Grid</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${showSatelliteSST ? 'bg-rose-900/80 text-rose-200' : 'bg-abyssal-800 text-slate-500'}`}>
                    {showSatelliteSST ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Sub-Toggle 2: NASA VIIRS Chlorophyll */}
                <button
                  type="button"
                  onClick={() => setShowChlorophyll(!showChlorophyll)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer ${
                    showChlorophyll
                      ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold'
                      : 'hover:bg-abyssal-850 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-left">
                    <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="text-xs">NASA Chlorophyll-a</div>
                      <div className="text-[9px] text-slate-400">Phytoplankton Density</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${showChlorophyll ? 'bg-emerald-900/80 text-emerald-200' : 'bg-abyssal-800 text-slate-500'}`}>
                    {showChlorophyll ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Live GPS Vessel Tracker Button */}
          <button
            type="button"
            onClick={handleLocateVessel}
            disabled={isLocating}
            title="Acquire live GPS / NavIC hardware coordinates or simulate deep-sea fishing trawler"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl transition cursor-pointer active:scale-95 ${
              userVesselPos
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-glow-emerald-sm ring-1 ring-emerald-500/40 font-bold'
                : 'bg-abyssal-950/90 border-abyssal-800 text-slate-300 hover:text-white'
            }`}
          >
            {isLocating ? (
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            ) : (
              <Navigation className={`w-3.5 h-3.5 ${userVesselPos ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            )}
            <span>{userVesselPos ? 'GPS Active ⛵' : '📍 Vessel GPS'}</span>
          </button>

        </div>

      </div>

      {/* Live Vessel GPS Telemetry HUD (Clean Bottom-Left HUD) */}
      {userVesselPos && (
        <div className="absolute bottom-6 left-6 z-[1000] max-w-xs sm:max-w-sm rounded-2xl border border-emerald-500/40 bg-[#071322]/98 p-3 font-mono text-xs text-slate-200 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 ring-1 ring-emerald-500/20">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Vessel NavIC GPS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                100% Offline Edge
              </span>
              <button
                type="button"
                onClick={() => {
                  setUserVesselPos(null);
                  setDockedPortName(null);
                  setActiveRoutePfz(null);
                }}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer rounded"
                title="Dismiss vessel tracker"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Position:</span>
              <strong className="text-white">{userVesselPos[0].toFixed(3)}°N, {userVesselPos[1].toFixed(3)}°E</strong>
            </div>

            {dockedPortName && (
              <div className="text-[10px] text-sky-300 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-500/30">
                ⚓ Docked at: <strong>{dockedPortName}</strong>
              </div>
            )}

            {activeRoutePfz ? (() => {
              const dist = haversineDistKm(userVesselPos[0], userVesselPos[1], activeRoutePfz.latitude, activeRoutePfz.longitude);
              return (
                <div className="pt-1.5 border-t border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>📍 Active Course Lock:</span>
                    <span>{dist.toFixed(1)} km (~{(dist / 16.5).toFixed(1)}h)</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span>Fuel: ~{Math.round(dist * 1.85)} L</span>
                    <span className="text-cyan-300">{activeRoutePfz.sst_celsius}°C (Score {activeRoutePfz.pfz_score}/100)</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-emerald-300 font-sans">
                      Target: {activeRoutePfz.target_species[0] || 'Tuna'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveRoutePfz(null)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 cursor-pointer font-bold transition"
                    >
                      Clear Route
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800">
                Click any PFZ dot on map and press &quot;Plot Route&quot; to calculate voyage course.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Species Filter Banner */}
      {selectedSpecies !== 'all' && activeSpecies && (
        <div className="absolute top-14 left-14 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-300 text-xs font-mono shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1">
          <Fish className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Target Filter: <strong>{activeSpecies.label}</strong> ({activeSpecies.minSST}–{activeSpecies.maxSST}°C) • {displayedPfzZones.length} Matching PFZs
          </span>
          <button 
            type="button" 
            onClick={() => setSelectedSpecies('all')}
            className="ml-1 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition hover:bg-amber-800/40"
            title="Clear species filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* React Leaflet Map Container */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="flex-1 w-full h-full"
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
        attributionControl={false}
      >
        <MapBoundsController highlightMarkers={highlightMarkers} />
        <MapSectorPanner target={targetSector} />
        <MapZoomWatcher onZoomChange={setCurrentZoom} />

        {/* CartoDB Dark Matter Basemap */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* SATELLITE SST HEATMAP OVERLAY LAYER */}
        {showSatelliteSST &&
          satelliteGrid.map((pt, idx) => {
            const color = getSSTColor(pt.sst);
            return (
              <CircleMarker
                key={`sat-sst-${idx}`}
                center={[pt.lat, pt.lon]}
                radius={7}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.40,
                  weight: 0.5,
                }}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-slate-100 min-w-[180px] font-mono text-xs">
                    <div className="font-bold text-amber-400 flex items-center gap-1">
                      <Satellite className="w-3.5 h-3.5" /> NOAA Satellite SST
                    </div>
                    <div>SST: <strong className="text-white">{pt.sst}°C</strong></div>
                    <div>Coord: {pt.lat.toFixed(2)}°N, {pt.lon.toFixed(2)}°E</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* SATELLITE CHLOROPHYLL-A BIO-PRODUCTIVITY OVERLAY LAYER */}
        {showChlorophyll &&
          satelliteGrid.map((pt, idx) => {
            const chl = pt.chlorophyll;
            const color = getChlColor(chl);
            return (
              <CircleMarker
                key={`sat-chl-${idx}`}
                center={[pt.lat, pt.lon]}
                radius={8}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.45,
                  weight: 0.5,
                }}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-slate-100 min-w-[190px] font-mono text-xs">
                    <div className="font-bold text-emerald-400 flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5" /> NASA Chlorophyll-a
                    </div>
                    <div>Density: <strong className="text-white">{chl} mg/m³</strong></div>
                    <div>Coord: {pt.lat.toFixed(2)}°N, {pt.lon.toFixed(2)}°E</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* PFZ FISHING OPPORTUNITY ZONES (ZOOM-ADAPTIVE GLOWING TARGET MARKERS) */}
        {showPFZ &&
          displayedPfzZones.map((pfz, idx) => {
            const isHighYield = pfz.pfz_score >= 80;
            // Adaptive Level of Detail: Smaller clean dots at country overview, rich glowing circles when zoomed in
            const dynamicRadius =
              currentZoom <= 5
                ? (isHighYield ? 6.5 : 4.5)
                : currentZoom <= 7
                ? (isHighYield ? 9 : 7)
                : (isHighYield ? 12 : 9);

            return (
              <CircleMarker
                key={`pfz-zone-${idx}`}
                center={[pfz.latitude, pfz.longitude]}
                radius={dynamicRadius}
                pathOptions={{
                  color: '#fbbf24', // Warm Golden Amber
                  fillColor: isHighYield ? '#f59e0b' : '#d97706',
                  fillOpacity: currentZoom <= 5 ? 0.8 : 0.88,
                  weight: isHighYield ? (currentZoom <= 5 ? 1.5 : 2.5) : 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -dynamicRadius]}>
                  <span className="font-sans text-[10px] font-bold text-amber-300 bg-abyssal-950 px-1.5 py-0.5 rounded border border-amber-500/40 shadow-lg">
                    {pfz.pfz_rating} ({pfz.pfz_score}/100) • {pfz.sst_celsius}°C
                  </span>
                </Tooltip>
                <Popup>
                  <div className="p-1 min-w-[280px] max-w-[310px] text-slate-100 space-y-2 font-sans">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Fish className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-amber-400 text-sm font-heading tracking-wide">
                          PFZ: {pfz.pfz_rating} ({pfz.pfz_score}/100)
                        </span>
                        <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                      </div>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/50 text-amber-300 shadow-sm">
                        {pfz.sst_celsius}°C
                      </span>
                    </div>

                    {/* Target Pelagic Species Banner */}
                    <div className="p-2.5 rounded-xl bg-[#091e34]/90 border border-cyan-500/30 space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-mono tracking-wider">
                        <span className="text-slate-400 uppercase font-semibold">TARGET PELAGIC SPECIES</span>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold text-[9px] flex items-center gap-0.5">
                          🛡️ HIGH DENSITY
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-heading">
                        {(pfz.target_species && pfz.target_species.length > 0)
                          ? pfz.target_species.slice(0, 2).join(' / ')
                          : (pfz as any).species_likely?.length > 0
                          ? (pfz as any).species_likely.slice(0, 2).join(' / ')
                          : 'Tuna / Yellowfin'}
                      </div>
                      <div className="flex items-center justify-between text-xs text-cyan-300 font-mono pt-0.5">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Thermocline Layer:</span>
                        </span>
                        <strong className="text-white">
                          {pfz.mld_meters ? `${Math.round(pfz.mld_meters)}m - ${Math.round(pfz.mld_meters + 25)}m Depth` : '35m - 60m Depth'}
                        </strong>
                      </div>
                    </div>

                    {/* 3 Data Tiles Grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1.5 rounded-lg bg-[#0a1b2d] border border-cyan-500/20 space-y-0.5">
                        <div className="text-[9px] font-mono text-slate-400 flex items-center justify-center gap-0.5">
                          Argo SST <Info className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                        <div className="text-xs font-bold text-white font-mono">{pfz.sst_celsius}°C</div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-[#0a1b2d] border border-cyan-500/20 space-y-0.5">
                        <div className="text-[9px] font-mono text-slate-400 flex items-center justify-center gap-0.5">
                          Sat SST <Info className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                        <div className="text-xs font-bold text-white font-mono">
                          {pfz.satellite_sst ? `${pfz.satellite_sst}°C` : `${pfz.sst_celsius}°C`}
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-[#0a1b2d] border border-cyan-500/20 space-y-0.5">
                        <div className="text-[9px] font-mono text-slate-400 flex items-center justify-center gap-0.5">
                          Chlorophyll <Info className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                        <div className="text-xs font-bold text-cyan-300 font-mono">
                          {pfz.chlorophyll_mg_m3 ? `${pfz.chlorophyll_mg_m3} mg/m³` : '0.69 mg/m³'}
                        </div>
                      </div>
                    </div>

                    {/* Navigation Telemetry Section */}
                    {(() => {
                      const distKm = userVesselPos
                        ? haversineDistKm(userVesselPos[0], userVesselPos[1], pfz.latitude, pfz.longitude)
                        : (pfz.nearest_harbour?.distance_km || 48.5);
                      const voyageHours = (distKm / 16.5).toFixed(1);
                      const fuelLitres = Math.round(distKm * 1.85);

                      return (
                        <div className="p-2 rounded-xl bg-[#091b2c]/80 border border-slate-800 space-y-1 text-[11px] font-mono">
                          <div className="flex items-center justify-between text-cyan-300">
                            <span className="flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-cyan-400" />
                              {userVesselPos ? 'Direct from Your Vessel' : `From ${pfz.nearest_harbour?.harbour || 'Coast'}`}
                            </span>
                            <strong className="text-white text-xs">{distKm.toFixed(1)} km</strong>
                          </div>

                          <div className="flex items-center justify-between text-slate-300">
                            <span>⏱️ Voyage: ~{voyageHours} hrs</span>
                            <span>⛽ Fuel: ~{fuelLitres} L</span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                            <span className="text-teal-300">🌊 Sea State: Moderate</span>
                            <span className="text-slate-500">Valid: 36h</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Plot Route CTA Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!userVesselPos) {
                          setUserVesselPos([18.915, 72.828]);
                          setDockedPortName(pfz.nearest_harbour?.harbour || 'Sassoon Dock (Mumbai)');
                        }
                        setActiveRoutePfz(pfz);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-abyssal-950 font-bold text-xs shadow-lg shadow-orange-500/25 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Navigation className="w-3.5 h-3.5 text-abyssal-950" />
                      <span>{activeRoutePfz?.float_id === pfz.float_id ? '✓ Route Active (Locked)' : 'Plot Route from Vessel'}</span>
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* Trajectory Polyline if selected */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#2dd4bf',
              weight: 3,
              opacity: 0.85,
              dashArray: '4, 8',
            }}
          />
        )}

        {/* 150+ INDIAN FISHING HARBOURS & JETTIES LAYER (DYNAMIC ZOOM-ADAPTIVE LOD) */}
        {showHarbours &&
          visiblePorts.map((h) => (
            <Marker
              key={`harbour-${h.id}`}
              position={[h.lat, h.lng]}
              icon={createPortIcon(h.tier)}
            >
              <Tooltip direction="top" offset={[0, h.tier === 1 ? -12 : h.tier === 2 ? -10 : -8]}>
                <div className="text-[11px] font-sans font-semibold text-sky-200 bg-abyssal-950 px-2 py-0.5 rounded border border-sky-500/50 shadow-xl flex items-center gap-1">
                  <span>⚓</span>
                  <span>{h.name}</span>
                  <span className="text-[9px] text-sky-400/80">({h.state})</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="p-1 min-w-[260px] max-w-[300px] text-slate-100 space-y-2 font-sans">
                  <div className="flex items-center justify-between border-b border-sky-500/20 pb-1.5">
                    <span className="font-bold text-sky-400 text-sm flex items-center gap-1.5 font-heading">
                      ⚓ {h.name}
                    </span>
                    <span className="text-[9px] font-mono bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-600/50 font-bold">
                      {h.tier === 1 ? 'Tier-1 Hub' : h.tier === 2 ? 'Mechanized' : 'FLC Jetty'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#091e34]/80 border border-sky-500/30 text-xs space-y-1">
                    <div className="text-slate-200 font-medium">{h.type}</div>
                    <div className="text-[10px] text-sky-300 font-mono">State: {h.state} {h.district ? `• ${h.district}` : ''}</div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between px-1">
                    <span>Coordinates:</span>
                    <span className="text-sky-300 font-bold">{h.lat.toFixed(3)}°N, {h.lng.toFixed(3)}°E</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setUserVesselPos([h.lat, h.lng]);
                      setDockedPortName(h.name);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-abyssal-950 font-bold text-xs shadow-md shadow-sky-500/20 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Navigation className="w-3.5 h-3.5 text-abyssal-950" />
                    <span>Set Vessel GPS Dock Here</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Argo Float Markers */}
        {showFloats &&
          floats.map((f, index) => {
            const isSelected = selectedFloatId === f.float_id;
            const isHighlighted = highlightMarkers?.some((m) => m.float_id === f.float_id) ?? false;
            const icon = createFloatIcon(isHighlighted, isSelected);

            return (
              <Marker
                key={`${f.float_id}-${index}`}
                position={[f.latitude, f.longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectFloat && onSelectFloat(f.float_id),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[260px] max-w-[290px] text-slate-100 space-y-2 font-sans">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-glow-cyan"></span>
                        <span className="font-bold text-ocean-cyan text-sm font-heading">Float #{f.float_id}</span>
                      </div>
                      <span className="text-[9px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-600/50 font-bold">
                        ACTIVE CTD
                      </span>
                    </div>

                    {/* 4 Data Tiles */}
                    <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-[#0a1b2d] border border-cyan-500/20">
                        <span className="text-slate-400 block text-[9px] uppercase">Profiling Depth</span>
                        <strong className="text-white text-xs">{f.max_depth ? `${f.max_depth.toFixed(0)}m` : '2000m'}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0a1b2d] border border-cyan-500/20">
                        <span className="text-slate-400 block text-[9px] uppercase">Observation Date</span>
                        <strong className="text-cyan-300 text-xs">{new Date(f.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0a1b2d] border border-cyan-500/20 col-span-2 flex items-center justify-between">
                        <span className="text-slate-400 text-[10px]">Position:</span>
                        <span className="text-white font-bold">{f.latitude.toFixed(3)}°N, {f.longitude.toFixed(3)}°E</span>
                      </div>
                    </div>

                    {onSelectFloat && (
                      <button
                        type="button"
                        onClick={() => onSelectFloat(f.float_id)}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-ocean-cyan to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-abyssal-950 font-bold text-xs shadow-md shadow-ocean-cyan/20 transition text-center cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Layers className="w-3.5 h-3.5 text-abyssal-950" />
                        <span>Inspect CTD Depth Profile</span>
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* 5. LIVE GPS VESSEL MARKER & NavIC ACTIVE ROUTE LINE */}
        {userVesselPos && (
          <Marker position={userVesselPos} icon={createVesselIcon()}>
            <Popup>
              <div className="p-1 space-y-1.5 font-mono text-xs text-slate-100 min-w-[210px]">
                <div className="font-bold text-emerald-400 flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" /> Your Coastal Vessel (GPS)
                </div>
                <div>Position: <strong className="text-white">{userVesselPos[0].toFixed(3)}°N, {userVesselPos[1].toFixed(3)}°E</strong></div>
                {dockedPortName && (
                  <div className="text-[10px] text-sky-300">
                    Docked: <strong>{dockedPortName}</strong>
                  </div>
                )}
                {activeRoutePfz && (
                  <div className="text-[11px] text-amber-300 pt-1 border-t border-slate-700">
                    Course Target: <strong>{activeRoutePfz.pfz_rating} PFZ ({activeRoutePfz.pfz_score}/100)</strong>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {activeRoutePfz && userVesselPos && (() => {
          const routeDistKm = haversineDistKm(
            userVesselPos[0],
            userVesselPos[1],
            activeRoutePfz.latitude,
            activeRoutePfz.longitude
          );
          const voyageHrs = (routeDistKm / 16.5).toFixed(1);
          const fuelL = Math.round(routeDistKm * 1.85);

          return (
            <>
              <Polyline
                positions={[userVesselPos, [activeRoutePfz.latitude, activeRoutePfz.longitude]]}
                pathOptions={{
                  color: '#f59e0b',
                  weight: 3.5,
                  dashArray: '8, 8',
                  opacity: 0.95,
                }}
              >
                <Tooltip sticky direction="top">
                  <div className="text-[11px] font-mono font-bold bg-[#071322]/98 text-amber-300 px-2.5 py-1.5 rounded-xl border border-amber-500/60 shadow-2xl space-y-0.5">
                    <div className="flex items-center gap-1.5 text-white">
                      <span>⚡ NavIC Course:</span>
                      <span className="text-amber-400">{routeDistKm.toFixed(1)} km</span>
                    </div>
                    <div className="text-[10px] text-slate-300 flex items-center gap-3 pt-0.5 border-t border-slate-800">
                      <span>⏱️ ~{voyageHrs} hrs</span>
                      <span>⛽ ~{fuelL} L</span>
                      <span className="text-emerald-300 font-sans">Target: {activeRoutePfz.target_species[0] || 'Tuna'}</span>
                    </div>
                  </div>
                </Tooltip>
              </Polyline>

              {/* Target PFZ Outer Target Reticle */}
              <CircleMarker
                center={[activeRoutePfz.latitude, activeRoutePfz.longitude]}
                radius={18}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: 'transparent',
                  weight: 2,
                  dashArray: '4, 4',
                }}
              />
            </>
          );
        })()}
      </MapContainer>

      {/* Collapsible Floating Multi-Sensor Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] pointer-events-auto">
        {!legendOpen ? (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="flex items-center space-x-1.5 bg-[#071322]/95 hover:bg-[#0c1e34] border border-cyan-500/30 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-slate-200 shadow-2xl transition cursor-pointer active:scale-95 ring-1 ring-cyan-500/10"
          >
            <Info className="w-3.5 h-3.5 text-ocean-cyan" />
            <span>Map Legend</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ) : (
          <div className="bg-[#071322]/98 backdrop-blur-2xl p-3.5 rounded-2xl border border-cyan-500/40 text-xs text-slate-200 space-y-2.5 shadow-2xl w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-16rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 ring-1 ring-cyan-500/20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-mono">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-ocean-cyan" />
                Sensor & PFZ Legend
              </span>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full border border-white shrink-0" style={{ backgroundColor: '#06b6d4', boxShadow: '0 0 10px #06b6d4' }}></span>
              <span className="text-[11px] font-medium">ARGO Floats (0–2,000m Subsurface Cast)</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full border border-amber-200 shrink-0" style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }}></span>
              <span className="text-[11px] font-medium">PFZ Opportunity Zones (Thermal Fronts)</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center shrink-0 text-[8px]" style={{ backgroundColor: '#0369a1', boxShadow: '0 0 8px #38bdf8' }}>⚓</span>
              <span className="text-[11px] font-medium">150+ Indian Harbours & Fish Landing Centers</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full border border-emerald-300 flex items-center justify-center shrink-0 text-[8px]" style={{ backgroundColor: '#064e3b', boxShadow: '0 0 8px #10b981' }}>⛵</span>
              <span className="text-[11px] font-medium">Live Fishing Vessel (NavIC GPS Tracker)</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full border border-rose-300 shrink-0" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></span>
              <span className="text-[11px] font-medium">NOAA Satellite SST Thermal Heatmap</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full border border-teal-300 shrink-0" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
              <span className="text-[11px] font-medium">NASA Chlorophyll-a Ocean Color</span>
            </div>

            <div className="pt-1.5 border-t border-slate-800 text-[10px] text-cyan-300/90 font-mono leading-tight">
              Scientific Fusion: In-situ ARGO CTD + continuous NOAA & NASA satellite grids for high-yield fishing zones.
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
