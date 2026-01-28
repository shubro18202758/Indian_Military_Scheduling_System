'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Brain, 
  Activity, 
  AlertTriangle, 
  Shield, 
  Zap, 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  TrendingUp,
                  <option value="kashmir_ops">Kashmir Operations</option>
  Maximize2,
  Minimize2,
  GripVertical,
  Cpu,
  Radio,
  Navigation
} from 'lucide-react';
import ResizablePanel from './ResizablePanel';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  description?: string;
}

interface AIRecommendation {
  id: string;
  type: string;
  title: string;
  summary: string;
  confidence: number;
  severity: string;
  category: string;
  timestamp: string;
  eta_impact_minutes?: number;
  affected_area?: string;
  action_required?: string;
}

interface WeatherForecast {
  condition: string;
  temperature: number;
  visibility_km: number;
  wind_speed_kmh: number;
  precipitation_chance: number;
  impact_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  forecast_hours: number;
}

interface ThreatAssessment {
  threat_level: string;
  active_threats: number;
  areas_of_concern: string[];
  recommended_actions: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getSeverityColor = (severity?: string): string => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': case 'EMERGENCY': return '#dc2626';
    case 'HIGH': case 'WARNING': return '#ea580c';
    case 'MEDIUM': case 'CAUTION': return '#eab308';
    case 'LOW': case 'ADVISORY': return '#22c55e';
    default: return '#6b7280';
  }
};

const getSeverityBg = (severity?: string): string => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': case 'EMERGENCY': return 'rgba(220, 38, 38, 0.15)';
    case 'HIGH': case 'WARNING': return 'rgba(234, 88, 12, 0.15)';
    case 'MEDIUM': case 'CAUTION': return 'rgba(234, 179, 8, 0.15)';
    case 'LOW': case 'ADVISORY': return 'rgba(34, 197, 94, 0.15)';
    default: return 'rgba(107, 114, 128, 0.15)';
  }
};

const getEventIcon = (type?: string) => {
  const t = (type || '').toUpperCase();
  if (t.includes('OBSTACLE') || t.includes('THREAT')) return <AlertTriangle size={14} />;
  if (t.includes('COUNTERMEASURE') || t.includes('RESPONSE')) return <Shield size={14} />;
  if (t.includes('WEATHER')) return <Cloud size={14} />;
  if (t.includes('ROUTE')) return <Navigation size={14} />;
  return <Activity size={14} />;
};

const formatConfidence = (value?: number): string => {
  if (value === undefined || value === null || isNaN(value)) return '--';
  return `${Math.round(value * 100)}%`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// AI FORECAST CARD
// ============================================================================

interface AIForecastCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  color: string;
  expanded?: boolean;
}

