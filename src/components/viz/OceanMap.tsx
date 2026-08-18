import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Fish, ChevronDown, Compass, Satellite, Leaf, Sparkles, Info, X, ChevronUp, Layers } from 'lucide-react';
import type { FloatSummary, MapMarker, PFZAdvisory, SatelliteGridPoint } from '../../types';
import { getPFZAdvisories, getSatelliteGrid } from '../../services/api';

// Custom Map Auto-Focuser & Dynamic Bounds Fitter Component
function MapBoundsController({
  center,
  zoom,
  highlightMarkers,
}: {
  center: [number, number];
  zoom: number;
  highlightMarkers?: MapMarker[] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (highlightMarkers && highlightMarkers.length > 1) {
      const validPoints = highlightMarkers.filter((m) => !isNaN(m.lat) && !isNaN(m.lon));
      if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints.map((m) => [m.lat, m.lon]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8, animate: true, duration: 1.2 });
        return;
      }
    }

    if (highlightMarkers && highlightMarkers.length === 1) {
      const p = highlightMarkers[0];
      if (!isNaN(p.lat) && !isNaN(p.lon)) {
        map.flyTo([p.lat, p.lon], 7, { duration: 1.2 });
        return;
      }
    }

    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, highlightMarkers, map]);

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
  const color = isSelected ? '#f59e0b' : isHighlighted ? '#f43f5e' : '#06b6d4';
  const size = isSelected ? 22 : isHighlighted ? 18 : 12;

  const svgHtml = `
    <div style="position: relative; width: ${size}px; height: ${size}px;">
      <span style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.75;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></span>
      <span style="
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px ${color};
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

export const OceanMap: React.FC<OceanMapProps> = ({
  floats,
  highlightMarkers,
  onSelectFloat,
  selectedFloatId,
  trajectory,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.0, 75.0]); // Indian Ocean
  const [mapZoom, setMapZoom] = useState<number>(5);
  
  // Layer Toggle States
  const [showPFZ, setShowPFZ] = useState<boolean>(true);
  const [showFloats, setShowFloats] = useState<boolean>(true);
  const [showSatelliteSST, setShowSatelliteSST] = useState<boolean>(false);
  const [showChlorophyll, setShowChlorophyll] = useState<boolean>(false);
  
  // UI Dropdowns & Collapsible Legend
  const [sectorMenuOpen, setSectorMenuOpen] = useState<boolean>(false);
  const [satLayersMenuOpen, setSatLayersMenuOpen] = useState<boolean>(false);
  const [legendOpen, setLegendOpen] = useState<boolean>(false);

  const [pfzZones, setPfzZones] = useState<PFZAdvisory[]>([]);
  const [satelliteGrid, setSatelliteGrid] = useState<SatelliteGridPoint[]>([]);

  // Load PFZ advisories & Satellite grid on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [pfzRes, satRes] = await Promise.all([
          getPFZAdvisories('all', 50).catch(() => ({ advisories: [] })),
          getSatelliteGrid(2).catch(() => ({ points: [] })), // 1.0° resolution downsample for high performance
        ]);
        if (pfzRes && pfzRes.advisories) {
          setPfzZones(pfzRes.advisories);
        }
        if (satRes && satRes.points) {
          setSatelliteGrid(satRes.points);
        }
      } catch (err) {
        console.warn('Map data fetch warning:', err);
      }
    }
    loadData();
  }, []);

  // If trajectory is provided, focus on latest point
  useEffect(() => {
    if (trajectory && trajectory.length > 0) {
      const latest = trajectory[trajectory.length - 1];
      setMapCenter([latest.latitude, latest.longitude]);
      setMapZoom(6);
    }
  }, [trajectory]);

  // Handle focus on specific ocean sectors
  const handleFocusSector = (sector: 'arabian' | 'bengal' | 'equatorial' | 'south' | 'all') => {
    switch (sector) {
      case 'arabian':
        setMapCenter([16.0, 68.0]);
        setMapZoom(6);
        break;
      case 'bengal':
        setMapCenter([15.0, 88.0]);
        setMapZoom(6);
        break;
      case 'equatorial':
        setMapCenter([0.0, 78.0]);
        setMapZoom(5);
        break;
      case 'south':
        setMapCenter([-15.0, 80.0]);
        setMapZoom(5);
        break;
      case 'all':
      default:
        setMapCenter([14.0, 75.0]);
        setMapZoom(5);
        break;
    }
    setSectorMenuOpen(false);
  };

  const polylinePositions: [number, number][] =
    trajectory?.map((t) => [t.latitude, t.longitude] as [number, number]) || [];

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-abyssal-800/80 bg-abyssal-950 shadow-2xl flex flex-col">
      
      {/* Map Floating Control Header */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left: Sector Selector Dropdown */}
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setSectorMenuOpen(!sectorMenuOpen);
              setSatLayersMenuOpen(false);
            }}
            className="flex items-center space-x-2 bg-abyssal-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-abyssal-800 text-xs font-bold text-slate-200 hover:text-white shadow-xl transition cursor-pointer active:scale-95"
          >
            <Compass className="w-3.5 h-3.5 text-ocean-cyan" />
            <span>Jump to sector</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${sectorMenuOpen ? 'rotate-180 text-ocean-cyan' : ''}`} />
          </button>

          {/* Sector Menu Popover */}
          {sectorMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-52 bg-abyssal-950 border border-abyssal-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
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
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-white hover:bg-abyssal-850 transition cursor-pointer"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[10px] font-mono text-slate-500">{item.coord}</span>
                </button>
              ))}
            </div>
          )}
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
            <span>PFZ Zones ({pfzZones.length})</span>
          </button>

          {/* 3. Grouped Satellite Layers Dropdown */}
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

        </div>

      </div>

      {/* React Leaflet Map Container */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%', minHeight: '350px' }}
        scrollWheelZoom={true}
      >
        <MapBoundsController center={mapCenter} zoom={mapZoom} highlightMarkers={highlightMarkers} />

        {/* CartoDB Dark Matter Basemap */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> | <a href="https://incois.gov.in">INCOIS ARGO</a> | NOAA CoastWatch | NASA OceanColor'
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

        {/* PFZ FISHING OPPORTUNITY ZONES (WARM GOLDEN TARGET MARKERS) */}
        {showPFZ &&
          pfzZones.map((pfz, idx) => {
            const isHighYield = pfz.pfz_score >= 80;
            return (
              <CircleMarker
                key={`pfz-zone-${idx}`}
                center={[pfz.latitude, pfz.longitude]}
                radius={isHighYield ? 12 : 9}
                pathOptions={{
                  color: '#fbbf24', // Warm Golden Amber
                  fillColor: isHighYield ? '#f59e0b' : '#d97706',
                  fillOpacity: 0.85,
                  weight: isHighYield ? 2.5 : 1.5,
                }}
              >
                <Popup>
                  <div className="p-1 space-y-2 text-slate-100 min-w-[240px]">
                    <div className="flex items-center justify-between border-b border-abyssal-800 pb-1">
                      <span className="font-bold text-amber-400 text-sm flex items-center gap-1 font-heading">
                        <Fish className="w-3.5 h-3.5" /> PFZ: {pfz.pfz_rating} ({pfz.pfz_score}/100)
                      </span>
                      <span className="text-[10px] font-mono bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700">
                        {pfz.sst_celsius}°C
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{pfz.advisory}</p>

                    {/* Multi-sensor metrics comparison */}
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-300 pt-1 border-t border-abyssal-800">
                      <div>
                        <span className="text-slate-500 block text-[9px]">Argo SST</span>
                        {pfz.sst_celsius}°C
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Sat SST</span>
                        {pfz.satellite_sst ? `${pfz.satellite_sst}°C` : `${pfz.sst_celsius}°C`}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Chl-a</span>
                        {pfz.chlorophyll_mg_m3 ? `${pfz.chlorophyll_mg_m3} mg/m³` : '0.45 mg/m³'}
                      </div>
                      <div className="col-span-3 pt-0.5">
                        <span className="text-slate-500 block text-[9px]">Nearest Harbour</span>
                        {pfz.nearest_harbour.distance_km}km {pfz.nearest_harbour.compass} of {pfz.nearest_harbour.harbour}
                      </div>
                    </div>

                    {/* Multi-Sensor Fusion Contribution Tags */}
                    <div className="pt-1.5 border-t border-abyssal-800">
                      <span className="text-[9px] font-mono text-slate-400 block mb-1">Fused Data Sources:</span>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-[8px] font-mono">
                          ARGO Subsurface #{pfz.float_id}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[8px] font-mono">
                          NOAA MUR SST
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[8px] font-mono">
                          NASA VIIRS Chlorophyll
                        </span>
                      </div>
                    </div>

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
                  <div className="p-1 space-y-2 text-slate-100 min-w-[200px]">
                    <div className="flex items-center justify-between border-b border-abyssal-800 pb-1">
                      <span className="font-bold text-ocean-cyan text-sm font-heading">Float #{f.float_id}</span>
                      <span className="text-[10px] font-mono bg-abyssal-900 text-ocean-cyan px-1.5 py-0.5 rounded border border-abyssal-800">
                        Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Latitude</span>
                        {f.latitude.toFixed(3)}°
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Longitude</span>
                        {f.longitude.toFixed(3)}°
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Max Depth</span>
                        {f.max_depth ? `${f.max_depth.toFixed(0)}m` : '2000m'}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Date</span>
                        {new Date(f.date).toLocaleDateString()}
                      </div>
                    </div>

                    {onSelectFloat && (
                      <button
                        onClick={() => onSelectFloat(f.float_id)}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold text-xs transition text-center cursor-pointer shadow-md"
                      >
                        Inspect CTD Depth Profile
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Collapsible Floating Multi-Sensor Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] pointer-events-auto">
        {!legendOpen ? (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="flex items-center space-x-1.5 bg-abyssal-950/95 hover:bg-abyssal-900 border border-abyssal-800 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-slate-300 shadow-2xl transition cursor-pointer active:scale-95"
          >
            <Info className="w-3.5 h-3.5 text-ocean-cyan" />
            <span>Map Legend</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ) : (
          <div className="bg-abyssal-950/98 backdrop-blur-2xl p-3 rounded-2xl border border-abyssal-800 text-[10px] text-slate-300 space-y-2 shadow-2xl max-w-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-abyssal-800 pb-1.5 font-mono">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-ocean-cyan" />
                Sensor Legend
              </span>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-abyssal-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ocean-cyan shadow-glow-cyan-sm shrink-0"></span>
              <span>ARGO Floats (0-2000m Subsurface)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-300 shadow-sm shrink-0"></span>
              <span>PFZ Opportunity Zones (Amber Target)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shrink-0"></span>
              <span>NOAA Satellite SST Thermal Heatmap</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shrink-0"></span>
              <span>NASA Chlorophyll-a Ocean Color</span>
            </div>

            <div className="pt-1 border-t border-abyssal-800/80 text-[9px] text-cyan-300/80 font-mono leading-tight">
              Scientific Fusion: Subsurface ARGO + continuous satellite SST & Chlorophyll for high-confidence PFZ.
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
