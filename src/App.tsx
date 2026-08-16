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

export function App() {
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
          // Set initial default float
          setSelectedFloatId(floatsData.floats[0].float_id);
        }

        if (anomaliesData.anomalies.length > 0) {
          setAnomalies(anomaliesData.anomalies);
        }

        // Pre-fetch initial sample depth profile for initial view
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

  // Handle user chat submission
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

      // If backend returned map markers, highlight them
      if (response.map_markers && response.map_markers.length > 0) {
        setHighlightMarkers(response.map_markers);
      }

      // If backend returned chart data, update right pane
      if (response.chart) {
        setActiveChart(response.chart);
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
              title: `Observed CTD Profile — Float #${matchingFloat.float_id}`,
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

  // Handle anomaly selection
  const handleSelectAnomaly = (anomaly: AnomalyAlert) => {
    setHighlightMarkers([
      {
        lat: anomaly.latitude,
        lon: anomaly.longitude,
        float_id: anomaly.float_id || 'Alert-Location',
        date: anomaly.date,
        label: `${anomaly.parameter.toUpperCase()} Spike: ${anomaly.value}`,
      },
    ]);
    setCurrentMode('map');
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
        onSelectMode={setCurrentMode}
        stats={stats}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={setSelectedLanguage}
        backendOnline={backendOnline}
      />

      {/* Main Interactive Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-6 flex flex-col gap-4">
        
        {/* VIEW 1: DUAL-PANE CHAT & REALTIME DISCOVERY (DEFAULT) */}
        {currentMode === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 h-[calc(100vh-110px)] min-h-[600px]">
            
            {/* Left Console: Chat Panel (5 Cols) */}
            <div className="lg:col-span-5 h-full">
              <ChatPanel
                messages={messages}
                isLoading={isChatLoading}
                onSendMessage={handleSendMessage}
                onFocusMap={(markers) => {
                  setHighlightMarkers(markers);
                  setCurrentMode('map');
                }}
                onView3D={() => setCurrentMode('3d')}
                selectedLanguage={selectedLanguage}
                stats={stats}
              />
            </div>

            {/* Right Stage: Interactive Visualization Hub (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4 h-full">
              
              {/* Top Half: Interactive Ocean Map */}
              <div className="flex-1 min-h-[280px] rounded-2xl overflow-hidden shadow-xl">
                <OceanMap
                  floats={floats}
                  highlightMarkers={highlightMarkers}
                  onSelectFloat={handleSelectFloat}
                  selectedFloatId={selectedFloatId}
                  trajectory={floatTrajectory}
                />
              </div>

              {/* Bottom Half: CTD Depth Curve Chart */}
              <div className="h-[280px] shrink-0">
                <DepthChart chart={activeChart} />
              </div>

            </div>

          </div>
        )}

        {/* VIEW 2: FULL FLEET MAP EXPLORER */}
        {currentMode === 'map' && (
          <div className="flex-1 h-[calc(100vh-110px)] min-h-[600px] flex flex-col gap-4">
            <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl">
              <OceanMap
                floats={floats}
                highlightMarkers={highlightMarkers}
                onSelectFloat={handleSelectFloat}
                selectedFloatId={selectedFloatId}
                trajectory={floatTrajectory}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: 3D OCEANLENS CROSS-SECTION */}
        {currentMode === '3d' && (
          <div className="flex-1 h-[calc(100vh-110px)] min-h-[600px] flex flex-col gap-4">
            <OceanLens3D
              selectedFloatId={selectedFloatId}
              profileData={activeChart?.chart_type === 'depth_profile' ? activeChart.data : []}
            />
          </div>
        )}

        {/* VIEW 4: PROACTIVE ANOMALY RADAR WATCHDOG */}
        {currentMode === 'anomaly' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 h-[calc(100vh-110px)] min-h-[600px]">
            <div className="lg:col-span-6 h-full">
              <AnomalyRadar
                anomalies={anomalies}
                onSelectAnomaly={handleSelectAnomaly}
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

        {/* VIEW 5: WHATSAPP BOT SIMULATOR */}
        {currentMode === 'whatsapp' && (
          <div className="flex-1 h-[calc(100vh-110px)] min-h-[600px] flex flex-col">
            <WhatsAppSimulator selectedLanguage={selectedLanguage} />
          </div>
        )}

        {/* VIEW 6: CLASSROOM / ADOPT A FLOAT */}
        {currentMode === 'classroom' && (
          <div className="flex-1 h-[calc(100vh-110px)] min-h-[600px] flex flex-col gap-4">
            <AdoptFloat
              floats={floats}
              onSelectFloatForMap={(fId) => {
                handleSelectFloat(fId);
                setCurrentMode('map');
              }}
            />
          </div>
        )}

        {/* VIEW 7: SYSTEM ARCHITECTURE PIPELINE */}
        {currentMode === 'pipeline' && (
          <div className="flex-1 h-[calc(100vh-110px)] min-h-[600px] flex flex-col">
            <ArchitecturePipeline />
          </div>
        )}

      </main>

      {/* Persistent Status Bar Footer */}
      <footer className="border-t border-slate-800/80 py-2 px-6 text-xs text-slate-500 bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200 font-heading">Lehar AI 1.0</span>
            <span>•</span>
            <span className="text-cyan-400 font-medium">Know the Sea. Know the Way.</span>
            <span>•</span>
            <span className="text-slate-400 font-mono">Team: Ctrl Alt Elites</span>
          </div>

          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>FastAPI Backend Active (646 Profiles / 97 Floats)</span>
            </span>
            <span className="hidden md:inline text-slate-600">|</span>
            <span className="hidden md:inline text-slate-400">
              INCOIS Indian Ocean Sector (30°E-120°E)
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
