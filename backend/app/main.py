from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, recommend, materials, optimize, audio
from fastapi.staticfiles import StaticFiles



app = FastAPI(title="AcuVisor Backend", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(materials.router)
app.include_router(optimize.router) 
app.include_router(audio.router)

