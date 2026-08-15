# Train LightGBM ETA model. Run: python train_eta.py
# Input: routes_df.csv (from collect_directions.py)
# Output: eta_model.txt (LightGBM model file — load on the server)
#
# Requires: pip install lightgbm pandas scikit-learn

import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
import joblib

FEATURES = ['distance_km', 'turn_count', 'hour_of_day', 'day_of_week', 'hazard_count', 'avg_speed_limit']
TARGET = 'eta_minutes'

def main():
    df = pd.read_csv('routes_df.csv')
    X = df[FEATURES]
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = lgb.LGBMRegressor(
        n_estimators=100,
        learning_rate=0.1,
        num_leaves=31,
        verbose=-1,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)])

    # Save LightGBM model (text format — loadable by the Node/Python inference)
    model.booster_.save_model('eta_model.txt')
    print(f'Trained. Test RMSE: {((model.predict(X_test) - y_test) ** 2).mean() ** 0.5:.2f} min')

if __name__ == '__main__':
    main()