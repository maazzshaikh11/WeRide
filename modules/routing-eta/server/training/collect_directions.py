# Collect Google Maps Directions API ETA as training labels for the LightGBM model.
# Run: python collect_directions.py
#
# Generates routes_df.csv with columns:
#   distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit, eta_minutes
#
# Requires: GOOGLE_MAPS_API_KEY env var

import csv
import os
import random
import urllib.request
import json
from datetime import datetime, timedelta

API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')
# Sample origins/destinations — adjust to your test region
SAMPLE_POINTS = [
    (12.9716, 77.5946),  # Bangalore
    (12.9352, 77.6245),
    (12.9698, 77.7500),
    (13.0298, 77.5660),
]

def get_directions(origin, destination, departure_time):
    url = (
        f"https://maps.googleapis.com/maps/api/directions/json"
        f"?origin={origin[0]},{origin[1]}&destination={destination[0]},{destination[1]}"
        f"&departure_time={departure_time}&key={API_KEY}"
    )
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    if data.get('status') != 'OK' or not data.get('routes'):
        return None
    route = data['routes'][0]['legs'][0]
    return {
        'distance_km': route['distance']['value'] / 1000,
        'eta_minutes': route['duration']['value'] / 60,
        'turn_count': len(route.get('steps', [])),
    }

def main():
    rows = []
    base = datetime(2024, 1, 1)
    for _ in range(500):
        o = random.choice(SAMPLE_POINTS)
        d = random.choice(SAMPLE_POINTS)
        if o == d: continue
        dt = base + timedelta(hours=random.randint(0, 23 * 7))
        result = get_directions(o, d, int(dt.timestamp()))
        if not result: continue
        rows.append({
            **result,
            'hour_of_day': dt.hour,
            'day_of_week': dt.weekday(),
            'hazard_count': random.randint(0, 3),
            'avg_speed_limit': random.choice([30, 40, 50, 60, 80]),
        })
    with open('routes_df.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f'Collected {len(rows)} routes')

if __name__ == '__main__':
    main()