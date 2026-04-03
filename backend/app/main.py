import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import predict, recommend, materials, optimize, audio, surfaces

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def parse_cors_origins():
    raw_origins = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]
    return origins or DEFAULT_CORS_ORIGINS


cors_origins = parse_cors_origins()
allow_credentials = "*" not in cors_origins

# FastAPI application entry point and configuration
app = FastAPI(title="AcuVisor Backend", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Basic health check endpoint
@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(materials.router)
app.include_router(optimize.router)
app.include_router(audio.router)
app.include_router(surfaces.router)