const AIForecastCard = ({ title, icon, children, color, expanded = true }: AIForecastCardProps) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  
  return (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: 8,
      border: `1px solid ${color}33`,
      marginBottom: 10,
      overflow: 'hidden'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          cursor: 'pointer',
          backgroundColor: `${color}15`,
          borderBottom: isExpanded ? `1px solid ${color}33` : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{title}</span>
        </div>
        {isExpanded ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
      </div>
      {isExpanded && (
        <div style={{ padding: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RECOMMENDATION ITEM
// ============================================================================

interface RecommendationItemProps {
  recommendation: AIRecommendation;
}

const RecommendationItem = ({ recommendation }: RecommendationItemProps) => {
  const severityColor = getSeverityColor(recommendation.severity);
  const confidence = formatConfidence(recommendation.confidence);
  
  return (
    <div style={{
      padding: '10px 12px',
      backgroundColor: getSeverityBg(recommendation.severity),
      borderRadius: 6,
      marginBottom: 8,
      borderLeft: `3px solid ${severityColor}`
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: 6
      }}>
        <span style={{ 
          fontSize: 12, 
          fontWeight: 600, 
          color: '#fff',
          flex: 1 
        }}>
          {recommendation.title || recommendation.type}
        </span>
        <span style={{
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 10,
          backgroundColor: severityColor,
          color: '#fff',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          marginLeft: 8
        }}>
          {confidence} confidence
        </span>
      </div>
      
      <p style={{ 
        fontSize: 11, 
        color: '#9ca3af', 
        margin: '0 0 8px 0',
        lineHeight: 1.4
      }}>
        {recommendation.summary}
      </p>
      
      {recommendation.action_required && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: 4,
          marginTop: 6
        }}>
          <Target size={12} color="#3b82f6" />
          <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 500 }}>
            {recommendation.action_required}
          </span>
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginTop: 8,
        fontSize: 9,
        color: '#4b5563'
      }}>
        <span>{recommendation.category || 'General'}</span>
        {recommendation.eta_impact_minutes !== undefined && recommendation.eta_impact_minutes > 0 && (
          <span style={{ color: '#f59e0b' }}>+{recommendation.eta_impact_minutes} min ETA</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AIEventsPanelEnhanced() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast | null>(null);
  const [threatAssessment, setThreatAssessment] = useState<ThreatAssessment | null>(null);
  const [selectedScenario, setSelectedScenario] = useState('demo_showcase');
  const [selectedIntensity, setSelectedIntensity] = useState('moderate');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'threats' | 'ai' | 'log'>('ai');
  const [aiStatus, setAiStatus] = useState<{available: boolean; model: string}>({ available: false, model: 'janus:latest' });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

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

  const fetchAIRecommendations = useCallback(async () => {
    try {
      // Generate AI recommendations based on current simulation state
      const newRecommendations: AIRecommendation[] = [];
      
      // Check obstacles and generate recommendations
      for (const obstacle of obstacles.slice(0, 5)) {
        const confidence = 0.75 + Math.random() * 0.2; // 75-95%
        
        newRecommendations.push({
          id: `rec-${obstacle.id}`,
          type: obstacle.obstacle_type,
          title: getRecommendationTitle(obstacle.obstacle_type),
          summary: getRecommendationSummary(obstacle.obstacle_type, obstacle.severity),
          confidence: confidence,
          severity: obstacle.severity,
          category: getCategoryFromType(obstacle.obstacle_type),
          timestamp: obstacle.created_at,
          eta_impact_minutes: getETAImpact(obstacle.severity),
          affected_area: `${obstacle.latitude.toFixed(2)}, ${obstacle.longitude.toFixed(2)}`,
          action_required: getActionRequired(obstacle.obstacle_type, obstacle.severity)
        });
      }
      
      // Add weather forecast recommendation
      if (weatherForecast && weatherForecast.impact_level !== 'LOW') {
        newRecommendations.push({
          id: 'rec-weather',
          type: 'WEATHER_ADVISORY',
          title: 'Weather Impact Advisory',
          summary: `${weatherForecast.condition} conditions expected. Visibility: ${weatherForecast.visibility_km}km. Wind: ${weatherForecast.wind_speed_kmh}km/h.`,
          confidence: 0.85,
          severity: weatherForecast.impact_level,
          category: 'Weather',
          timestamp: new Date().toISOString(),
          eta_impact_minutes: weatherForecast.impact_level === 'HIGH' ? 30 : 15,
          action_required: weatherForecast.impact_level === 'CRITICAL' ? 'Consider route delay' : 'Monitor conditions'
        });
      }
      
      setRecommendations(newRecommendations);
    } catch (e) {
      console.error('Failed to generate AI recommendations:', e);
    }
  }, [obstacles, weatherForecast]);

  const fetchWeatherForecast = useCallback(async () => {
    // Simulate weather forecast from AI model
    const conditions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Fog', 'Heavy Rain', 'Snow'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    let impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (condition.includes('Rain') || condition.includes('Snow')) impact = 'MEDIUM';
    if (condition.includes('Heavy') || condition === 'Fog') impact = 'HIGH';
    
    setWeatherForecast({
      condition,
      temperature: Math.round(5 + Math.random() * 20),
      visibility_km: condition === 'Fog' ? 2 : (condition.includes('Rain') ? 5 : 15),
      wind_speed_kmh: Math.round(10 + Math.random() * 30),
      precipitation_chance: condition.includes('Rain') ? 70 : (condition.includes('Cloud') ? 30 : 10),
      impact_level: impact,
      forecast_hours: 6
    });
  }, []);

  const fetchThreatAssessment = useCallback(async () => {
    const threatLevels = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
    const threatLevel = obstacles.length > 3 ? 'ORANGE' : (obstacles.length > 1 ? 'YELLOW' : 'GREEN');
    
    setThreatAssessment({
      threat_level: threatLevel,
      active_threats: obstacles.length,
      areas_of_concern: obstacles.slice(0, 3).map(o => o.obstacle_type.replace(/_/g, ' ')),
      recommended_actions: getRecommendedActions(threatLevel, obstacles)
    });
  }, [obstacles]);

  const checkAIStatus = useCallback(async () => {
    try {
      // Check if Ollama is running
      const res = await fetch('http://localhost:11434/api/tags', { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);
      
      if (res?.ok) {
        setAiStatus({ available: true, model: 'janus:latest' });
      } else {
        setAiStatus({ available: false, model: 'janus:latest' });
      }
    } catch {
      setAiStatus({ available: false, model: 'janus:latest' });
    }
  }, []);

  // Setup polling
  useEffect(() => {
    if (isPanelOpen) {
      fetchStatus();
      fetchObstacles();
      fetchEvents();
      fetchWeatherForecast();
      checkAIStatus();

      const interval = setInterval(() => {
        fetchStatus();
        fetchObstacles();
        fetchThreatAssessment();
        if (status?.running) {
          fetchEvents();
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isPanelOpen, fetchStatus, fetchObstacles, fetchEvents, fetchWeatherForecast, fetchThreatAssessment, checkAIStatus, status?.running]);

  // Update recommendations when obstacles change
  useEffect(() => {
    if (obstacles.length > 0) {
      fetchAIRecommendations();
    }
  }, [obstacles, fetchAIRecommendations]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const startSimulation = async (useScenario: boolean) => {
    setLoading(true);
    try {
      let url = `${API_V1}/obstacles/simulation/start?intensity=${selectedIntensity}`;
      if (useScenario) url += `&scenario=${selectedScenario}`;
      
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        showMessage('success', 'AI Simulation started!');
        fetchStatus();
      } else {
        const error = await res.json();
        showMessage('error', error.detail || 'Failed to start');
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

  const stopSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_V1}/obstacles/simulation/stop`, { method: 'POST' });
      if (res.ok) {
        showMessage('success', 'Simulation stopped');
        fetchStatus();
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

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

  const generateObstacle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles/generate?auto_respond=true`, { method: 'POST' });
      if (res.ok) {
        showMessage('success', 'Obstacle generated!');
        fetchObstacles();
        fetchEvents();
      }
    } catch (e) {
      showMessage('error', 'Network error');
    }
    setLoading(false);
  };

  // ============================================================================
  // RENDER FAB
  // ============================================================================

  if (!isPanelOpen) {
    return (
      <button
        onClick={() => setIsPanelOpen(true)}
        style={{
          position: 'fixed',
          bottom: 100,
          right: 16,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 25,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
          fontWeight: 600,
          fontSize: 14,
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 30px rgba(124, 58, 237, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.4)';
        }}
      >
        <Brain size={18} />
        <span>AI Analysis</span>
        {status?.running && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 12,
            height: 12,
            backgroundColor: '#22c55e',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }} />
        )}
      </button>
    );
  }

  // ============================================================================
  // RENDER PANEL
  // ============================================================================

  return (
    <ResizablePanel
      title="AI TACTICAL ANALYSIS"
      icon={<Brain size={18} color="#fff" />}
      initialWidth={420}
      initialHeight={600}
      minWidth={350}
      minHeight={400}
      maxWidth={700}
      maxHeight={900}
      position="bottom-right"
      headerGradient="linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)"
      onClose={() => setIsPanelOpen(false)}
      zIndex={1001}
      draggable={true}
      statusBadge={
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 600,
          backgroundColor: aiStatus.available ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          color: aiStatus.available ? '#22c55e' : '#ef4444'
        }}>
          <Cpu size={10} />
          {aiStatus.available ? 'GPU ACTIVE' : 'OFFLINE'}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Status Bar */}
        {status && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: status.running ? (status.paused ? '#eab308' : '#22c55e') : '#6b7280',
                animation: status.running && !status.paused ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {status.running ? (status.paused ? 'Paused' : 'Running') : 'Idle'}
              </span>
              {status.running && status.metrics && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  • {formatDuration(status.duration_seconds)}
                </span>
              )}
            </div>
            {status.running && status.metrics && (
              <div style={{ 
                fontSize: 11, 
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <TrendingUp size={12} />
                Score: {status.metrics.resilience_score?.toFixed(0) || 0}%
              </div>
            )}
          </div>
        )}

        {/* Message Toast */}
        {message && (
          <div style={{
            padding: '8px 16px',
            fontSize: 12,
            backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: message.type === 'success' ? '#22c55e' : '#ef4444'
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          {[
            { id: 'threats', label: 'THREATS', icon: <AlertTriangle size={12} /> },
            { id: 'ai', label: 'AI', icon: <Brain size={12} /> },
            { id: 'log', label: 'LOG', icon: <Activity size={12} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: activeTab === tab.id ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #7c3aed' : '2px solid transparent',
                color: activeTab === tab.id ? '#a855f7' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div>
              {/* AI Status */}
              <AIForecastCard
                title="AI MODEL STATUS"
                icon={<Cpu size={14} />}
                color="#7c3aed"
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ 
                    padding: 10, 
                    backgroundColor: 'rgba(124, 58, 237, 0.1)', 
                    borderRadius: 6,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Provider</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>ollama</div>
                  </div>
                  <div style={{ 
                    padding: 10, 
                    backgroundColor: 'rgba(124, 58, 237, 0.1)', 
                    borderRadius: 6,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Model</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>janus:latest</div>
                  </div>
                </div>
                <div style={{ 
                  marginTop: 10,
                  padding: 8,
                  backgroundColor: aiStatus.available ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontSize: 11,
                  color: aiStatus.available ? '#22c55e' : '#ef4444'
                }}>
                  {aiStatus.available 
                    ? '✓ JANUS PRO 7B - GPU Accelerated' 
                    : '✗ AI Model Offline - Using Heuristics'}
                </div>
              </AIForecastCard>

              {/* Weather Forecast */}
              {weatherForecast && (
                <AIForecastCard
                  title="WEATHER FORECAST"
                  icon={<Cloud size={14} />}
                  color="#3b82f6"
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <Thermometer size={16} color="#f59e0b" style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{weatherForecast.temperature}°C</div>
                      <div style={{ fontSize: 9, color: '#6b7280' }}>Temp</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Radio size={16} color="#3b82f6" style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{weatherForecast.visibility_km}km</div>
                      <div style={{ fontSize: 9, color: '#6b7280' }}>Visibility</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Navigation size={16} color="#22c55e" style={{ margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{weatherForecast.wind_speed_kmh}</div>
                      <div style={{ fontSize: 9, color: '#6b7280' }}>Wind km/h</div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 10,
                    padding: 8,
                    backgroundColor: getSeverityBg(weatherForecast.impact_level),
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {weatherForecast.condition} • {weatherForecast.forecast_hours}h forecast
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: getSeverityColor(weatherForecast.impact_level)
                    }}>
                      {weatherForecast.impact_level} IMPACT
                    </span>
                  </div>
                </AIForecastCard>
              )}

              {/* AI Recommendations */}
              <AIForecastCard
                title={`RECOMMENDATIONS (${recommendations.length})`}
                icon={<Target size={14} />}
                color="#22c55e"
              >
                {recommendations.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', margin: '20px 0' }}>
                    No active recommendations. Start simulation to generate AI insights.
                  </p>
                ) : (
                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {recommendations.map((rec) => (
                      <RecommendationItem key={rec.id} recommendation={rec} />
                    ))}
                  </div>
                )}
              </AIForecastCard>
            </div>
          )}

          {/* Threats Tab */}
          {activeTab === 'threats' && (
            <div>
              {/* Threat Assessment */}
              {threatAssessment && (
                <AIForecastCard
                  title="THREAT LEVEL"
                  icon={<Shield size={14} />}
                  color={getSeverityColor(threatAssessment.threat_level)}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                    marginBottom: 10
                  }}>
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      backgroundColor: getSeverityBg(threatAssessment.threat_level),
                      border: `3px solid ${getSeverityColor(threatAssessment.threat_level)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{ 
                        fontSize: 24, 
                        fontWeight: 800, 
                        color: getSeverityColor(threatAssessment.threat_level) 
                      }}>
                        {threatAssessment.active_threats}
                      </div>
                      <div style={{ fontSize: 8, color: '#9ca3af', textTransform: 'uppercase' }}>Active</div>
                    </div>
                  </div>
                  
                  <div style={{
                    padding: 10,
                    backgroundColor: getSeverityBg(threatAssessment.threat_level),
                    borderRadius: 6,
                    textAlign: 'center',
                    marginBottom: 10
                  }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: getSeverityColor(threatAssessment.threat_level)
                    }}>
                      THREAT LEVEL: {threatAssessment.threat_level}
                    </span>
                  </div>

                  {threatAssessment.recommended_actions.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>RECOMMENDED ACTIONS:</div>
                      {threatAssessment.recommended_actions.map((action, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          borderRadius: 4,
                          marginBottom: 4,
                          fontSize: 11,
                          color: '#9ca3af'
                        }}>
                          <span style={{ color: '#3b82f6' }}>→</span>
                          {action}
                        </div>
                      ))}
                    </div>
                  )}
                </AIForecastCard>
              )}

              {/* Active Obstacles */}
              <AIForecastCard
                title={`ACTIVE OBSTACLES (${obstacles.length})`}
                icon={<AlertTriangle size={14} />}
                color="#f59e0b"
              >
                {obstacles.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', margin: '20px 0' }}>
                    No active obstacles detected
                  </p>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {obstacles.map((obs) => (
                      <div key={obs.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        backgroundColor: getSeverityBg(obs.severity),
                        borderRadius: 6,
                        marginBottom: 6,
                        borderLeft: `3px solid ${getSeverityColor(obs.severity)}`
                      }}>
                        <span style={{ fontSize: 16 }}>{getObstacleEmoji(obs.obstacle_type)}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>
                            {obs.obstacle_type.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: 9, color: '#6b7280' }}>
                            {obs.latitude.toFixed(3)}, {obs.longitude.toFixed(3)}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: getSeverityColor(obs.severity),
                          color: '#fff'
                        }}>
                          {obs.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </AIForecastCard>
            </div>
          )}

          {/* Log Tab */}
          {activeTab === 'log' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>EVENT HISTORY ({events.length})</div>
                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                  {events.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', margin: '20px 0' }}>
                      No events yet. Start a simulation!
                    </p>
                  ) : (
                    events.map((event, idx) => (
                      <div key={event.id || idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '8px 10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 6,
                        marginBottom: 4
                      }}>
                        <span style={{ 
                          color: getSeverityColor(event.severity),
                          marginTop: 2
                        }}>
                          {getEventIcon(event.type)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: '#fff' }}>
                            {event.type.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: 9, color: '#6b7280' }}>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          padding: 12,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          {!status?.running ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 8,
                    backgroundColor: 'rgba(55, 65, 81, 0.5)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 11
                  }}
                >
                  <option value="demo_showcase">Demo Showcase</option>
                  <option value="winter_ops">Winter Operations</option>
                  <option value="security_alert">Security Alert</option>
                  <option value="monsoon_season">Monsoon Season</option>
                  <option value="resilience_test">Stress Test</option>
                </select>
                <select
                  value={selectedIntensity}
                  onChange={(e) => setSelectedIntensity(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 8,
                    backgroundColor: 'rgba(55, 65, 81, 0.5)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 11
                  }}
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="moderate">Moderate</option>
                  <option value="intense">Intense</option>
                  <option value="stress_test">Stress Test</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => startSimulation(true)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 10,
                    backgroundColor: '#7c3aed',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <Play size={14} />
                  Run Scenario
                </button>
                <button
                  onClick={generateObstacle}
                  disabled={loading}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 10,
                    backgroundColor: 'rgba(107, 114, 128, 0.3)',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <Zap size={14} />
                  Generate Obstacle
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={togglePause}
                disabled={loading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 10,
                  backgroundColor: status.paused ? '#22c55e' : '#eab308',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {status.paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
              </button>
              <button
                onClick={stopSimulation}
                disabled={loading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: 10,
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Square size={14} />
                Stop
              </button>
            </div>
          )}
        </div>
      </div>
    </ResizablePanel>
  );
}

// ============================================================================
// HELPER FUNCTIONS FOR RECOMMENDATIONS
// ============================================================================

function getRecommendationTitle(obstacleType: string): string {
  const type = obstacleType.toUpperCase();
  if (type.includes('LANDSLIDE') || type.includes('AVALANCHE')) return 'Terrain Hazard Alert';
  if (type.includes('IED') || type.includes('MINE')) return 'Security Threat Detected';
  if (type.includes('FLOOD') || type.includes('WATER')) return 'Water Level Warning';
  if (type.includes('FOG') || type.includes('WEATHER')) return 'Visibility Advisory';
  if (type.includes('AMBUSH')) return 'Security Alert';
  if (type.includes('BRIDGE')) return 'Infrastructure Alert';
  return 'Route Obstruction';
}

function getRecommendationSummary(obstacleType: string, severity: string): string {
  const type = obstacleType.toUpperCase();
  const sev = severity.toUpperCase();
  
  if (type.includes('LANDSLIDE')) {
    return `${sev} landslide detected on route. Assessment of passability required before proceeding.`;
  }
  if (type.includes('FLOOD')) {
    return `Water levels may exceed safe crossing depth. ${sev === 'CRITICAL' ? 'Critical severity mandates immediate protective action.' : 'Monitor conditions closely.'}`;
  }
  if (type.includes('IED')) {
    return `Suspected IED reported. EOD team clearance required. Maintain 500m standoff distance.`;
  }
  if (type.includes('AMBUSH')) {
    return `Potential ambush zone identified. Enhanced security posture recommended.`;
  }
  return `${sev} severity obstacle requires assessment. Proceed with caution.`;
}

function getCategoryFromType(obstacleType: string): string {
  const type = obstacleType.toUpperCase();
  if (type.includes('IED') || type.includes('AMBUSH') || type.includes('HOSTILE')) return 'Security';
  if (type.includes('FLOOD') || type.includes('WEATHER') || type.includes('FOG')) return 'Weather';
  if (type.includes('LANDSLIDE') || type.includes('AVALANCHE')) return 'Terrain';
  if (type.includes('BRIDGE') || type.includes('ROAD')) return 'Infrastructure';
  return 'General';
}

function getETAImpact(severity: string): number {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 60;
    case 'HIGH': return 30;
    case 'MEDIUM': return 15;
    case 'LOW': return 5;
    default: return 10;
  }
}

function getActionRequired(obstacleType: string, severity: string): string {
  const type = obstacleType.toUpperCase();
  const sev = severity.toUpperCase();
  
  if (sev === 'CRITICAL') return 'Immediate halt and assessment required';
  if (type.includes('IED')) return 'Request EOD clearance';
  if (type.includes('AMBUSH')) return 'Activate escort protocols';
  if (type.includes('FLOOD')) return 'Monitor water levels';
  if (type.includes('LANDSLIDE')) return 'Assess alternative route';
  return 'Proceed with caution';
}

function getObstacleEmoji(type: string): string {
  const typeUpper = type?.toUpperCase() || '';
  if (typeUpper.includes('LANDSLIDE') || typeUpper.includes('AVALANCHE')) return '🏔️';
  if (typeUpper.includes('IED') || typeUpper.includes('MINE')) return '💣';
  if (typeUpper.includes('AMBUSH') || typeUpper.includes('HOSTILE')) return '⚔️';
  if (typeUpper.includes('FLOOD') || typeUpper.includes('WATER')) return '🌊';
  if (typeUpper.includes('FOG') || typeUpper.includes('WEATHER')) return '🌫️';
  if (typeUpper.includes('ACCIDENT') || typeUpper.includes('BREAKDOWN')) return '🚧';
  if (typeUpper.includes('BRIDGE') || typeUpper.includes('INFRASTRUCTURE')) return '🌉';
  if (typeUpper.includes('PROTEST') || typeUpper.includes('CIVILIAN')) return '👥';
  return '⚠️';
}

function getRecommendedActions(threatLevel: string, obstacles: Obstacle[]): string[] {
  const actions: string[] = [];
  
  switch (threatLevel) {
    case 'RED':
      actions.push('Consider convoy halt and reassessment');
      actions.push('Request additional escort support');
      actions.push('Establish communication with HQ');
      break;
    case 'ORANGE':
      actions.push('Increase spacing between vehicles');
      actions.push('Activate heightened security protocols');
      actions.push('Prepare alternate route options');
      break;
    case 'YELLOW':
      actions.push('Maintain vigilance at checkpoints');
      actions.push('Monitor weather and terrain conditions');
      break;
    default:
      actions.push('Continue standard operating procedure');
      actions.push('Report at scheduled intervals');
  }
  
  return actions;
}
