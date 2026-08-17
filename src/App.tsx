import { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { ChatPanel } from './components/chat/ChatPanel';
import { OceanMap } from './components/viz/OceanMap';
import { DepthChart } from './components/viz/DepthChart';
import { OceanLens3D } from './components/viz/OceanLens3D';
import { AnomalyRadar } from './components/anomaly/AnomalyRadar';
import { AdoptFloat } from './components/education/AdoptFloat';
import { WhatsAppSimulator } from './components/whatsapp/WhatsAppSimulator';
import { ArchitecturePipeline } from './components/pipeline/ArchitecturePipeline';
import { MapPin, LineChart, Box, Compass } from 'lucide-react';

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
  DashboardStats,
  ChartData,
  MapMarker,
} from './types';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('chat');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-IN');
  const [backendOnline, setBackendOnline] = useState<boolean>(true);

  // Core Application Data State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [floats, setFloats] = useState<FloatSummary[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [isScanningAnomalies, setIsScanningAnomalies] = useState<boolean>(false);

  // Chat Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Smart Stage Visualization State (Chat View)
  const [stageView, setStageView] = useState<'map' | 'chart' | '3d'>('map');

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
          setStats(statsData);
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

        // Pre-fetch initial sample depth profile
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

  // Handle user chat submission with context-aware auto-switching
  const handleSendMessage = async (queryText: string, mode: 'text' | 'voice' = 'text') => {
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
      const response = await sendChatQuery(queryText, mode, selectedLanguage);

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
        language: selectedLanguage,
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

      // Also find a profile for this float to render depth chart
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      
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
      />

      {/* Main Interactive Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-5 flex flex-col">
        
        {/* VIEW 1: AI CONSOLE + SMART STAGE (DEFAULT CHAT) */}
        {currentMode === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[580px] h-[calc(100vh-80px)]">
            
            {/* Left Console: Chat Panel (5 Cols) */}
            <div className="lg:col-span-5 h-full">
              <ChatPanel
                messages={messages}
                isLoading={isChatLoading}
                onSendMessage={handleSendMessage}
                onFocusMap={(markers) => {
                  setHighlightMarkers(markers);
                  setStageView('map');
                }}
                onView3D={() => setStageView('3d')}
                selectedLanguage={selectedLanguage}
                onSelectLanguage={setSelectedLanguage}
                stats={stats}
              />
            </div>

            {/* Right Smart Stage: Single Context-Aware Panel (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl relative">
              
              {/* Stage Top Floating Segmented Switch */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-slate-950/95 backdrop-blur-md p-1 rounded-xl border border-slate-800/90 shadow-xl">
                <button
                  onClick={() => setStageView('map')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    stageView === 'map'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Ocean Map</span>
                </button>

                <button
                  onClick={() => setStageView('chart')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    stageView === 'chart'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" />
                  <span>CTD Profile</span>
                </button>

                <button
                  onClick={() => setStageView('3d')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    stageView === '3d'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D Lens</span>
                </button>
              </div>

              {/* Stage Active Component */}
              <div className="flex-1 w-full h-full relative">
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
                  <div className="w-full h-full p-2">
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

            </div>

          </div>
        )}

        {/* VIEW 2: OCEAN EXPLORER (MERGED MAP & 3D WITH INTERNAL TOGGLE) */}
        {(currentMode === 'map' || currentMode === '3d') && (
          <div className="flex-1 min-h-[580px] h-[calc(100vh-80px)] flex flex-col relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80">
            
            {/* Top Explorer View Selector */}
            <div className="absolute top-3 left-16 z-30 flex items-center gap-1 bg-slate-950/95 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-xl">
              <button
                onClick={() => setExplorerView('map')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  explorerView === 'map'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>2D Fleet Map</span>
              </button>

              <button
                onClick={() => setExplorerView('3d')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  explorerView === '3d'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D OceanLens WebGL</span>
              </button>
            </div>

            <div className="flex-1 w-full h-full">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[580px] h-[calc(100vh-80px)]">
            <div className="lg:col-span-6 h-full">
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
            <div className="lg:col-span-6 h-full rounded-2xl overflow-hidden shadow-2xl">
              <OceanMap
                floats={floats}
                highlightMarkers={highlightMarkers}
                onSelectFloat={handleSelectFloat}
                selectedFloatId={selectedFloatId}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: WHATSAPP COASTAL BOT SIMULATOR */}
        {currentMode === 'whatsapp' && (
          <div className="flex-1 min-h-[580px] h-[calc(100vh-80px)] flex flex-col">
            <WhatsAppSimulator selectedLanguage={selectedLanguage} />
          </div>
        )}

        {/* VIEW 5: CLASSROOM / ADOPT A FLOAT */}
        {currentMode === 'classroom' && (
          <div className="flex-1 min-h-[580px] h-[calc(100vh-80px)] flex flex-col">
            <AdoptFloat
              floats={floats}
              onSelectFloatForMap={(fId) => {
                handleSelectFloat(fId);
                setCurrentMode('map');
                setExplorerView('map');
              }}
            />
          </div>
        )}

        {/* VIEW 6: SYSTEM ARCHITECTURE PIPELINE */}
        {currentMode === 'pipeline' && (
          <div className="flex-1 min-h-[580px] h-[calc(100vh-80px)] flex flex-col">
            <ArchitecturePipeline />
          </div>
        )}

      </main>

      {/* Clean Footer Bar (No duplicated telemetry numbers) */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-2 text-center text-[10px] text-slate-500">
        <p>Lehar AI 1.0 • Know the Sea. Know the Way. • Developed for INCOIS & Ministry of Earth Sciences (SIH26040)</p>
      </footer>

    </div>
  );
}
