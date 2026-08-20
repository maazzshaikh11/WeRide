#!/usr/bin/env python3
"""
Generate synthetic training data for the LightGBM ETA model.

Phase 4 MVP: Synthetic training data for MVP.
This is NOT real-world training data — it simulates plausible route characteristics
for testing the ETA pipeline before Google Maps Directions API integration.

Usage:
  python generate_synthetic_data.py

Output:
  synthetic_routes_df.csv

Features:
  distance_km       (float, 0.5–50 km)
  turn_count        (int, 0–20 turns)
  hour_of_day       (int, 0–23)
  day_of_week       (int, 0–6: Monday–Sunday)
  hazard_count      (int, 0–5 hazards)
  avg_speed_limit   (int, 30–80 km/h)
  eta_minutes       (float, computed from features + noise)

Feature relationships:
  - Greater distance → greater ETA
  - Lower average speed → greater ETA
  - More turns → slightly greater ETA (each turn adds ~1 minute)
  - More hazards → slightly greater ETA (each hazard adds ~0.5 minute)
  - Peak hours (8–10, 17–19) → slightly greater ETA (+10%)
"""

import csv
import random

# Fixed seed for reproducibility
SEED = 42
random.seed(SEED)

# Feature ranges for synthetic data
DISTANCE_RANGE = (0.5, 50.0)       # km
TURN_RANGE = (0, 20)
HOUR_RANGE = (0, 23)
DAY_RANGE = (0, 6)
HAZARD_RANGE = (0, 5)
SPEED_RANGE = (30, 80)             # km/h

# Peak hours (8–10 am, 5–7 pm) → 10% ETA increase
PEAK_HOURS = {8, 9, 10, 17, 18, 19}

def compute_synthetic_eta(distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit):
    """
    Compute synthetic ETA based on features.

    Base formula:
      base_eta = (distance_km / avg_speed_limit) * 60  [minutes]

    Adjustments:
      + turn_count * 1.0              [~1 min per turn]
      + hazard_count * 0.5            [~30s per hazard]
      + 10% if peak hour
      + random noise: ±10%
    """
    # Base ETA: distance / speed
    base_eta = (distance_km / avg_speed_limit) * 60

    # Turn penalty: ~1 minute per turn
    turn_penalty = turn_count * 1.0

    # Hazard penalty: ~30 seconds per hazard
    hazard_penalty = hazard_count * 0.5

    # Peak hour multiplier
    peak_multiplier = 1.1 if hour_of_day in PEAK_HOURS else 1.0

    # Noise: ±10%
    noise = random.uniform(0.9, 1.1)

    eta = (base_eta + turn_penalty + hazard_penalty) * peak_multiplier * noise

    return max(0.5, eta)  # Ensure minimum 0.5 minutes


def generate_synthetic_data(num_samples=500):
    """Generate synthetic training samples."""
    rows = []

    for _ in range(num_samples):
        distance_km = random.uniform(*DISTANCE_RANGE)
        turn_count = random.randint(*TURN_RANGE)
        hour_of_day = random.randint(*HOUR_RANGE)
        day_of_week = random.randint(*DAY_RANGE)
        hazard_count = random.randint(*HAZARD_RANGE)
        avg_speed_limit = random.randint(*SPEED_RANGE)

        eta_minutes = compute_synthetic_eta(
            distance_km,
            turn_count,
            hour_of_day,
            day_of_week,
            hazard_count,
            avg_speed_limit
        )

        rows.append({
            'distance_km': round(distance_km, 2),
            'turn_count': turn_count,
            'hour_of_day': hour_of_day,
            'day_of_week': day_of_week,
            'hazard_count': hazard_count,
            'avg_speed_limit': avg_speed_limit,
            'eta_minutes': round(eta_minutes, 2),
        })

    return rows


def main():
    rows = generate_synthetic_data(500)

    # Write CSV
    output_file = 'synthetic_routes_df.csv'
    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'distance_km',
            'turn_count',
            'hour_of_day',
            'day_of_week',
            'hazard_count',
            'avg_speed_limit',
            'eta_minutes',
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f'✓ Generated {len(rows)} synthetic training samples')
    print(f'✓ Output: {output_file}')
    print(f'✓ Seed: {SEED} (reproducible)')


if __name__ == '__main__':
    main()
