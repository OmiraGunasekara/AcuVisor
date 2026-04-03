# AcuVisor

AcuVisor is a small-room acoustic treatment planning app. It combines room dimensions, a room photo, estimated surface materials, layout inputs, RT60 prediction, panel placement, and before/after audio previews to turn an early room idea into a practical treatment plan.

The project is split into a React + Vite frontend and a FastAPI backend with ML- and simulation-driven services for surface analysis, material suggestion, acoustic prediction, and audio auralization.

## What AcuVisor does

AcuVisor guides the user through a four-step workflow:

1. Room setup
   - Enter room dimensions.
   - Upload a reference photo of the room.
2. Materials
   - Detect likely wall, floor, and ceiling regions from the uploaded image.
   - Suggest probable surface materials.
   - Fall back to a manual sampling flow when automatic detection is not reliable enough.
3. Layout
   - Place the sound source and listener in a 3D room view.
   - Mark wall exclusion zones where treatment should not be placed.
4. Results
   - Generate recommended acoustic panel placement.
   - Predict RT60 before and after treatment.
   - Produce untreated vs treated audio previews.
   - Export a PDF report with metrics and layout details.

## Key capabilities

- Guided room-analysis workflow built for compact studios, edit rooms, and listening spaces.
- Automatic surface segmentation from room photos using a vision model.
- Material suggestion from detected regions or manual crop selection.
- 3D room visualization with source, listener, exclusions, and treatment layout.
- Genetic-algorithm-based panel placement recommendations.
- RT60 prediction using a trained MLP model bundled with the backend.
- Audio preview generation with a built-in dry speech sample or uploaded dry audio.
- Shareable PDF report export from the frontend.

## Architecture

### Frontend

The frontend lives in `frontend/` and is responsible for:

- The step-by-step user workflow
- Image upload and manual material sampling UI
- 3D room and panel visualization
- Calling backend APIs
- Displaying metrics and audio previews
- Exporting PDF reports

### Backend

The backend lives in `backend/` and is responsible for:

- RT60 prediction
- Surface segmentation
- Material suggestion
- Panel recommendation and optimization
- Audio preview generation
- Serving generated audio and sample assets from `/static`

## Tech stack

### Frontend

- React 19
- Vite 7
- React Router 7
- Tailwind CSS
- Three.js with React Three Fiber and Drei
- jsPDF
- lucide-react

### Backend

- FastAPI
- TensorFlow / Keras
- scikit-learn
- PyTorch / torchvision
- transformers
- pyroomacoustics
- scipy
- soundfile
- Pillow

## Repository structure

```text
AcuVisor/
|- frontend/
|  |- public/
|  |- src/
|  |  |- components/
|  |  |- pages/
|  |  |- utils/
|  |  |- api.js
|  |  |- App.jsx
|  |  |- constants.js
|  |- package.json
|  |- .env.example
|- backend/
|  |- app/
|  |  |- ml/
|  |  |- routers/
|  |  |- services/
|  |  |- static/
|  |  |- main.py
|  |- requirements.txt
|  |- .env.example
|- ml/
|  |- notebooks/
|- README.md
```

## Prerequisites

Before running locally, make sure you have:

- Python installed with `venv` support
- Node.js and npm
- Enough disk space and memory for backend ML dependencies
- Internet access on first run if the backend needs to download Hugging Face model weights for vision tasks

## Environment variables

### Frontend

Create `frontend/.env` if you want to override the default backend URL.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Notes:

- If `VITE_API_BASE_URL` is not set, the frontend falls back to `http://127.0.0.1:8000`.
- In production, set this to your deployed backend origin.

### Backend

Create `backend/.env` if needed.

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Notes:

- `CORS_ORIGINS` is a comma-separated list of allowed frontend origins.
- In production, include your deployed frontend URL here.

## Running locally

### 1. Start the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at `http://127.0.0.1:8000`.

### 2. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## API routes

These are the main routes exposed by the backend:

- `GET /health` - health check
- `POST /segment-surfaces` - detect wall, floor, and ceiling regions from an uploaded image
- `POST /suggest-material` - suggest a material from a manual click/crop workflow
- `POST /suggest-material-from-bbox` - suggest a material from a detected bounding box
- `POST /predict-rt60` - predict before/after RT60 from room and coverage inputs
- `POST /recommend-panels` - generate panel placement recommendations
- `POST /optimize-panels-ga` - direct GA optimization endpoint
- `POST /generate-audio` - generate before/after audio previews using the bundled dry sample
- `POST /generate-audio-upload` - generate before/after audio previews from uploaded dry audio

The backend also serves static files from `/static`.

## ML and runtime notes

- The RT60 predictor uses bundled model assets in `backend/app/ml/`.
- Surface segmentation loads `facebook/mask2former-swin-small-ade-semantic` through `transformers`.
- Material suggestion loads `openai/clip-vit-base-patch32` through `transformers`.
- The vision models are loaded lazily during requests and unloaded afterward.
- The first segmentation or material-suggestion request may be noticeably slower because model weights may need to download.
- Generated audio previews are written under `backend/app/static/audio/`.
- The backend keeps only the latest 10 generated audio run folders.
- Uploaded dry audio currently supports WAV, FLAC, and OGG.

## Notebooks

The `ml/notebooks/` folder contains research and experimentation notebooks used during development, including:

- acoustic exploration
- dataset generation
- MLP model training

These notebooks are supporting artifacts and are not required to run the app locally.

## Deployment notes

### Frontend

The repo includes Vercel configuration under `frontend/vercel.json`.

Typical settings:

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-backend-domain`

### Backend

A typical production command is:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

If your platform injects a port variable, use the equivalent command for that environment.

Operational notes:

- Set `CORS_ORIGINS` to include your frontend domain.
- Backend startup and first-request latency can be heavier than a simple CRUD API because of ML and audio dependencies.
- Static audio files are generated on disk, so production deployment should account for writable storage.

## Limitations and intended use

AcuVisor is best used as an early-stage planning tool for small rooms. It is useful for exploring treatment options, visualizing panel placement, and comparing likely acoustic outcomes before installation.

It is not a replacement for full acoustic measurement, detailed room calibration, or a professional on-site consultation for complex spaces.

## License

No license has been added yet.
