# 🚛 AI-Based Transport & Road Space Management System
> **Technical Deep Dive & Developer Guide**

![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)
![Stack](https://img.shields.io/badge/Tech-FastAPI%20%7C%20Next.js%20%7C%20PostgreSQL-blue.svg)
![AI](https://img.shields.io/badge/AI-Ollama%20%7C%20DeepSeek--Janus--7B-purple.svg)
![Classification](https://img.shields.io/badge/Classification-RESTRICTED-red.svg)

## 📖 Overview
The **AI Transport Management System (AITMS)** is a military-grade logistics orchestration platform designed for high-threat environments (e.g., Kashmir, Siachen). It integrates a **Thermodynamic Physics Engine** and **Generative AI (LLM)** to create a living "Digital Twin" of the battlefield.

---

## 🏗️ System Architecture

The system follows a **Hexagonal Microservices Architecture**, ensuring high cohesion and low coupling.

```mermaid
graph TD
    User[Command Centre / User] -->|HTTPS| Proxy[Next.js API Proxy]
    
    subgraph "Frontend Layer (Next.js 16)"
        Proxy --> UI[React Components]
        UI -->|Polls| UnifiedCtx[Unified Data Context]
        UnifiedCtx -->|Visualizes| Canvas[WebGL/Canvas Rendering]
    end
    
    Proxy -->|REST API| Backend[FastAPI Core]
    
    subgraph "Domain Layer (Python 3.10)"
        Backend --> Sim[Simulation Orchestrator]
        Sim --> Physics[Realistic Physics Engine]
        Sim --> AI[Janus AI Service]
        Sim --> Algorithms[Military Algorithms]
    end
    
    subgraph "Infrastructure Layer"
        Backend --> DB[(PostgreSQL + PostGIS)]
        Backend --> Redis[(Redis Cache)]
        AI --> Ollama[Ollama (Local LLM)]
    end
```

---

## 🧠 Local AI Integration (Deep Dive)

The system's intelligence core utilizes the **DeepSeek-Janus-Pro-7B** model running locally via Ollama. It is designed for **Air-Gapped** environments where cloud APIs are prohibited.

### 1. The "Observer-Thinker-Linker" Pattern
Unlike standard chatbots, the `JanusAIService` (`app/services/janus_ai_service.py`) operates as a reasoning engine:

*   **Observer (Tensor Ingestion):**
    *   Ingests raw telemetry tensors: `T = [RPM, Speed, Fuel_Flow, Threat_Level]`
    *   Example Input: `{ "velocity": 45, "engine_temp": 110, "gradient": 12 }`
*   **Thinker (Chain-of-Thought):**
    *   Uses a specialized System Prompt that forces "Chain-of-Thought" (CoT) reasoning.
    *   *Reasoning Trace:* "Engine is overheating (110°C). Gradient is steep (12%). High probability of radiator failure if speed is maintained."
*   **Linker (Structured Output):**
    *   Outputs strictly formatted JSON directives.
    *   Example Output: `{"action": "HALT_IMMEDIATE", "reason": "THERMAL_FAILURE_RISK", "confidence": 0.95}`

### 2. Prompt Engineering Strategy

The system relies on "Context Injection" to ground the LLM in tactical reality.

**System Prompt Structure:**
```text
You are a Military Logistics tactical advisor.
CONTEXT:
- Unit: 14 Corps Logistics
- Doctrine: Mountain Warfare (Siachen Standards)
- Active Threats: {THREAT_VECTOR_JSON}

TASK:
Analyze the provided telemetry stream. Detect anomalies based on physics limits (e.g. Tatra truck temp > 105C).
Output ONLY valid JSON.
```

### 3. GPU Acceleration Architecture
The system is optimized for **NVIDIA RTX 40-Series** GPUs but supports CPU fallback.

| Component | Technology | Configuration |
| :--- | :--- | :--- |
| **Inference Engine** | Ollama (Llama.cpp backend) | `n_gpu_layers: -1` (Offload all to VRAM) |
| **Context Window** | 8192 Tokens | Allows extensive history of convoy movements |
| **Quantization** | Q4_K_M (4-bit) | Balances VRAM usage (<6GB) with reasoning accuracy |
| **Vector Ops** | CuPy / PyTorch | Used for rapid cosine similarity checks on threat vectors |

### 4. Troubleshooting Local AI

**Issue: "Model Loading Failed"**
*   *Cause:* Ollama service not running or model not pulled.
*   *Fix:*
    ```powershell
    ollama serve
    ollama pull deepseek-janus-pro-7b
    ```

**Issue: "Inference Timeout"**
*   *Cause:* GPU VRAM full or CPU fallback is too slow.
*   *Fix:* Decrease `context_length` in `janus_ai_service.py` to 4096.

---

## ⚡ Thermodynamic Physics Engine

Vehicles are simulated as thermodynamic systems (`realistic_physics_engine.py`):

1.  **Exponential Atmosphere Model:**
    $$ \rho = \rho_{sea} \cdot e^{-h/H} $$
    *   Air density ($\rho$) drops with altitude ($h$).
    *   Impact: At 5000m, available oxygen is ~50%, reducing engine power significantly.

2.  **Heat Balance Equation:**
    $$ \frac{dT}{dt} = \frac{1}{m C_p} (P_{thermal} - P_{cooling}) $$
    *   Engine temp rises if heat generation ($P_{thermal}$) exceeds cooling capacity ($P_{cooling}$).
    *   Cooling capacity drops with lower vehicle velocity (less airflow).

---

## 🛠️ Installation & Setup

### Prerequisites
*   **Docker Desktop** (Enable WSL 2 Backend)
*   **Ollama** (v0.1.20+)
*   **Python 3.10+**

### Quick Start
```powershell
# 1. Start Ollama (Required for AI features)
ollama serve

# 2. Pull the tactical model
ollama pull deepseek-janus-pro-7b

# 3. Start the stack
docker-compose up --build
```

### Configuration
Edit `backend/app/core/config.py`:
```python
class Settings(BaseSettings):
    JANUS_MODEL_NAME: str = "deepseek-janus-pro-7b"
    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"
    AI_PROVIDER: str = "ollama"  # Options: ollama, lm_studio
```

---

## 🧪 Simulation Capabilities

The system simulates:
1.  **"Concertina Effect"**: Traffic wave propagation in convoys >30 vehicles.
2.  **Brake Fade**: Loss of braking efficiency if brake temp > 300°C (simulated on steep descents).
3.  **Fuel Freeze**: Diesel gelling risk at temps < -20°C (High Altitude).

---

**Documentation Generated:** January 2026
**Maintained by:** Cortex Engineering Unit
