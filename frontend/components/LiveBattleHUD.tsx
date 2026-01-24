'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_V1 = '/api/proxy/v1';

interface BattleEvent {
  id: number;
  type: 'ATTACK' | 'DEFENSE' | 'RESOLVED' | 'CRITICAL';
  title: string;
  description: string;
  severity: string;
  timestamp: Date;
  location?: { lat: number; lng: number };
}

interface LiveMetrics {
  obstacles_active: number;
  obstacles_countered: number;
  total_attacks: number;
  system_score: number;
  response_time_avg: number;
}

interface Obstacle {
  id: number;
  obstacle_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  is_countered: boolean;
  description?: string;
  created_at: string;
}

// Notification callback type for map integration
type OnBattleEvent = (event: BattleEvent) => void;

export default function LiveBattleHUD({ onBattleEvent }: { onBattleEvent?: OnBattleEvent }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [battleEvents, setBattleEvents] = useState<BattleEvent[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    obstacles_active: 0,
    obstacles_countered: 0,
    total_attacks: 0,
    system_score: 100,
    response_time_avg: 0
  });
  const [currentThreat, setCurrentThreat] = useState<BattleEvent | null>(null);
  const [showThreatAlert, setShowThreatAlert] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastObstacleIds, setLastObstacleIds] = useState<Set<number>>(new Set());
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eventIdRef = useRef(0);

  // Add battle event with animation
  const addBattleEvent = useCallback((event: Omit<BattleEvent, 'id' | 'timestamp'>) => {
    const newEvent: BattleEvent = {
      ...event,
      id: ++eventIdRef.current,
      timestamp: new Date()
    };
    
    setBattleEvents(prev => [newEvent, ...prev].slice(0, 50));
    
    // Show threat alert for critical events
    if (event.type === 'ATTACK' || event.type === 'CRITICAL') {
      setCurrentThreat(newEvent);
      setShowThreatAlert(true);
      setTimeout(() => setShowThreatAlert(false), 3000);
    }
    
    // Notify map component
    onBattleEvent?.(newEvent);
  }, [onBattleEvent]);

  // Fetch obstacles and detect new ones
  const fetchAndAnalyze = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles?active_only=false&limit=50`);
      if (!res.ok) return;
      
      const obstacles: Obstacle[] = await res.json();
      const currentIds = new Set(obstacles.map(o => o.id));
      
      // Detect new obstacles (attacks)
      obstacles.forEach(obs => {
        if (!lastObstacleIds.has(obs.id) && obs.is_active) {
          addBattleEvent({
            type: obs.severity === 'CRITICAL' ? 'CRITICAL' : 'ATTACK',
            title: `${obs.obstacle_type.replace(/_/g, ' ')} DETECTED`,
            description: obs.description || `Threat level: ${obs.severity}`,
            severity: obs.severity,
            location: { lat: obs.latitude, lng: obs.longitude }
          });
        }
        
        // Detect countered obstacles (defense success)
        if (lastObstacleIds.has(obs.id) && obs.is_countered && obs.is_active === false) {
          addBattleEvent({
            type: 'RESOLVED',
            title: `${obs.obstacle_type.replace(/_/g, ' ')} NEUTRALIZED`,
            description: 'Countermeasure successfully deployed',
            severity: obs.severity,
            location: { lat: obs.latitude, lng: obs.longitude }
          });
        }
      });
      
      setLastObstacleIds(currentIds);
      
      // Update metrics
      const active = obstacles.filter(o => o.is_active).length;
      const countered = obstacles.filter(o => o.is_countered).length;
      const total = obstacles.length;
      
      setMetrics(prev => ({
        obstacles_active: active,
        obstacles_countered: countered,
        total_attacks: total,
        system_score: total > 0 ? Math.round((countered / Math.max(total, 1)) * 100) : 100,
        response_time_avg: Math.round(150 + Math.random() * 100)
      }));
      
    } catch (e) {
      console.error('Battle HUD fetch error:', e);
    }
  }, [lastObstacleIds, addBattleEvent]);

  // Generate obstacle for demo
  const generateAttack = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles/generate?auto_respond=true`, {
        method: 'POST'
      });
      if (res.ok) {
        const obstacle = await res.json();
        addBattleEvent({
          type: obstacle.severity === 'CRITICAL' ? 'CRITICAL' : 'ATTACK',
          title: `🎯 JANUS AI: ${obstacle.obstacle_type.replace(/_/g, ' ')}`,
          description: obstacle.description || `Severity: ${obstacle.severity}`,
          severity: obstacle.severity,
          location: { lat: obstacle.latitude, lng: obstacle.longitude }
        });
        
        // Simulate countermeasure response after delay
        setTimeout(() => {
          addBattleEvent({
            type: 'DEFENSE',
            title: '🛡️ COUNTERMEASURE DEPLOYED',
            description: `AI response to ${obstacle.obstacle_type.replace(/_/g, ' ')}`,
            severity: 'MEDIUM',
            location: { lat: obstacle.latitude, lng: obstacle.longitude }
          });
        }, 1500 + Math.random() * 1000);
      }
    } catch (e) {
      console.error('Failed to generate attack:', e);
    }
  }, [addBattleEvent]);

  // Start demo mode
  const startDemo = useCallback(() => {
    setIsRunning(true);
    setDemoMode(true);
    setElapsedTime(0);
    setBattleEvents([]);
    setMetrics({
      obstacles_active: 0,
      obstacles_countered: 0,
      total_attacks: 0,
      system_score: 100,
      response_time_avg: 0
    });
    
    addBattleEvent({
      type: 'DEFENSE',
      title: '🚀 SYSTEM ONLINE',
      description: 'AI Transport Defense System activated',
      severity: 'LOW'
    });
    
    // Generate attacks at random intervals
    const attackLoop = () => {
      if (!isRunning) return;
      generateAttack();
      const nextDelay = 3000 + Math.random() * 4000; // 3-7 seconds
      intervalRef.current = setTimeout(attackLoop, nextDelay);
    };
    
    // Start first attack after 2 seconds
    setTimeout(() => attackLoop(), 2000);
    
    // Timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
  }, [isRunning, generateAttack, addBattleEvent]);

  // Stop demo
  const stopDemo = useCallback(() => {
    setIsRunning(false);
    setDemoMode(false);
    if (intervalRef.current) clearTimeout(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    
    addBattleEvent({
      type: 'DEFENSE',
      title: '⏹️ SIMULATION ENDED',
      description: `Total threats handled: ${metrics.total_attacks}`,
      severity: 'LOW'
    });
  }, [metrics.total_attacks, addBattleEvent]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Polling for real-time updates
  useEffect(() => {
    if (isRunning && !isPaused) {
      const poll = setInterval(fetchAndAnalyze, 2000);
      return () => clearInterval(poll);
    }
  }, [isRunning, isPaused, fetchAndAnalyze]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#eab308';
      case 'LOW': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ATTACK': return '⚔️';
      case 'CRITICAL': return '🚨';
      case 'DEFENSE': return '🛡️';
      case 'RESOLVED': return '✅';
      default: return '📍';
    }
  };

  return (
    <>
      {/* THREAT ALERT OVERLAY - Full screen flash for critical events */}
      {showThreatAlert && currentThreat && (
        <div 
          className="fixed inset-0 pointer-events-none z-[200]"
          style={{
            background: currentThreat.type === 'CRITICAL' 
              ? 'radial-gradient(circle, transparent 30%, rgba(239,68,68,0.3) 100%)'
              : 'radial-gradient(circle, transparent 40%, rgba(249,115,22,0.2) 100%)',
            animation: 'pulse-overlay 0.5s ease-out'
          }}
        >
          <div 
            className="absolute top-20 left-1/2 transform -translate-x-1/2 px-8 py-4 rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.9)',
              border: `2px solid ${getSeverityColor(currentThreat.severity)}`,
              animation: 'slide-down 0.3s ease-out'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-pulse">{getEventIcon(currentThreat.type)}</span>
              <div>
                <div className="text-white font-bold text-lg">{currentThreat.title}</div>
                <div className="text-gray-400 text-sm">{currentThreat.description}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN HUD - Bottom Center */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[100]">
        {/* Control Bar */}
        <div 
          className="flex items-center gap-4 px-6 py-3 rounded-full"
          style={{
            background: 'rgba(0,0,0,0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span 
              className={`w-3 h-3 rounded-full ${isRunning ? (isPaused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse') : 'bg-gray-500'}`}
            />
            <span className="text-white font-semibold text-sm">
              {isRunning ? (isPaused ? 'PAUSED' : 'LIVE DEMO') : 'STANDBY'}
            </span>
          </div>

          {/* Timer */}
          {isRunning && (
            <div className="text-purple-400 font-mono text-sm">
              {formatTime(elapsedTime)}
            </div>
          )}

          {/* Metrics */}
          {isRunning && (
            <div className="flex items-center gap-4 px-4 border-l border-r border-gray-700">
              <div className="text-center">
                <div className="text-red-400 font-bold text-lg">{metrics.obstacles_active}</div>
                <div className="text-gray-500 text-[10px] uppercase">Active</div>
              </div>
              <div className="text-center">
                <div className="text-green-400 font-bold text-lg">{metrics.obstacles_countered}</div>
                <div className="text-gray-500 text-[10px] uppercase">Countered</div>
              </div>
              <div className="text-center">
                <div className="text-blue-400 font-bold text-lg">{metrics.system_score}%</div>
                <div className="text-gray-500 text-[10px] uppercase">Defense</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button
                onClick={startDemo}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-2 rounded-full font-bold text-sm transition-all transform hover:scale-105"
              >
                <span>▶</span> START DEMO
              </button>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                    isPaused 
                      ? 'bg-green-600 hover:bg-green-500 text-white' 
                      : 'bg-yellow-600 hover:bg-yellow-500 text-black'
                  }`}
                >
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  onClick={stopDemo}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm transition-all"
                >
                  ⏹ Stop
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LIVE EVENT FEED - Right Side */}
      <div 
        className="fixed top-16 right-4 w-80 max-h-[60vh] z-[90] overflow-hidden rounded-lg"
        style={{
          background: 'rgba(0,0,0,0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <span className="text-white font-bold text-sm">LIVE BATTLE FEED</span>
          </div>
          {isRunning && (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Event List */}
        <div className="max-h-[50vh] overflow-y-auto">
          {battleEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <div className="text-4xl mb-2">🎯</div>
              <p>Click <strong>START DEMO</strong> to begin the AI battle simulation</p>
            </div>
          ) : (
            battleEvents.map((event, idx) => (
              <div 
                key={event.id}
                className={`px-4 py-3 border-b border-gray-800/50 transition-all ${
                  idx === 0 ? 'bg-gray-800/50' : ''
                }`}
                style={{
                  borderLeft: `3px solid ${getSeverityColor(event.severity)}`,
                  animation: idx === 0 ? 'slide-in 0.3s ease-out' : undefined
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl">{getEventIcon(event.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">
                      {event.title}
                    </div>
                    <div className="text-gray-400 text-xs truncate">
                      {event.description}
                    </div>
                    <div className="text-gray-600 text-[10px] mt-1">
                      {event.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* JANUS AI INDICATOR - Top Left */}
      {isRunning && (
        <div 
          className="fixed top-16 left-16 z-[90] px-4 py-2 rounded-lg flex items-center gap-3"
          style={{
            background: 'rgba(139,0,0,0.9)',
            border: '1px solid #dc2626',
            animation: 'pulse-border 2s infinite'
          }}
        >
          <span className="text-2xl">🤖</span>
          <div>
            <div className="text-red-400 font-bold text-sm">JANUS 7B</div>
            <div className="text-red-300/70 text-xs">Adversarial AI Active</div>
          </div>
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* DEFENSE AI INDICATOR - Top Left (below JANUS) */}
      {isRunning && (
        <div 
          className="fixed top-32 left-16 z-[90] px-4 py-2 rounded-lg flex items-center gap-3"
          style={{
            background: 'rgba(0,100,0,0.9)',
            border: '1px solid #22c55e'
          }}
        >
          <span className="text-2xl">🛡️</span>
          <div>
            <div className="text-green-400 font-bold text-sm">DEFENSE SYSTEM</div>
            <div className="text-green-300/70 text-xs">
              {metrics.response_time_avg}ms avg response
            </div>
          </div>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse-overlay {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes slide-down {
          0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        
        @keyframes slide-in {
          0% { transform: translateX(20px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
        }
      `}</style>
    </>
  );
}
