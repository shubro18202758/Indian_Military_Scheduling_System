'use client';

import { Truck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Asset {
    id: number;
    name: string;
    asset_type: string;
    is_available: boolean;
    fuel_status: number;
}

interface AssetListProps {
    assets: Asset[];
}

const AssetList = ({ assets }: AssetListProps) => {
    return (
        <div className="w-full h-full bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Transport Assets
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                    {assets.length} vehicles in AOR
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {assets.map((asset) => (
                    <div
                        key={asset.id}
                        className="p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-semibold text-gray-700">{asset.name}</h3>
                                <p className="text-sm text-gray-500">{asset.asset_type}</p>
                            </div>
                            <div className="flex items-center">
                                {asset.is_available ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                )}
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-400 flex justify-between items-center">
                            <span>Fuel: {asset.fuel_status}%</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${asset.is_available ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {asset.is_available ? 'Ready' : 'In Transit'}
                            </span>
                        </div>
                    </div>
                ))}

                {assets.length === 0 && (
                    <div className="text-center p-8 text-gray-400 text-sm">
                        No assets found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetList;
