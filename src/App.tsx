import { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { ChatPanel } from './components/chat/ChatPanel';
import { OceanMap } from './components/viz/OceanMap';
import { DepthChart } from './components/viz/DepthChart';
import { OceanLens3D } from './components/viz/OceanLens3D';
import { AnomalyRadar } from './components/anomaly/AnomalyRadar';
import { WhatsAppSimulator } from './components/whatsapp/WhatsAppSimulator';
import { ArchitecturePipeline } from './components/pipeline/ArchitecturePipeline';
import { TelegramModal } from './components/common/TelegramModal';
import { OceanAtmosphere } from './components/common/OceanAtmosphere';
import { HudCornerBrackets } from './components/common/HudCornerBrackets';
import { 
  MapPin, 
  LineChart, 
  Box, 
  Compass, 
  Waves, 
  ArrowRight
} from 'lucide-react';

import {
  sendChatQuery,
  getFloats,
  getStats,
  getAnomalies,
  triggerAnomalyScan,
  getFloatTrajectory,
  getDepthProfile,
} from './services/api';

import type {
  AppMode,
  ChatMessage,
  FloatSummary,
  AnomalyAlert,
  ChartData,
  MapMarker,
} from './types';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('chat');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-IN');
  const [backendOnline, setBackendOnline] = useState<boolean>(true);

  // Core Application Data State
  const [floats, setFloats] = useState<FloatSummary[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [isScanningAnomalies, setIsScanningAnomalies] = useState<boolean>(false);

  // Chat Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);

  // Smart Stage Visualization State (Chat View)
  const [stageView, setStageView] = useState<'map' | 'chart' | '3d'>('map');
  const [hasEverQueried, setHasEverQueried] = useState<boolean>(false);

  // Ocean Explorer View Toggle State (Map View)
  const [explorerView, setExplorerView] = useState<'map' | '3d'>('map');

  // Visualization Selection State
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);
  const [highlightMarkers, setHighlightMarkers] = useState<MapMarker[] | null>(null);
  const [selectedFloatId, setSelectedFloatId] = useState<string | null>(null);
  const [floatTrajectory, setFloatTrajectory] = useState<FloatSummary[] | null>(null);

  // Initialize data on mount
  useEffect(() => {
    async function initData() {
      try {
        const [statsData, floatsData, anomaliesData] = await Promise.all([
          getStats().catch(() => null),
          getFloats().catch(() => ({ floats: [], count: 0 })),
          getAnomalies().catch(() => ({ anomalies: [], count: 0 })),
        ]);

        if (statsData) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }

        if (floatsData.floats.length > 0) {
          setFloats(floatsData.floats);
          setSelectedFloatId(floatsData.floats[0].float_id);
        }

        if (anomaliesData.anomalies.length > 0) {
          setAnomalies(anomaliesData.anomalies);
        }

        // Pre-fetch initial sample depth profile for when charts are opened
        try {
          const depthRes = await getDepthProfile(1);
          if (depthRes && depthRes.measurements.length > 0) {
            setActiveChart({
              chart_type: 'depth_profile',
              data: depthRes.measurements,
              x_key: 'depth',
              y_keys: ['temperature', 'salinity'],
              title: `Argo Profile #1 (Float #${floatsData.floats[0]?.float_id || '2902150'}) Depth Curve`,
            });
          }
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn('Backend connection warning:', err);
        setBackendOnline(false);
      }
    }

    initData();
  }, []);

  const [sessionId] = useState<string>(() => 'sess-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now());

  // Handle user chat submission with context-aware auto-switching
  const handleSendMessage = async (queryText: string, mode: 'text' | 'voice' = 'text') => {
    setHasEverQueried(true);

    const userMsgId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: queryText,
      timestamp: new Date(),
    };

    const botMsgId = `bot-${Date.now()}`;
    const placeholderBotMessage: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, placeholderBotMessage]);
    setIsChatLoading(true);

    try {
      const response = await sendChatQuery(queryText, mode, selectedLanguage, sessionId);

      const finalBotMessage: ChatMessage = {
        id: botMsgId,
        role: 'assistant',
        content: response.summary || response.answer || 'Query processed successfully.',
        summary: response.summary || response.answer,
        hero_stat: response.hero_stat,
        stats: response.stats,
        reading_count: response.reading_count,
        timestamp: new Date(),
        sql: response.sql,
        data: response.data,
        chart: response.chart,
        map_markers: response.map_markers,
        query_route: response.query_route,
        species_detected: response.species_detected,
        knowledge_sources: response.knowledge_sources,
        detected_language: response.detected_language,
        data_sources: response.data_sources,
        language: response.detected_language?.tts_locale || selectedLanguage,
        isLoading: false,
      };

      setMessages((prev) => prev.map((m) => (m.id === botMsgId ? finalBotMessage : m)));

      // Context-aware Smart Stage Auto-Switching:
      if (response.chart && response.chart.data && response.chart.data.length > 0) {
        setActiveChart(response.chart);
        setStageView('chart'); // Auto-switch to CTD chart for depth/profile queries
      } else if (response.map_markers && response.map_markers.length > 0) {
        setHighlightMarkers(response.map_markers);
        setStageView('map'); // Auto-switch to Map for location/harbour queries
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorBotMessage: ChatMessage = {
        id: botMsgId,
        role: 'assistant',
        content:
          "I couldn't reach the Lehar AI data service. Please check the connection and try again.",
        timestamp: new Date(),
        language: selectedLanguage,
        isLoading: false,
      };
      setMessages((prev) => prev.map((m) => (m.id === botMsgId ? errorBotMessage : m)));
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle float selection on map or classroom
  const handleSelectFloat = async (floatId: string) => {
    setSelectedFloatId(floatId);
    try {
      const trajectoryData = await getFloatTrajectory(floatId);
      if (trajectoryData && trajectoryData.trajectory.length > 0) {
        setFloatTrajectory(trajectoryData.trajectory);
      }

      const matchingFloat = floats.find((f) => f.float_id === floatId);
      if (matchingFloat) {
        if (matchingFloat.profile_id) {
          const depthRes = await getDepthProfile(matchingFloat.profile_id);
          if (depthRes.measurements.length > 0) {
            setActiveChart({
              chart_type: 'depth_profile',
              data: depthRes.measurements,
              x_key: 'depth',
              y_keys: ['temperature', 'salinity'],
              title: `Argo Float #${floatId} (Profile #${matchingFloat.profile_id})`,
            });
          }
        }
        setHighlightMarkers([
          {
            lat: matchingFloat.latitude,
            lon: matchingFloat.longitude,
            float_id: matchingFloat.float_id,
            date: matchingFloat.date,
          },
        ]);
      }
    } catch (err) {
      console.warn('Failed to load float trajectory:', err);
    }
  };

  // Handle anomaly selection and sync-highlight
  const handleSelectAnomaly = (anomaly: AnomalyAlert) => {
    setHighlightMarkers([
      {
        lat: anomaly.latitude,
        lon: anomaly.longitude,
        float_id: anomaly.float_id || 'Alert-Location',
        date: anomaly.date,
        label: `${anomaly.parameter.toUpperCase()} Deviation: ${anomaly.value}`,
      },
    ]);
  };

  // Trigger manual anomaly scan
  const handleTriggerAnomalyScan = async () => {
    setIsScanningAnomalies(true);
    try {
      await triggerAnomalyScan();
      const fresh = await getAnomalies();
      setAnomalies(fresh.anomalies);
    } catch (err) {
      console.warn('Scan trigger error:', err);
    } finally {
      setIsScanningAnomalies(false);
    }
  };

  const isStageActive = hasEverQueried || messages.length > 0;

  return (
    <div className="min-h-screen w-full relative text-slate-100 flex flex-col font-sans selection:bg-ocean-cyan selection:text-abyssal-950 bg-abyssal-950 overflow-y-auto custom-scrollbar">
      
      {/* Ambient Ocean Atmospheric Layer (Caustics & Bioluminescent Drift) */}
      <OceanAtmosphere />

      {/* Top Main Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={(mode) => {
          if (mode === '3d') {
            setCurrentMode('map');
            setExplorerView('3d');
          } else {
            setCurrentMode(mode);
          }
        }}
        backendOnline={backendOnline}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
      />

      {/* Live Telegram Bot QR Modal for Judges & Field Demos */}
      <TelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* Main Interactive Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-3 md:p-3.5 flex flex-col">
        
        {/* VIEW 1: AI CONSOLE + SMART STAGE (DEFAULT CHAT) */}
        {currentMode === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-[580px] lg:h-[calc(100vh-100px)]">
            
            {/* Left Console: Chat Panel (5 Cols) */}
            <div className="lg:col-span-5 h-[520px] lg:h-full flex flex-col overflow-hidden">
              <ChatPanel
                messages={messages}
                isLoading={isChatLoading}
                onSendMessage={handleSendMessage}
                onFocusMap={(markers) => {
                  setHasEverQueried(true);
                  setHighlightMarkers(markers);
                  setStageView('map');
                }}
                onView3D={() => {
                  setHasEverQueried(true);
                  setStageView('3d');
                }}
                selectedLanguage={selectedLanguage}
                onSelectLanguage={setSelectedLanguage}
              />
            </div>

            {/* Right Smart Stage: Single Context-Aware Panel (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col min-h-[520px] lg:h-full bg-abyssal-950/90 border border-abyssal-800/90 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-2xl relative glow-organism-cyan">
              <HudCornerBrackets />
              
              {/* Stage Top Dedicated Header Bar (Zero-Collision Layout) */}
              {isStageActive && (
                <div className="flex items-center justify-between px-4 py-2 bg-abyssal-900/95 border-b border-abyssal-800/90 shrink-0 z-20">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-ocean-cyan/15 text-ocean-cyan shrink-0">
                      {stageView === 'map' && <MapPin className="w-3.5 h-3.5" />}
                      {stageView === 'chart' && <LineChart className="w-3.5 h-3.5" />}
                      {stageView === '3d' && <Box className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white font-heading truncate">
                        {stageView === 'map' && 'Geospatial Fleet Map & PFZ Frontiers'}
                        {stageView === 'chart' && 'Hydrographic CTD Depth Curves (0–2,000m)'}
                        {stageView === '3d' && 'Volumetric 3D Water Column & Thermocline'}
                      </div>
                      <div className="text-[10px] text-cyan-300/80 font-mono leading-tight truncate">
                        {selectedFloatId ? `Active Float #${selectedFloatId} • In-Situ Cast` : 'Continuous Indian Ocean Domain'}
                      </div>
                    </div>
                  </div>

                  {/* Stage Dynamic View Controller */}
                  <div className="flex items-center gap-1 bg-abyssal-950 p-1 rounded-xl border border-abyssal-800 shrink-0 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setStageView('map')}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer active:scale-95 ${
                        stageView === 'map'
                          ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Compass className="w-3 h-3" />
                      <span className="hidden sm:inline">Fleet Map</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStageView('chart')}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer active:scale-95 ${
                        stageView === 'chart'
                          ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <LineChart className="w-3 h-3" />
                      <span className="hidden sm:inline">CTD Chart</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStageView('3d')}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer active:scale-95 ${
                        stageView === '3d'
                          ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Box className="w-3 h-3" />
                      <span className="hidden sm:inline">3D Lens</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Stage Dynamic Visualization Viewport */}
              {!isStageActive ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="relative ocean-breathing">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-ocean-cyan/20 via-teal-500/10 to-abyssal-900 border border-ocean-cyan/30 flex items-center justify-center text-ocean-cyan shadow-glow-cyan">
                      <Waves className="w-8 h-8 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-sm font-bold text-white font-heading">
                      Interactive Ocean Discovery Stage
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Ask any question on the left console to trigger dynamic in-situ float positions, depth charts, and 3D thermocline columns.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 w-full h-full relative overflow-hidden">
                  {stageView === 'map' && (
                    <OceanMap
                      floats={floats}
                      highlightMarkers={highlightMarkers}
                      onSelectFloat={handleSelectFloat}
                      selectedFloatId={selectedFloatId}
                      trajectory={floatTrajectory}
                    />
                  )}

                  {stageView === 'chart' && (
                    <div className="w-full h-full p-4">
                      <DepthChart chart={activeChart} />
                    </div>
                  )}

                  {stageView === '3d' && (
                    <OceanLens3D
                      selectedFloatId={selectedFloatId}
                      profileData={activeChart?.chart_type === 'depth_profile' ? activeChart.data : []}
                    />
                  )}
                </div>
              )}

            </div>

          </div>
        )}

        {/* VIEW 2: OCEAN EXPLORER (MERGED MAP & 3D WITH INTERNAL TOGGLE) */}
        {(currentMode === 'map' || currentMode === '3d') && (
          <div className="flex-1 h-full min-h-0 flex flex-col relative rounded-2xl overflow-hidden shadow-2xl border border-cyan-500/20 glow-organism-cyan bg-abyssal-950">
            <HudCornerBrackets />
            
            {/* Dedicated Top Explorer Header Bar (Zero-Collision Dock) */}
            <div className="flex items-center justify-between px-4 py-2 bg-abyssal-900/95 border-b border-abyssal-800/90 shrink-0 z-30">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-ocean-cyan/15 text-ocean-cyan shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white font-heading truncate">
                    Ocean Explorer & Geospatial Fleet GIS
                  </h3>
                  <p className="text-[10px] text-cyan-300/80 font-mono leading-tight truncate">
                    97 Active ARGO Floats • Multi-Sensor Thermal Fronts • Live NavIC GPS
                  </p>
                </div>
              </div>

              {/* Segmented Switcher */}
              <div className="flex items-center gap-1 bg-abyssal-950 p-1 rounded-xl border border-abyssal-800 shrink-0 shadow-inner">
                <button
                  type="button"
                  onClick={() => setExplorerView('map')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                    explorerView === 'map'
                      ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>2D Fleet Map</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExplorerView('3d')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                    explorerView === '3d'
                      ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D OceanLens WebGL</span>
                </button>
              </div>
            </div>

            <div className="flex-1 w-full h-full relative overflow-hidden">
              {explorerView === 'map' ? (
                <OceanMap
                  floats={floats}
                  highlightMarkers={highlightMarkers}
                  onSelectFloat={handleSelectFloat}
                  selectedFloatId={selectedFloatId}
                  trajectory={floatTrajectory}
                />
              ) : (
                <OceanLens3D
                  selectedFloatId={selectedFloatId}
                  profileData={activeChart?.chart_type === 'depth_profile' ? activeChart.data : []}
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: PROACTIVE ANOMALY RADAR WATCHDOG */}
        {currentMode === 'anomaly' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 h-full min-h-0 overflow-hidden">
            <div className="lg:col-span-6 h-full min-h-0 flex flex-col overflow-hidden">
              <AnomalyRadar
                anomalies={anomalies}
                onSelectAnomaly={handleSelectAnomaly}
                onHoverAnomaly={(anomaly) => {
                  if (anomaly) {
                    setHighlightMarkers([
                      {
                        lat: anomaly.latitude,
                        lon: anomaly.longitude,
                        float_id: anomaly.float_id || 'Alert',
                        date: anomaly.date,
                        label: `${anomaly.parameter.toUpperCase()}: ${anomaly.value}`,
                      },
                    ]);
                  }
                }}
                onTriggerScan={handleTriggerAnomalyScan}
                isScanning={isScanningAnomalies}
              />
            </div>
            <div className="lg:col-span-6 h-full min-h-0 rounded-2xl overflow-hidden shadow-2xl">
              <OceanMap
                floats={floats}
                highlightMarkers={
                  highlightMarkers && highlightMarkers.length > 0
                    ? highlightMarkers
                    : anomalies.map((a) => ({
                        lat: a.latitude,
                        lon: a.longitude,
                        float_id: a.float_id || 'Alert',
                        date: a.date,
                        label: `${a.parameter.toUpperCase()}: ${a.value}`,
                      }))
                }
                onSelectFloat={handleSelectFloat}
                selectedFloatId={selectedFloatId}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: WHATSAPP COASTAL BOT SIMULATOR */}
        {currentMode === 'whatsapp' && (
          <div className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar">
            <WhatsAppSimulator selectedLanguage={selectedLanguage} />
          </div>
        )}

        {/* VIEW 5: SYSTEM ARCHITECTURE PIPELINE */}
        {currentMode === 'pipeline' && (
          <div className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar">
            <ArchitecturePipeline />
          </div>
        )}

      </main>

      {/* Clean Footer Bar */}
      <footer className="border-t border-abyssal-900 bg-abyssal-950/90 px-4 py-1.5 text-center text-[10px] text-slate-500 shrink-0">
        <p>Lehar AI 1.0 • Know the Sea. Know the Way. • Developed for INCOIS & Ministry of Earth Sciences (SIH26040)</p>
      </footer>

    </div>
  );
}
