'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_V1 = '/api/proxy/v1';

// Icon components
const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"></rect>
    <rect x="14" y="4" width="4" height="16"></rect>
  </svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  </svg>
);

const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

interface SimulationEvent {
  id?: number;
  type: string;
  timestamp: string;
  session_id?: string;
  data?: any;
  severity?: string;
}

interface SimulationMetrics {
  obstacles_generated: number;
  countermeasures: number;
  success_rate: number;
  avg_response_ms: number;
  resilience_score: number;
}

interface SimulationStatus {
  running: boolean;
  paused: boolean;
  session_id: string | null;
  intensity: string;
  scenario: string | null;
  metrics: SimulationMetrics | null;
  duration_seconds: number;
}

interface Obstacle {
  id: number;
  obstacle_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
}

interface Countermeasure {
  id: number;
  action_type: string;
  status: string;
  confidence_score: number;
  created_at: string;
}

// Severity colors
const getSeverityColor = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-600';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-500';
    case 'LOW': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};

const getEventTypeIcon = (type: string) => {
  if (type.includes('OBSTACLE')) return <AlertTriangleIcon />;
  if (type.includes('COUNTERMEASURE')) return <ShieldIcon />;
  if (type.includes('SCENARIO') || type.includes('SIMULATION')) return <ZapIcon />;
  return <ActivityIcon />;
};

