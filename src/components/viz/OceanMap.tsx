import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, RefreshCw, Fish } from 'lucide-react';
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
  const color = isSelected ? '#f59e0b' : isHighlighted ? '#38bdf8' : '#06b6d4';
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
      setMapZoom(5);
    }
  }, [trajectory]);

  // Convert trajectory to polyline coordinates
  const polylinePositions: [number, number][] = trajectory
    ? trajectory.map((p) => [p.latitude, p.longitude])
    : [];

  const handleResetView = () => {
    setMapCenter([14.0, 75.0]);
    setMapZoom(5);
  };

  const handleRegionFocus = (lat: number, lon: number, zoom: number) => {
    setMapCenter([lat, lon]);
    setMapZoom(zoom);
  };

  return (
    <div className="relative w-full h-full min-h-[350px] rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl bg-slate-950">
      
      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Region Quick Selectors */}
        <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 pointer-events-auto shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-cyan-400" /> Sector:
          </span>
          <button
            onClick={() => handleRegionFocus(18.9, 70.5, 6)}
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition"
          >
            Mumbai Coast
          </button>
          <button
            onClick={() => handleRegionFocus(15.0, 66.0, 5)}
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition"
          >
            Arabian Sea
          </button>
          <button
            onClick={() => handleRegionFocus(15.0, 85.0, 5)}
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition"
          >
            Bay of Bengal
          </button>
          <button
            onClick={() => handleRegionFocus(9.5, 75.5, 6)}
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition"
          >
            Kochi / South
          </button>
        </div>

        {/* Status / Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* PFZ Toggle */}
          <button
            onClick={() => setShowPFZ(!showPFZ)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-lg cursor-pointer ${
              showPFZ
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 shadow-emerald-950/30'
                : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Fish className="w-3.5 h-3.5 text-emerald-400" />
            <span>{showPFZ ? 'PFZ Zones Active' : 'Show PFZ Zones'}</span>
          </button>

          <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>{floats.length} Argo Floats</span>
          </div>

          <button
            onClick={handleResetView}
            title="Reset to Indian Ocean Center"
            className="p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition shadow-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

      </div>

      {/* Leaflet Map Canvas */}
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
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                      <span className="font-bold text-emerald-400 text-sm flex items-center gap-1">
                        <Fish className="w-3.5 h-3.5" /> PFZ: {pfz.pfz_rating} ({pfz.pfz_score}/100)
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700">
                        {pfz.sst_celsius}°C
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{pfz.advisory}</p>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-800">
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
              color: '#38bdf8',
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
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                    <span className="font-bold text-cyan-400 text-sm">Float #{f.float_id}</span>
                    <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800">
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
                      className="w-full mt-2 py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition text-center cursor-pointer"
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
      <div className="absolute bottom-3 right-3 z-[1000] bg-slate-950/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5 shadow-lg">
        <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Fleet & PFZ Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></span>
          <span>ARGO Profiling Float</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
          <span>PFZ Excellent Fishing Zone (SST 27-29°C)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400"></span>
          <span>PFZ Good / Selected Float</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-400"></span>
          <span>10-Day Drift Trajectory</span>
        </div>
      </div>

    </div>
  );
};
