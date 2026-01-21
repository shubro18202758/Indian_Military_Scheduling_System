'use client';

import { Truck, Fuel, MapPin, Gauge, Activity } from 'lucide-react';

interface Asset {
    id: number;
    name: string;
    asset_type: string;
    is_available: boolean;
    fuel_status: number;
    current_lat?: number;
    current_long?: number;
}

interface AssetListProps {
    assets: Asset[];
}

const AssetList = ({ assets }: AssetListProps) => {
    return (
        <div className="w-full h-full bg-slate-950 border-r border-slate-800 flex flex-col text-slate-200">
            {/* Header - Clean & High Contrast */}
            <div className="p-5 border-b border-slate-800 bg-slate-900">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <Truck className="h-5 w-5 text-white" />
                    </div>
                    Fleet Assets
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                    Managing {assets.length} active units
                </p>
            </div>

            {/* List - Simplified Cards */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {assets.map((asset) => (
                    <div
                        key={asset.id}
                        className="group p-4 rounded-2xl bg-slate-900 border border-slate-800/50 hover:bg-slate-800 hover:shadow-xl transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-semibold text-base text-white">{asset.name}</h3>
                                <p className="text-sm text-slate-400">{asset.asset_type}</p>
                            </div>

                            {/* Status Pill - Clean */}
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5
                 ${asset.is_available
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${asset.is_available ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                {asset.is_available ? 'Ready' : 'In Use'}
                            </span>
                        </div>

                        {/* Info Grid - Readable */}
                        <div className="space-y-3">
                            {/* Fuel Bar */}
                            <div>
                                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                                    <span className="flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5" /> Fuel Level</span>
                                    <span className="font-medium text-slate-300">{asset.fuel_status}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${asset.fuel_status < 30 ? 'bg-red-500' : 'bg-blue-500'}`}
                                        style={{ width: `${asset.fuel_status}%` }}
                                    />
                                </div>
                            </div>

                            {/* Location Line */}
                            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>Coordinates</span>
                                </div>
                                <div className="font-mono text-slate-300">
                                    {asset.current_lat?.toFixed(4)}, {asset.current_long?.toFixed(4)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AssetList;
