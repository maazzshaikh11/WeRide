#!/usr/bin/env python3
"""
Python Sidecar for LightGBM ETA Model Inference

Role:
  Loads trained LightGBM model (eta_model.txt)
  Serves predictions via HTTP for Node.js POST /route handler

Architecture:
  Node.js (POST /route) → HTTP call to sidecar → LightGBM model → ETA

Usage:
  python sidecar.py

Listens on:
  http://127.0.0.1:5000

Endpoints:
  POST /predict
    Input: { "distance_km": float, "turn_count": int, ... }
    Output: { "eta": float }

  GET /health
    Output: { "status": "ok" }

Features (in order):
  distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit

Requires:
  pip install flask lightgbm pandas
"""

import json
import sys
from pathlib import Path

try:
    import lightgbm as lgb
    from flask import Flask, request, jsonify
except ImportError as e:
    print(f'ERROR: Missing dependency: {e}')
    print('Install with: pip install flask lightgbm pandas')
    sys.exit(1)

app = Flask(__name__)

# Global model (loaded on startup)
MODEL = None


def load_model():
    """Load LightGBM model from eta_model.txt."""
    global MODEL

    model_path = Path(__file__).parent / 'eta_model.txt'

    if not model_path.exists():
        raise FileNotFoundError(f'Model file not found: {model_path}')

    print(f'Loading model from {model_path}...')
    MODEL = lgb.Booster(model_file=str(model_path))
    print('✓ Model loaded')


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'}), 200


@app.route('/predict', methods=['POST'])
def predict():
    """
    ETA prediction endpoint.

    Expects JSON:
      {
        "distance_km": float,
        "turn_count": int,
        "hour_of_day": int (0–23),
        "day_of_week": int (0–6),
        "hazard_count": int,
        "avg_speed_limit": int/float
      }

    Returns:
      { "eta": float (minutes) }
    """
    if MODEL is None:
        return jsonify({'error': 'Model not loaded'}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON body'}), 400

        # Extract features in EXACT order
        features = [
            float(data.get('distance_km', 0)),
            int(data.get('turn_count', 0)),
            int(data.get('hour_of_day', 0)),
            int(data.get('day_of_week', 0)),
            int(data.get('hazard_count', 0)),
            float(data.get('avg_speed_limit', 40)),
        ]

        # Predict
        eta = float(MODEL.predict([features])[0])

        # Validate
        if not (0 < eta < 1000):  # Reasonable bounds
            return jsonify({'error': f'Invalid ETA prediction: {eta}'}), 500

        return jsonify({'eta': round(eta, 2)}), 200

    except (ValueError, KeyError, TypeError) as e:
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Prediction error: {str(e)}'}), 500


def main():
    """Start the sidecar server."""
    print('WeRide ETA Sidecar (LightGBM)')
    print('=' * 50)

    try:
        load_model()
    except FileNotFoundError as e:
        print(f'ERROR: {e}')
        print('Train the model first: python train_eta.py')
        sys.exit(1)

    print('Starting Flask server on http://127.0.0.1:5000...')
    print('Press Ctrl+C to stop')
    print()

    # Run on localhost, port 5000
    app.run(host='127.0.0.1', port=5000, debug=False)


if __name__ == '__main__':
    main()
