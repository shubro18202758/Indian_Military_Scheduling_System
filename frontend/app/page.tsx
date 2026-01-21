'use client';

import AssetList from '@/components/AssetList';
import ConvoyList from '@/components/ConvoyList';
import MapWrapper from '@/components/MapWrapper';
import { useState, useEffect } from 'react';
import { Layers, Map as MapIcon, WifiOff } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'assets' | 'convoys'>('assets');

  const [assets, setAssets] = useState<any[]>([]);
  const [convoys, setConvoys] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch Assets
      const assetRes = await fetch(`${API_BASE}/assets/`);
      if (assetRes.ok) {
        setAssets(await assetRes.json());
        setError(false);
      } else {
        setError(true);
      }

      // Fetch Convoys
      const convoyRes = await fetch(`${API_BASE}/convoys/`);
      if (convoyRes.ok) setConvoys(await convoyRes.json());

      // Fetch Routes
      const routeRes = await fetch(`${API_BASE}/routes/`);
      if (routeRes.ok) setRoutes(await routeRes.json());

    } catch (error) {
      console.error("Error fetching data:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Faster polling for live feeling
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex h-screen w-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
      {/* Sidebar Area */}
      <div className="w-80 h-full shadow-2xl z-20 flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 bg-slate-900">
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'assets' ? 'border-blue-500 text-blue-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
          >
            <Layers className="h-4 w-4" />
            Assets
          </button>
          <button
            onClick={() => setActiveTab('convoys')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'convoys' ? 'border-purple-500 text-purple-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
          >
            <MapIcon className="h-4 w-4" />
            Convoys
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-hidden bg-slate-900 relative">
          {error && (
            <div className="absolute top-0 left-0 w-full bg-red-500/10 border-b border-red-500/20 p-2 text-[10px] text-red-400 flex items-center justify-center gap-2">
              <WifiOff className="h-3 w-3" />
              Backend Disconnected
            </div>
          )}

          {activeTab === 'assets' ? (
            <AssetList assets={assets} />
          ) : (
            <ConvoyList convoys={convoys} />
          )}
        </div>
      </div>

      {/* Main Content - Map */}
      <div className="flex-1 h-full relative z-10">
        <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-xl shadow-2xl">
          <h1 className="font-bold text-lg px-2 text-white tracking-tight">AI Transport Ops</h1>
          <div className="text-xs text-blue-400 px-2 font-mono uppercase">System Online</div>
        </div>
        <MapWrapper assets={assets} routes={routes} />
      </div>
    </main>
  );
}
