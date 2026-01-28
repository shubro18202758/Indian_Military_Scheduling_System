-- =============================================================================
-- MIGRATION: Add comprehensive telemetry columns to transport_assets
-- =============================================================================
-- This migration adds 50+ new columns for physics-based simulation:
-- - Position and motion tracking
-- - BSFC fuel system calculations
-- - Engine dynamics
-- - 4-corner tire/brake/suspension systems
-- - Electrical systems
-- - Tactical signatures
-- - AI analysis fields
-- =============================================================================

-- === POSITION & MOTION ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS altitude_m FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS gradient_deg FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS acceleration FLOAT DEFAULT 0;

-- === FUEL SYSTEM (BSFC-calculated) ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS fuel_liters FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS fuel_consumption_lph FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS fuel_consumption_kpl FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS range_remaining_km FLOAT DEFAULT 0;

-- === ENGINE DYNAMICS ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS engine_rpm FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS engine_load FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS throttle_position FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS engine_torque FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS engine_power_kw FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS engine_hours FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS current_gear INTEGER DEFAULT 1;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS transmission_temp FLOAT DEFAULT 60;

-- === TIRE SYSTEM (JSON for 4-corner data) ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS tire_pressures JSON DEFAULT '[35, 35, 35, 35]';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS tire_temps JSON DEFAULT '[45, 45, 45, 45]';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS tire_wear JSON DEFAULT '[5, 5, 5, 5]';

-- === BRAKE SYSTEM (JSON for 4-corner data) ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS brake_temps JSON DEFAULT '[100, 100, 100, 100]';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS brake_wear JSON DEFAULT '[10, 10, 10, 10]';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS abs_active BOOLEAN DEFAULT FALSE;

-- === SUSPENSION SYSTEM (JSON for 4-corner data) ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS suspension_travel JSON DEFAULT '[50, 50, 50, 50]';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS load_distribution JSON DEFAULT '[25, 25, 25, 25]';

-- === ELECTRICAL SYSTEM ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS battery_voltage FLOAT DEFAULT 24.0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS battery_soc FLOAT DEFAULT 100;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS alternator_output FLOAT DEFAULT 0;

-- === CARGO ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS cargo_weight_kg FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS cargo_secured BOOLEAN DEFAULT TRUE;

-- === ENVIRONMENT ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS ambient_temp FLOAT DEFAULT 25;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS road_friction FLOAT DEFAULT 0.7;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS visibility_m FLOAT DEFAULT 10000;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS precipitation_mm_hr FLOAT DEFAULT 0;

-- === TACTICAL SIGNATURES ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS thermal_signature VARCHAR(20) DEFAULT 'LOW';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS acoustic_db FLOAT DEFAULT 60;

-- === CREW STATUS ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS driver_fatigue FLOAT DEFAULT 0;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS vibration_level VARCHAR(20) DEFAULT 'LOW';

-- === AI ANALYSIS ===
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS threat_level VARCHAR(20) DEFAULT 'BRAVO';
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;
ALTER TABLE transport_assets ADD COLUMN IF NOT EXISTS breakdown_probability FLOAT DEFAULT 0.02;

-- =============================================================================
-- Create telemetry history table for time-series data
-- =============================================================================
CREATE TABLE IF NOT EXISTS vehicle_telemetry_history (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES transport_assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Position
    latitude FLOAT,
    longitude FLOAT,
    altitude_m FLOAT,
    bearing FLOAT,
    
    -- Motion
    speed_kmh FLOAT,
    acceleration FLOAT,
    
    -- Fuel
    fuel_percent FLOAT,
    fuel_liters FLOAT,
    fuel_consumption_lph FLOAT,
    
    -- Engine
    engine_rpm FLOAT,
    engine_temp FLOAT,
    engine_load FLOAT,
    
    -- Systems (JSON for efficiency)
    tire_data JSON,
    brake_data JSON,
    
    -- Environment
    terrain VARCHAR(50),
    weather VARCHAR(50),
    
    -- Tactical
    thermal_signature VARCHAR(20),
    threat_level VARCHAR(20)
);

-- Index for efficient time-series queries
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time 
ON vehicle_telemetry_history(vehicle_id, timestamp DESC);

-- =============================================================================
-- Create AI recommendation log table
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_recommendation_log (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES transport_assets(id) ON DELETE SET NULL,
    convoy_id INTEGER REFERENCES convoys(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    recommendation_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    title VARCHAR(200),
    action TEXT NOT NULL,
    reason TEXT,
    expected_impact TEXT,
    
    was_followed BOOLEAN,
    outcome TEXT,
    
    ai_source VARCHAR(50) DEFAULT 'JANUS_PRO_7B',
    confidence FLOAT,
    processing_time_ms INTEGER
);

-- Index for querying recommendations
CREATE INDEX IF NOT EXISTS idx_ai_rec_vehicle ON ai_recommendation_log(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_convoy ON ai_recommendation_log(convoy_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_time ON ai_recommendation_log(timestamp DESC);

-- =============================================================================
-- Verification query
-- =============================================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'transport_assets' 
-- ORDER BY ordinal_position;
