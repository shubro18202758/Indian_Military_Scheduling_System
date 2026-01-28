'use client';

/**
 * AI Convoy Scheduling Page
 * =========================
 * 
 * Dedicated page for the AI-powered convoy scheduling command center.
 * Provides commanders with real-time dispatch recommendations.
 */

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with the component
const SchedulingCommandCenter = dynamic(
  () => import('../../components/SchedulingCommandCenter'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 50%, #0d1520 100%)',
        color: '#22c55e',
        fontFamily: 'Rajdhani, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 2s infinite' }}>🎖️</div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>Loading AI Scheduling Command...</div>
          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
            Initializing RAG Pipeline | Connecting to Janus Pro 7B
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
        `}</style>
      </div>
    )
  }
);

export default function SchedulingPage() {
  return <SchedulingCommandCenter />;
}
