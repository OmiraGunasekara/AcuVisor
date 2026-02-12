import os
import numpy as np
import joblib
from tensorflow.keras.models import load_model

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(APP_DIR, "ml")

MODEL_PATH = os.path.join(ML_DIR, "mlp_rt60_model.keras")
SCALER_PATH = os.path.join(ML_DIR, "feature_scaler.pkl")

model = load_model(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

def predict_rt60(L, W, H, wall_a, floor_a, ceil_a, panel_coverage: float) -> float:
    x = np.array([[L, W, H, wall_a, floor_a, ceil_a, panel_coverage]], dtype=np.float32)
    x_scaled = scaler.transform(x)
    y = model.predict(x_scaled, verbose=0).flatten()[0]
    return float(y)
