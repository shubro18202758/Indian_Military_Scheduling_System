'use client';

import { Map as MapIcon, Calendar, ArrowRight, Clock, MapPin } from 'lucide-react';

interface Convoy {
    id: number;
    name: string;
    start_location: string;
    end_location: string;
    status: string;
    start_time: string;
}

interface ConvoyListProps {
    convoys: Convoy[];
}

const ConvoyList = ({ convoys }: ConvoyListProps) => {
    return (
        <div className="w-full h-full bg-slate-950 border-r border-slate-800 flex flex-col text-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-purple-600 rounded-lg">
                        <MapIcon className="h-5 w-5 text-white" />
                    </div>
                    Convoy Operations
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                    {convoys.length} missions scheduled
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {convoys.map((convoy) => (
                    <div
                        key={convoy.id}
                        className="group p-4 rounded-2xl bg-slate-900 border border-slate-800/50 hover:bg-slate-800 hover:shadow-xl transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-base text-white">{convoy.name}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium
                    ${convoy.status === 'IN_TRANSIT'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}
                `}>
                                {convoy.status === 'IN_TRANSIT' ? 'In Transit' : 'Planned'}
                            </span>
                        </div>

                        {/* Route */}
                        <div className="flex items-center gap-3 mb-4 bg-slate-950 p-2.5 rounded-lg border border-slate-800/50">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                <span className="text-sm font-medium text-slate-300 truncate">{convoy.start_location}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                <span className="text-sm font-medium text-slate-300 truncate">{convoy.end_location}</span>
                            </div>
                        </div>

                        {/* Time Info */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{new Date(convoy.start_time).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{new Date(convoy.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ConvoyList;
