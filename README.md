# AcuVisor

AcuVisor is an acoustic treatment planning app for small rooms. It combines room dimensions, a room photo, material suggestions, panel placement logic, and audio preview generation to help turn a rough room idea into a practical treatment plan.

This frontend is built with React and Vite and connects to a FastAPI backend that handles prediction, recommendation, image-based surface analysis, and auralization.

## What the app does

AcuVisor guides the user through a four-step workflow:

1. Room setup
   - Enter room dimensions.
   - Upload a room photo.
2. Materials
   - Detect wall, floor, and ceiling regions from the uploaded image.
   - Suggest likely surface materials.
   - Allow manual overrides when needed.
3. Layout
   - Place the source and listener positions.
   - Mark exclusion zones.
   - Preview the room and panel layout in 3D.
4. Results
   - Recommend treatment coverage and panel placement.
   - Predict RT60 before and after treatment.
   - Generate untreated vs treated audio previews.
   - Export a PDF report.

## Stack

Frontend:
- React 19
- Vite 7
- React Router
- Tailwind CSS
- Three.js with React Three Fiber and Drei
- jsPDF

Backend:
- FastAPI
- TensorFlow
- scikit-learn
- PyTorch / torchvision
- transformers
- pyroomacoustics
- soundfile / scipy

## Project structure

```text
AcuVisor/
- frontend/
  - src/
    - components/
    - pages/
    - utils/
    - api.js
    - App.jsx
  - public/
  - package.json
  - .env.example
- backend/
  - app/
    - routers/
    - services/
    - ml/
    - static/
  - requirements.txt
  - .env.example
- ml/
  - notebooks/
```

## Frontend environment variables

Create a `frontend/.env` file if you want to override the local default.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Notes:
- In development, the frontend falls back to `http://127.0.0.1:8000` if `VITE_API_BASE_URL` is not set.
- In production, set `VITE_API_BASE_URL` to your deployed backend URL.

## Backend environment variables

Create a `backend/.env` file if needed.

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Notes:
- `CORS_ORIGINS` should be a comma-separated list of allowed frontend origins.
- For production, include your Vercel frontend URL here.

## Running locally

### 1. Start the backend

From the repo root:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend will be available at `http://127.0.0.1:8000`.

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Available backend endpoints

Core routes used by the frontend:
- `GET /health`
- `POST /segment-surfaces`
- `POST /suggest-material`
- `POST /suggest-material-from-bbox`
- `POST /predict-rt60`
- `POST /recommend-panels`
- `POST /generate-audio`
- `POST /generate-audio-upload`

The backend also serves generated audio and sample assets from `/static`.

## Build the frontend

```bash
cd frontend
npm run build
```

The production build is written to `frontend/dist`.

## Deployment

### Frontend on Vercel

Recommended settings:
- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-backend-domain`

### Backend on DigitalOcean

You can deploy the backend on a Droplet or App Platform.

Suggested startup command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

If your platform injects a port variable, use:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Production notes:
- Set `CORS_ORIGINS` to include your Vercel domain.
- The backend includes ML and audio dependencies, so plan for a heavier runtime than a typical CRUD API.
- Generated audio files are written under `backend/app/static/audio`.

## Development notes

- The frontend API client is defined in `frontend/src/api.js`.
- Audio preview URLs are built from the same backend base URL used for API requests.
- The backend serves static files using an absolute path so it is less sensitive to the working directory in production.

## Current status

This project includes:
- Automatic and manual room surface workflows
- Material suggestion flow with overrides
- 3D room visualization and panel layout preview
- RT60 prediction
- Auralization with built-in or uploaded dry audio
- PDF report export

## License

No license has been added yet.

