#!/usr/bin/env python3
"""
Train LightGBM ETA model using GeoLife GPS trajectory dataset.

Source: Microsoft GeoLife GPS Trajectory Dataset
        https://www.microsoft.com/en-us/download/details.aspx?id=52367

Dataset: geolife_routes_df.csv
  - 172 driving trips extracted from GeoLife trajectories
  - 20 users, 100 trajectory files processed
  - Features: distance_km, turn_count, hour_of_day, day_of_week, 
              hazard_count, avg_speed_limit
  - Target: eta_minutes (actual trip duration)

Training per LightGBM-Training.md specifications:
  - 70% train / 15% validation / 15% test split
  - LightGBM Regressor
  - Evaluation: MAE, RMSE, R²

Usage:
  python train_geolife_eta.py

Output:
  eta_model.txt (LightGBM model in text format)
"""

import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import os

FEATURES = [
    'distance_km',
    'turn_count',
    'hour_of_day',
    'day_of_week',
    'hazard_count',
    'avg_speed_limit'
]
TARGET = 'eta_minutes'

def main():
    print("=" * 70)
    print("LightGBM ETA Model Training")
    print("Dataset: GeoLife GPS Trajectories")
    print("=" * 70)
    print()
    
    # Load GeoLife training data
    input_file = 'geolife_routes_df.csv'
    if not os.path.exists(input_file):
        print(f"[ERROR] {input_file} not found")
        print("Run: python process_geolife_sample.py")
        return False
    
    print(f"Loading training data from {input_file}...")
    df = pd.read_csv(input_file)
    print(f"  Loaded {len(df)} samples")
    print()
    
    # Data overview
    print("Data Overview:")
    print(df.describe())
    print()
    
    X = df[FEATURES]
    y = df[TARGET]
    
    # Split: 70% train, 15% val, 15% test
    print("Splitting data (70/15/15)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_test, y_test, test_size=0.5, random_state=42
    )
    
    print(f"  Train: {len(X_train)} samples")
    print(f"  Val:   {len(X_val)} samples")
    print(f"  Test:  {len(X_test)} samples")
    print()
    
    # Train LightGBM
    print("Training LightGBM Regressor...")
    model = lgb.LGBMRegressor(
        n_estimators=100,
        learning_rate=0.1,
        num_leaves=31,
        verbose=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)
    print("  Training complete")
    print()
    
    # Evaluate on validation set
    print("Validation Results:")
    y_val_pred = model.predict(X_val)
    val_mse = mean_squared_error(y_val, y_val_pred)
    val_rmse = val_mse ** 0.5
    val_mae = mean_absolute_error(y_val, y_val_pred)
    val_r2 = r2_score(y_val, y_val_pred)
    print(f"  RMSE: {val_rmse:.2f} minutes")
    print(f"  MAE:  {val_mae:.2f} minutes")
    print(f"  R²:   {val_r2:.4f}")
    print()
    
    # Evaluate on test set
    print("Test Results:")
    y_test_pred = model.predict(X_test)
    test_mse = mean_squared_error(y_test, y_test_pred)
    test_rmse = test_mse ** 0.5
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_r2 = r2_score(y_test, y_test_pred)
    print(f"  RMSE: {test_rmse:.2f} minutes")
    print(f"  MAE:  {test_mae:.2f} minutes")
    print(f"  R²:   {test_r2:.4f}")
    print()
    
    # Save model
    print("Saving model...")
    output_file = 'eta_model.txt'
    model.booster_.save_model(output_file)
    print(f"  [OK] Saved: {output_file}")
    print()
    
    # Verify model can be loaded and make predictions
    print("Verifying model...")
    loaded_model = lgb.Booster(model_file=output_file)
    test_sample = X_test.iloc[:1].values
    test_pred = loaded_model.predict(test_sample)
    print(f"  [OK] Model loads successfully")
    print(f"  [OK] Model can make predictions (test: {test_pred[0]:.2f} minutes)")
    print()
    
    print("=" * 70)
    print("[OK] Training complete")
    print("=" * 70)
    print()
    print("Summary:")
    print(f"  Dataset: GeoLife GPS Trajectories (172 driving trips)")
    print(f"  Features: {', '.join(FEATURES)}")
    print(f"  Target: {TARGET}")
    print(f"  Train/Val/Test split: 70/15/15")
    print(f"  Model: LightGBM Regressor (100 trees)")
    print(f"  Test MAE: {test_mae:.2f} minutes")
    print(f"  Test RMSE: {test_rmse:.2f} minutes")
    print(f"  Test R²: {test_r2:.4f}")
    print(f"  Output: {output_file}")
    print()
    
    return True

if __name__ == '__main__':
    import sys
    success = main()
    sys.exit(0 if success else 1)
