'use client';

import AssetList from '@/components/AssetList';
import MapWrapper from '@/components/MapWrapper';
import { useState, useEffect } from 'react';

// Mock Data removed. Now fetching from API.
const API_URL = 'http://localhost:8000/api/v1/assets/';

export default function Home() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await fetch(API_URL);
        if (res.ok) {
          const data = await res.json();
          setAssets(data);
        } else {
          console.error("Failed to fetch assets");
        }
      } catch (error) {
        console.error("Error fetching assets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
    // Poll every 5 seconds for updates (simple real-time simulation)
    const interval = setInterval(fetchAssets, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex h-screen w-screen bg-gray-100 overflow-hidden text-black">
      {/* Sidebar - Asset List */}
      <div className="w-80 h-full shadow-xl z-20">
        <AssetList assets={assets} />
      </div>

      {/* Main Content - Map */}
      <div className="flex-1 h-full relative z-10">
        <div className="absolute top-4 right-4 z-[400] bg-white p-2 rounded-lg shadow-md">
          <h1 className="font-bold text-lg px-2">Transport & Road Space Mgmt</h1>
          <div className="text-xs text-gray-500 px-2">Decision Support System</div>
        </div>
        <MapWrapper assets={assets} />
      </div>
    </main>
  );
}