export default function AIEventsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('demo_showcase');
  const [selectedIntensity, setSelectedIntensity] = useState('moderate');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const eventStreamRef = useRef<EventSource | null>(null);

  // Fetch simulation status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/simulation/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch simulation status:', e);
    }
  }, []);

  // Fetch active obstacles
  const fetchObstacles = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles?active_only=true&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setObstacles(data);
      }
    } catch (e) {
      console.error('Failed to fetch obstacles:', e);
    }
  }, []);

  // Fetch event history
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/events/history?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
  }, []);

  // Setup polling
  useEffect(() => {
    if (isPanelOpen) {
      fetchStatus();
      fetchObstacles();
      fetchEvents();

      const interval = setInterval(() => {
        fetchStatus();
        fetchObstacles();
        if (status?.running) {
          fetchEvents();
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isPanelOpen, fetchStatus, fetchObstacles, fetchEvents, status?.running]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Start simulation
  const startSimulation = async (useScenario: boolean) => {
    setLoading(true);
    try {
      let url = `${API_V1}/obstacles/simulation/start?intensity=${selectedIntensity}`;
      if (useScenario) {
        url += `&scenario=${selectedScenario}`;
      }
      
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        showMessage('success', 'Simulation started!');
        fetchStatus();
      } else {
        const error = await res.json();
        showMessage('error', error.detail || 'Failed to start simulation');
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

  // Stop simulation
  const stopSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_V1}/obstacles/simulation/stop`, { method: 'POST' });
      if (res.ok) {
        showMessage('success', 'Simulation stopped');
        fetchStatus();
      } else {
        const error = await res.json();
        showMessage('error', error.detail || 'Failed to stop simulation');
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

  // Pause/Resume simulation
  const togglePause = async () => {
    setLoading(true);
    const action = status?.paused ? 'resume' : 'pause';
    try {
      const res = await fetch(`${API_V1}/obstacles/simulation/${action}`, { method: 'POST' });
      if (res.ok) {
        showMessage('success', `Simulation ${action}d`);
        fetchStatus();
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

  // Generate single obstacle
  const generateObstacle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles/generate?auto_respond=true`, { method: 'POST' });
      if (res.ok) {
        showMessage('success', 'Obstacle generated!');
        fetchObstacles();
        fetchEvents();
      } else {
        const error = await res.json();
        showMessage('error', error.detail || 'Failed to generate obstacle');
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // FAB button
  if (!isPanelOpen) {
    return (
      <button
        onClick={() => setIsPanelOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
      >
        <ActivityIcon />
        <span className="font-semibold">AI Simulation</span>
        {status?.running && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] bg-gray-900/95 backdrop-blur-lg rounded-lg shadow-2xl border border-purple-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon />
          <h3 className="font-bold text-white">AI Simulation Engine</h3>
        </div>
        <button
          onClick={() => setIsPanelOpen(false)}
          className="text-white/80 hover:text-white transition-colors"
        >
          <XIcon />
        </button>
      </div>

      {/* Status Bar */}
      {status && (
        <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.running ? (status.paused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse') : 'bg-gray-400'}`}></span>
            <span className="text-sm text-gray-300">
              {status.running ? (status.paused ? 'Paused' : 'Running') : 'Idle'}
            </span>
            {status.running && status.metrics && (
              <span className="text-xs text-gray-500">• {formatDuration(status.duration_seconds)}</span>
            )}
          </div>
          {status.running && status.metrics && (
            <div className="text-xs text-purple-400">
              Score: {status.metrics.resilience_score.toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className={`px-4 py-2 text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Controls Section */}
        <div className="p-4 border-b border-gray-700">
          {!status?.running ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="kashmir_ops">Kashmir Operations</option>
                </select>
                <select
                  value={selectedIntensity}
                  onChange={(e) => setSelectedIntensity(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="moderate">Moderate</option>
                  <option value="intense">Intense</option>
                  <option value="stress_test">Stress Test</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startSimulation(true)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <PlayIcon /> Run Scenario
                </button>
                <button
                  onClick={() => startSimulation(false)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <ZapIcon /> Continuous
                </button>
              </div>
              <button
                onClick={generateObstacle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm transition-colors disabled:opacity-50"
              >
                <AlertTriangleIcon /> Generate Single Obstacle
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={togglePause}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-1 ${status.paused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50`}
              >
                {status.paused ? <><PlayIcon /> Resume</> : <><PauseIcon /> Pause</>}
              </button>
              <button
                onClick={stopSimulation}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                <StopIcon /> Stop
              </button>
            </div>
          )}
        </div>

        {/* Metrics Section */}
        {status?.running && status?.metrics && (
          <div className="p-4 border-b border-gray-700">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Live Metrics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-red-400 font-bold">{status.metrics.obstacles_generated}</div>
                <div className="text-xs text-gray-500">Obstacles</div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-green-400 font-bold">{status.metrics.countermeasures}</div>
                <div className="text-xs text-gray-500">Counters</div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-blue-400 font-bold">{status.metrics.success_rate.toFixed(0)}%</div>
                <div className="text-xs text-gray-500">Success Rate</div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-purple-400 font-bold">{status.metrics.avg_response_ms.toFixed(0)}ms</div>
                <div className="text-xs text-gray-500">Avg Response</div>
              </div>
            </div>
          </div>
        )}

        {/* Active Obstacles */}
        {obstacles.length > 0 && (
          <div className="p-4 border-b border-gray-700">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Active Threats ({obstacles.length})</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {obstacles.map((obs) => (
                <div key={obs.id} className="flex items-center gap-2 bg-gray-800/50 rounded p-2">
                  <span className={`w-2 h-2 rounded-full ${getSeverityColor(obs.severity)}`}></span>
                  <span className="text-sm text-white flex-1 truncate">
                    {obs.obstacle_type.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getSeverityColor(obs.severity)} text-white`}>
                    {obs.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Log */}
        <div className="p-4">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase mb-2"
          >
            <span>Event Log ({events.length})</span>
            <ChevronDownIcon />
          </button>
          <div className={`space-y-1 ${isExpanded ? 'max-h-64' : 'max-h-24'} overflow-y-auto transition-all`}>
            {events.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No events yet. Start a simulation!</p>
            ) : (
              events.map((event, idx) => (
                <div key={event.id || idx} className="flex items-start gap-2 text-xs p-1.5 bg-gray-800/30 rounded">
                  <span className="text-gray-400 mt-0.5">{getEventTypeIcon(event.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-300 truncate">{event.type.replace(/_/g, ' ')}</div>
                    <div className="text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
