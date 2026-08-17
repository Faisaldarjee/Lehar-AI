import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Fish, ChevronDown, Compass } from 'lucide-react';
import type { FloatSummary, MapMarker, PFZAdvisory } from '../../types';
import { getPFZAdvisories } from '../../services/api';

// Custom Map Auto-Focuser Component
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

interface OceanMapProps {
  floats: FloatSummary[];
  highlightMarkers?: MapMarker[] | null;
  onSelectFloat?: (floatId: string) => void;
  selectedFloatId?: string | null;
  trajectory?: FloatSummary[] | null;
}

// Function to create styled SVG pulsating markers
function createFloatIcon(isHighlighted: boolean, isSelected: boolean) {
  const color = isSelected ? '#f59e0b' : isHighlighted ? '#2dd4bf' : '#06b6d4';
  const size = isSelected ? 24 : isHighlighted ? 20 : 14;

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
        box-shadow: 0 0 12px ${color};
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

export const OceanMap: React.FC<OceanMapProps> = ({
  floats,
  highlightMarkers,
  onSelectFloat,
  selectedFloatId,
  trajectory,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.0, 75.0]); // Indian Ocean
  const [mapZoom, setMapZoom] = useState<number>(5);
  const [showPFZ, setShowPFZ] = useState<boolean>(true);
  const [sectorMenuOpen, setSectorMenuOpen] = useState<boolean>(false);
  const [pfzZones, setPfzZones] = useState<PFZAdvisory[]>([]);

  // Load PFZ advisories
  useEffect(() => {
    async function loadPFZ() {
      try {
        const data = await getPFZAdvisories('all', 50);
        if (data && data.advisories) {
          setPfzZones(data.advisories);
        }
      } catch (err) {
        console.warn('PFZ fetch warning:', err);
      }
    }
    loadPFZ();
  }, []);

  // If highlighted markers are provided, focus on the first one
  useEffect(() => {
    if (highlightMarkers && highlightMarkers.length > 0) {
      setMapCenter([highlightMarkers[0].lat, highlightMarkers[0].lon]);
      setMapZoom(6);
    }
  }, [highlightMarkers]);

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
        setMapCenter([12.0, 78.0]);
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
            onClick={() => setSectorMenuOpen(!sectorMenuOpen)}
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
                { id: 'all', label: 'Entire Indian Ocean', coord: '12°N, 78°E' },
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

        {/* Right: PFZ Layer Toggle + Float Counter */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowPFZ(!showPFZ)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl transition cursor-pointer active:scale-95 ${
              showPFZ
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40'
                : 'bg-abyssal-950/90 border-abyssal-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fish className={`w-3.5 h-3.5 ${showPFZ ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>PFZ Fishing Advisories ({pfzZones.length})</span>
          </button>

          <div className="hidden sm:flex items-center space-x-1.5 bg-abyssal-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-abyssal-800 text-xs font-mono text-slate-300 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-ocean-cyan shadow-sm"></span>
            <span>{floats.length} Active ARGO Floats</span>
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
        <MapController center={mapCenter} zoom={mapZoom} />

        {/* CartoDB Dark Matter Basemap */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> | <a href="https://incois.gov.in">INCOIS ARGO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* PFZ Circles Layer */}
        {showPFZ &&
          pfzZones.map((pfz, idx) => {
            const color =
              pfz.pfz_rating === 'Excellent'
                ? '#10b981'
                : pfz.pfz_rating === 'Good'
                ? '#eab308'
                : '#f97316';

            return (
              <CircleMarker
                key={`pfz-${idx}`}
                center={[pfz.latitude, pfz.longitude]}
                radius={pfz.pfz_rating === 'Excellent' ? 14 : 10}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.35,
                  weight: 2,
                  dashArray: pfz.pfz_rating === 'Excellent' ? undefined : '3, 4',
                }}
              >
                <Popup>
                  <div className="p-1 space-y-2 text-slate-100 min-w-[220px]">
                    <div className="flex items-center justify-between border-b border-abyssal-800 pb-1">
                      <span className="font-bold text-emerald-400 text-sm flex items-center gap-1 font-heading">
                        <Fish className="w-3.5 h-3.5" /> PFZ: {pfz.pfz_rating} ({pfz.pfz_score}/100)
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700">
                        {pfz.sst_celsius}°C
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{pfz.advisory}</p>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-300 pt-1 border-t border-abyssal-800">
                      <div>
                        <span className="text-slate-500 block text-[9px]">SST</span>
                        {pfz.sst_celsius}°C
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">MLD</span>
                        {pfz.mld_meters ? `${pfz.mld_meters}m` : 'N/A'}
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block text-[9px]">Nearest Harbour</span>
                        {pfz.nearest_harbour.distance_km}km {pfz.nearest_harbour.compass} of {pfz.nearest_harbour.harbour}
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
        {floats.map((f, index) => {
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

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-abyssal-950/95 backdrop-blur-xl p-2.5 rounded-xl border border-abyssal-800 text-[10px] text-slate-300 space-y-1.5 shadow-2xl">
        <div className="font-bold text-slate-400 uppercase tracking-wider font-mono">Fleet & PFZ Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-ocean-cyan shadow-glow-cyan-sm"></span>
          <span>ARGO Profiling Float</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm"></span>
          <span>PFZ Excellent Fishing Zone (SST 27-29°C)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm"></span>
          <span>PFZ Good / Selected Float</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-ocean-cyan"></span>
          <span>10-Day Drift Trajectory</span>
        </div>
      </div>

    </div>
  );
};
