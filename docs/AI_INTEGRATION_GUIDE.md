# DeepSeek Janus Pro 7B Integration Guide

This guide explains how to set up the local AI environment for the Army Transport Management System. The system expects a locally running Ollama instance with the Janus Pro 7B model.

## 1. Prerequisites

- **NVIDIA GPU**: RTX 3060/4060 or better recommended (8GB+ VRAM).
- **Docker**: For running the application stack.
- **Ollama**: For running the local LLM.

## 2. Setting up Ollama

1.  **Download & Install Ollama**: [https://ollama.com/download](https://ollama.com/download)
2.  **Pull the Model**:
    Open a terminal and run:
    ```bash
    ollama pull erwan2/DeepSeek-Janus-Pro-7B
    ```
    *Note: If you prefer a different quantization or version, you can search [ollama.com/library](https://ollama.com/library) and update the configuration.*

3.  **Verify Model Name**:
    List your models to confirm the exact name:
    ```bash
    ollama list
    ```
    Copy the name (e.g., `erwan2/DeepSeek-Janus-Pro-7B:latest`).

## 3. Configuration

The backend is configured via `backend/.env`. I have created this file for you.

**File: `backend/.env`**
```ini
# AI Settings
JANUS_MODEL_NAME=erwan2/DeepSeek-Janus-Pro-7B
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

-   **JANUS_MODEL_NAME**: Must match the name from `ollama list`.
-   **OLLAMA_BASE_URL**:
    -   If running app in Docker (default): `http://host.docker.internal:11434`
    -   If running app locally (bare metal): `http://localhost:11434`

## 4. Running the System

1.  **Start Ollama**: Ensure Ollama is running in the background (`ollama serve`).
2.  **Start the Application**:
    ```bash
    docker-compose up --build
    ```
3.  **Access the Dashboard**:
    -   Frontend: `http://localhost:3000`
    -   Backend API Docs: `http://localhost:8000/docs`

## 5. Verification

1.  Go to the **AI Load Management** tab in the dashboard.
2.  Check the status indicator in the top right. It should say **"Janus AI Integrated"**.
3.  If it says "AI Service Unavailable", check your Ollama terminal logs to see if it received the request.

## 6. Optimization & Heuristics

The system includes:
-   **GPU Acceleration**: Automatically detected via `app/core/gpu_config.py`. It uses CUDA/CuPy for heavy matrix operations in pathfinding.
-   **Heuristics Fallback**: If Janus is offline, the system falls back to the tactical rule engine defined in `janus_ai_service.py`.

## 7. Customization

To modify tactical rules or vehicle constraints, edit:
-   `backend/app/services/janus_ai_service.py`: For prompts and heuristic rules.
-   `backend/app/services/ai_load_engine.py`: For load optimization logic.
