'use client';

/**
 * Unified Data Bridge Component
 * =============================
 * 
 * This component serves as a bridge between the UnifiedDataContext
 * and the map/command center components. It:
 * 
 * 1. Displays real-time sync status
 * 2. Shows when data across all components is synchronized
 * 3. Provides quick access to key AI recommendations
 * 4. Links map selection to all other panels
 */

import React, { useEffect, useState } from 'react';
import { useUnifiedData, useMetrics, useAIAnalysis, useConvoys, useThreats } from '../context/UnifiedDataContext';
import { Activity, Zap, Brain, AlertTriangle, CheckCircle, Radio, RefreshCw, Truck, MapPin, Shield } from 'lucide-react';

interface UnifiedDataBridgeProps {
  position?: 'top' | 'bottom';
  onConvoySelect?: (convoyId: number | null) => void;
  onRouteSelect?: (routeId: number | null) => void;
}

export default function UnifiedDataBridge({ 
  position = 'bottom',
  onConvoySelect,
  onRouteSelect 
}: UnifiedDataBridgeProps) {
  const { 
    state, 
    loading, 
    error, 
    lastUpdate,
    refresh,
    selectedConvoyId,
    setSelectedConvoyId,
    selectedRouteId,
    setSelectedRouteId
  } = useUnifiedData();
  
  const metrics = useMetrics();
  const aiAnalysis = useAIAnalysis();
  const convoys = useConvoys();
  const threats = useThreats();
  
  const [showDetails, setShowDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Propagate selection to parent components
  useEffect(() => {
    if (onConvoySelect) {
      onConvoySelect(selectedConvoyId);
    }
  }, [selectedConvoyId, onConvoySelect]);
  
  useEffect(() => {
    if (onRouteSelect) {
      onRouteSelect(selectedRouteId);
    }
  }, [selectedRouteId, onRouteSelect]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
  // Calculate critical recommendations count
  const criticalRecs = aiAnalysis?.recommendations.filter(
    r => r.priority === 'CRITICAL' || r.priority === 'HIGH'
  ).length || 0;
  
  // Calculate sync freshness
  const syncAge = lastUpdate ? Math.round((Date.now() - lastUpdate.getTime()) / 1000) : 0;
  const isFresh = syncAge < 10;
  
  const positionStyles: React.CSSProperties = position === 'top' 
    ? { top: 55, left: '50%', transform: 'translateX(-50%)' }
    : { bottom: 90, left: '50%', transform: 'translateX(-50%)' };

  if (loading && !state) {
    return (
      <div style={{
        position: 'absolute',
        ...positionStyles,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 8,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(10px)'
      }}>
        <RefreshCw size={14} color="#3b82f6" className="animate-spin" />
        <span style={{ color: '#94a3b8', fontSize: 11 }}>Initializing Unified Data Hub...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{
        position: 'absolute',
        ...positionStyles,
        zIndex: 1000,
        background: 'rgba(127, 29, 29, 0.95)',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        borderRadius: 8,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(10px)'
      }}>
        <AlertTriangle size={14} color="#ef4444" />
        <span style={{ color: '#fca5a5', fontSize: 11 }}>Data Sync Error: {error}</span>
        <button
          onClick={handleRefresh}
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 4,
            padding: '2px 8px',
            color: '#ef4444',
            fontSize: 10,
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      ...positionStyles,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      {/* Main Status Bar */}
      <div 
        onClick={() => setShowDetails(!showDetails)}
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: `1px solid ${isFresh ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backdropFilter: 'blur(10px)',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {/* Sync Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isFresh ? '#22c55e' : '#eab308',
            animation: isFresh ? 'pulse 2s infinite' : 'none'
          }} />
          <span style={{ color: isFresh ? '#86efac' : '#fde047', fontSize: 10, fontWeight: 600 }}>
            UNIFIED
          </span>
        </div>
        
        {/* Quick Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Truck size={12} color="#22c55e" />
            <span style={{ color: '#fff', fontSize: 10 }}>{metrics?.convoys.active || 0}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} color="#3b82f6" />
            <span style={{ color: '#fff', fontSize: 10 }}>{metrics?.routes.operational || 0}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} color={threats.length > 0 ? '#ef4444' : '#6b7280'} />
            <span style={{ color: threats.length > 0 ? '#ef4444' : '#fff', fontSize: 10 }}>
              {threats.length}
            </span>
          </div>
          
          {criticalRecs > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4,
              background: 'rgba(239, 68, 68, 0.2)',
              padding: '2px 6px',
              borderRadius: 4
            }}>
              <Brain size={12} color="#ef4444" />
              <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>{criticalRecs}</span>
            </div>
          )}
        </div>
        
        {/* Sync Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 9 }}>
            {syncAge}s ago
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2
            }}
          >
            <RefreshCw 
              size={12} 
              color="#64748b" 
              style={{ 
                animation: isRefreshing ? 'spin 0.5s linear infinite' : 'none',
                transition: 'transform 0.3s'
              }} 
            />
          </button>
        </div>
      </div>
      
      {/* Expanded Details Panel */}
      {showDetails && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 8,
          padding: 12,
          minWidth: 400,
          maxHeight: 300,
          overflow: 'auto',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Section: Active Convoys */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ 
              color: '#94a3b8', 
              fontSize: 10, 
              fontWeight: 600, 
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1
            }}>
              Active Convoys (Click to Select)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {convoys.filter(c => c.status === 'IN_TRANSIT').slice(0, 5).map(convoy => (
                <div
                  key={convoy.id}
                  onClick={() => setSelectedConvoyId(convoy.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    background: selectedConvoyId === convoy.id 
                      ? 'rgba(34, 197, 94, 0.2)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: selectedConvoyId === convoy.id 
                      ? '1px solid rgba(34, 197, 94, 0.5)' 
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Truck size={14} color="#22c55e" />
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{convoy.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>
                      {convoy.tracking?.route_progress_pct?.toFixed(0) || 0}%
                    </span>
                    <span style={{ color: '#64748b', fontSize: 10 }}>
                      {convoy.tracking?.speed_kmh?.toFixed(0) || 0} km/h
                    </span>
                  </div>
                </div>
              ))}
              {convoys.filter(c => c.status === 'IN_TRANSIT').length === 0 && (
                <div style={{ color: '#64748b', fontSize: 10, textAlign: 'center', padding: 8 }}>
                  No active convoys
                </div>
              )}
            </div>
          </div>
          
          {/* Section: AI Recommendations */}
          {aiAnalysis && aiAnalysis.recommendations.length > 0 && (
            <div>
              <div style={{ 
                color: '#94a3b8', 
                fontSize: 10, 
                fontWeight: 600, 
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1
              }}>
                AI Recommendations ({aiAnalysis.recommendations.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {aiAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
                  <div
                    key={rec.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '6px 8px',
                      background: rec.priority === 'CRITICAL' 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : rec.priority === 'HIGH'
                        ? 'rgba(249, 115, 22, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${
                        rec.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' :
                        rec.priority === 'HIGH' ? 'rgba(249, 115, 22, 0.3)' :
                        'rgba(255, 255, 255, 0.1)'
                      }`,
                      borderRadius: 6
                    }}
                  >
                    <Brain 
                      size={14} 
                      color={
                        rec.priority === 'CRITICAL' ? '#ef4444' :
                        rec.priority === 'HIGH' ? '#f97316' :
                        '#22c55e'
                      } 
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: 11, marginBottom: 2 }}>
                        {rec.text}
                      </div>
                      <div style={{ 
                        color: '#64748b', 
                        fontSize: 9,
                        display: 'flex',
                        gap: 8
                      }}>
                        <span>{rec.type}</span>
                        <span>•</span>
                        <span>{rec.target}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Section: System Status */}
          <div style={{ 
            marginTop: 12, 
            paddingTop: 12, 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontSize: 16, fontWeight: 600 }}>
                {metrics?.fleet_utilization_pct?.toFixed(0) || 0}%
              </div>
              <div style={{ color: '#64748b', fontSize: 9 }}>Fleet Util</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#3b82f6', fontSize: 16, fontWeight: 600 }}>
                {metrics?.risk_score?.toFixed(0) || 0}
              </div>
              <div style={{ color: '#64748b', fontSize: 9 }}>Risk Score</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                color: aiAnalysis?.status === 'ACTIVE' ? '#22c55e' : '#eab308', 
                fontSize: 16, 
                fontWeight: 600 
              }}>
                {aiAnalysis?.status || 'N/A'}
              </div>
              <div style={{ color: '#64748b', fontSize: 9 }}>AI Engine</div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
