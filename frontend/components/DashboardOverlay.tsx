"use client";

import React, { useState } from 'react';
import { Plus, Truck, MapPin, X, Save, Navigation } from 'lucide-react';

export default function DashboardOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeModal, setActiveModal] = useState<'none' | 'asset' | 'convoy' | 'route'>('none');

    // Asset Form State
    const [assetForm, setAssetForm] = useState({
        name: '',
        asset_type: 'Truck 4x4',
        capacity_tons: 2.5,
        lat: 32.7,
        long: 74.8
    });

    // Convoy Form State
    const [convoyForm, setConvoyForm] = useState({
        name: '',
        start_location: 'Jammu',
        end_location: 'Srinagar'
    });

    // Route Form State
    const [routeForm, setRouteForm] = useState({
        name: '',
        start_lat: 32.6896,
        start_long: 74.8376,
        end_lat: 33.9872,
        end_long: 74.7736
    });

    const handleCreateAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:8000/api/v1/assets/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: assetForm.name,
                    asset_type: assetForm.asset_type,
                    capacity_tons: assetForm.capacity_tons,
                    current_lat: assetForm.lat,
                    current_long: assetForm.long,
                    is_available: true
                })
            });
            if (res.ok) {
                alert('Asset Created!');
                setActiveModal('none');
                window.location.reload();
            } else {
                alert('Failed to create asset');
            }
        } catch (err) {
            console.error(err);
            alert('Error creating asset');
        }
    };

    const handleCreateConvoy = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:8000/api/v1/convoys/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(convoyForm)
            });
            if (res.ok) {
                alert('Convoy Plan Created!');
                setActiveModal('none');
                window.location.reload();
            } else {
                alert('Failed to create convoy');
            }
        } catch (err) {
            console.error(err);
            alert('Error creating convoy');
        }
    };

    const handleCreateRoute = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:8000/api/v1/routes/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeForm)
            });
            if (res.ok) {
                alert('Route Planned with OSRM High-Fidelity!');
                setActiveModal('none');
                window.location.reload();
            } else {
                alert('Failed to plan route');
            }
        } catch (err) {
            console.error(err);
            alert('Error planning route');
        }
    };

    return (
        <>
            {/* FAB (Floating Action Button) */}
            <div style={{
                position: 'fixed',
                top: '80px',
                right: '30px',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'end',
                gap: '10px'
            }}>
                {isOpen && (
                    <>
                        <button
                            onClick={() => setActiveModal('route')}
                            style={{
                                backgroundColor: '#1e293b',
                                color: 'white',
                                border: '1px solid #334155',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                                cursor: 'pointer',
                                marginBottom: '5px'
                            }}
                        >
                            <Navigation size={18} color="#ef4444" />
                            <span>Plan Route</span>
                        </button>
                        <button
                            onClick={() => setActiveModal('convoy')}
                            style={{
                                backgroundColor: '#1e293b',
                                color: 'white',
                                border: '1px solid #334155',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                                cursor: 'pointer',
                                marginBottom: '5px'
                            }}
                        >
                            <MapPin size={18} color="#f59e0b" />
                            <span>New Convoy</span>
                        </button>
                        <button
                            onClick={() => setActiveModal('asset')}
                            style={{
                                backgroundColor: '#1e293b',
                                color: 'white',
                                border: '1px solid #334155',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                                cursor: 'pointer',
                                marginBottom: '10px'
                            }}
                        >
                            <Truck size={18} color="#10b981" />
                            <span>New Asset</span>
                        </button>
                    </>
                )}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: '#eab308', // Yellow accent
                        color: 'black',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                    }}
                >
                    {isOpen ? <X size={24} /> : <Plus size={24} />}
                </button>
            </div>

            {/* MODAL OVERLAY */}
            {activeModal !== 'none' && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 3000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        width: '400px',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '12px',
                        padding: '24px',
                        color: 'white',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                                {activeModal === 'asset' ? 'Add New Asset' :
                                    activeModal === 'convoy' ? 'Plan New Convoy' : 'Plan High-Fidelity Route'}
                            </h2>
                            <button onClick={() => setActiveModal('none')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {activeModal === 'asset' ? (
                            <form onSubmit={handleCreateAsset} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Asset Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={assetForm.name}
                                        onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
                                        placeholder="e.g. IXJ-Heavy-04"
                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Type</label>
                                    <select
                                        value={assetForm.asset_type}
                                        onChange={e => setAssetForm({ ...assetForm, asset_type: e.target.value })}
                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                                    >
                                        <option>Truck 4x4</option>
                                        <option>Tatra 8x8</option>
                                        <option>ALS Stallion</option>
                                        <option>Light Vehicle</option>
                                        <option>Fuel Tanker</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Lat</label>
                                        <input type="number" step="0.0001" value={assetForm.lat} onChange={e => setAssetForm({ ...assetForm, lat: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Long</label>
                                        <input type="number" step="0.0001" value={assetForm.long} onChange={e => setAssetForm({ ...assetForm, long: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }} />
                                    </div>
                                </div>

                                <button type="submit" style={{ marginTop: '10px', backgroundColor: '#eab308', color: 'black', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Save size={18} />
                                    Create Asset
                                </button>
                            </form>
                        ) : activeModal === 'convoy' ? (
                            <form onSubmit={handleCreateConvoy} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Convoy ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={convoyForm.name}
                                        onChange={e => setConvoyForm({ ...convoyForm, name: e.target.value })}
                                        placeholder="e.g. CVY-Alpha-02"
                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Start Base</label>
                                    <input
                                        type="text"
                                        required
                                        value={convoyForm.start_location}
                                        onChange={e => setConvoyForm({ ...convoyForm, start_location: e.target.value })}
                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Destination</label>
                                    <input
                                        type="text"
                                        required
                                        value={convoyForm.end_location}
                                        onChange={e => setConvoyForm({ ...convoyForm, end_location: e.target.value })}
                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>

                                <button type="submit" style={{ marginTop: '10px', backgroundColor: '#eab308', color: 'black', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Save size={18} />
                                    Create Plan
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleCreateRoute} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Route Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={routeForm.name}
                                        onChange={e => setRouteForm({ ...routeForm, name: e.target.value })}
                                        placeholder="e.g. Route-Charlie-Logistics"
                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Start Lat</label>
                                        <input type="number" step="0.0001" value={routeForm.start_lat} onChange={e => setRouteForm({ ...routeForm, start_lat: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Start Long</label>
                                        <input type="number" step="0.0001" value={routeForm.start_long} onChange={e => setRouteForm({ ...routeForm, start_long: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>End Lat</label>
                                        <input type="number" step="0.0001" value={routeForm.end_lat} onChange={e => setRouteForm({ ...routeForm, end_lat: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>End Long</label>
                                        <input type="number" step="0.0001" value={routeForm.end_long} onChange={e => setRouteForm({ ...routeForm, end_long: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white' }} />
                                    </div>
                                </div>

                                <button type="submit" style={{ marginTop: '10px', backgroundColor: '#eab308', color: 'black', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Navigation size={18} />
                                    Plan Route
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
