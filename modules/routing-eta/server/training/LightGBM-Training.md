Yes. I went back to the **actual WeRide master plan + Person C plan**
and checked the data requirements. The cleanest way to give Person C the
work is to make this a concrete pipeline rather than simply saying "find
a dataset."

The plan explicitly says the preferred approach is **Google Maps
Directions ETA as the ground-truth label**, with synthetic data as an
alternative and real WeRide ride data later. The model inputs are
distance, road characteristics, turns, time/day, hazards, speed limit,
and optionally weather.

# **Plan for Person C --- ETA LightGBM Model**

> **Goal:** Build a training CSV → train LightGBM → evaluate it → save
> the model → expose ETA prediction through the routing server.

One correction from the earlier discussion: the project plan says
**LightGBM or LightGBM, pick one**, and currently recommends
**LightGBM**. If Person C specifically chooses LightGBM, that's fine,
but the team should make that decision once and not maintain both.

------------------------------------------------------------------------

## **Step 1 --- Decide the model**

For the work you are assigning to Person C:

**Use LightGBM.**

Don't build both LightGBM and XGBoost.

Model:\
LightGBM Regressor

Task:\
Regression

Target:\
ETA / travel duration in minutes

The model is **not** predicting the route itself.

A\* finds the route.

LightGBM predicts how long that route will take.

Origin + Destination\
↓\
A\* routing\
↓\
Route/path\
↓\
Extract route features\
↓\
LightGBM\
↓\
ETA in minutes

This matches the project's architecture where routing/ETA is
server-side.

------------------------------------------------------------------------

# **Step 2 --- Get the raw data**

### **Best starting source: GeoLife**

Use the official **Microsoft GeoLife GPS Trajectory Dataset**.

It contains **17,621 trajectories**, approximately **1.2 million km** of
movement and more than **48,000 hours** of trajectory data. The
trajectories contain timestamped latitude, longitude and altitude; the
transportation-mode subset additionally contains speed/heading
information.
([Microsoft](https://www.microsoft.com/en-us/research/publication/geolife-gps-trajectory-dataset-user-guide/?utm_source=chatgpt.com))

[Download GeoLife from
Microsoft](https://www.microsoft.com/en-gb/download/details.aspx?id=52367&utm_source=chatgpt.com)

But don't blindly use every trajectory.

For an ETA model, Person C should filter for **driving/vehicle
trajectories** where transportation-mode labels are available.

------------------------------------------------------------------------

# **Step 3 --- Convert trajectories into trips**

GeoLife gives you GPS points like:

lat lng timestamp\
39.9841 116.3192 2008-10-23 10:15:01\
39.9842 116.3195 2008-10-23 10:15:05\
39.9845 116.3200 2008-10-23 10:15:09\
...

Person C needs to turn each trajectory into **one training example**.

For every trip calculate:

### **Start**

start_lat\
start_lng\
start_time

### **End**

end_lat\
end_lng\
end_time

### **Duration**

duration_minutes =\
end_time - start_time

### **Distance**

Calculate distance between consecutive GPS points and sum them:

distance_km =\
Σ distance(point\[i\], point\[i+1\])

This gives the actual observed travel distance and duration.

------------------------------------------------------------------------

# **Step 4 --- Calculate time features**

From start_time create:

hour_of_day\
day_of_week

For example:

2026-09-11 08:30

becomes:

hour_of_day = 8\
day_of_week = Friday

For LightGBM, encode day as:

Monday = 0\
Tuesday = 1\
...\
Sunday = 6

You can also derive:

is_weekend

although that is an additional engineered feature, not explicitly
required by the plan.

The plan specifically calls for hour_of_day and day_of_week because
traffic conditions vary with time.

------------------------------------------------------------------------

# **Step 5 --- Calculate average speed**

From the trajectory:

avg_speed_kmh =\
distance_km / duration_hours

This is useful for the model.

However, **be careful about leakage**.

If the goal is to predict ETA **before the trip starts**, don't give
LightGBM the actual trip duration or a feature calculated from the
entire completed trip.

So:

### **Training target**

actual_duration_minutes

### **Input features**

Things that would be known when requesting the route.

------------------------------------------------------------------------

# **Step 6 --- Add road features**

This is where **OpenStreetMap** becomes useful.

The Person C plan explicitly allows an OSM road graph and mentions road
type and speed-limit information as possible ETA features.

For each trip/route derive:

road_type_distribution\
turn_count\
avg_speed_limit

For example:

road_type_motorway_pct\
road_type_primary_pct\
road_type_secondary_pct\
road_type_residential_pct

or a simpler representation if necessary.

### **Don't overcomplicate this for MVP.**

If extracting reliable road metadata becomes difficult:

distance_km\
turn_count\
hour_of_day\
day_of_week\
hazard_count\
avg_speed_limit

is enough to start.

The plan explicitly says road-type distribution and speed limit can be
skipped if the road graph does not provide them.

------------------------------------------------------------------------

# **Step 7 --- Add turn count**

From the route geometry calculate how many meaningful turns occur.

For example:

straight\
straight\
right\
straight\
left\
straight\
right

would produce:

turn_count = 3

This is one of the features explicitly required by the plan.

------------------------------------------------------------------------

# **Step 8 --- Add hazard information**

This is where Person C connects with **Person B**.

The routing system already consumes B's hazard_cluster data.

For each route calculate:

hazard_count_along_route

For example:

Route = 8.4 km\
Hazards within 100 m = 3

hazard_count_along_route = 3

The plan specifically calls for this feature.

For the **initial training dataset**, there won't necessarily be
historical real WeRide hazards.

So Person C can initially generate simulated hazard counts:

0\
1\
2\
3\
...

and later replace them with actual historical hazard data.

**Important:** don't claim these synthetic hazard values are real-world
observations.

------------------------------------------------------------------------

# **Step 9 --- Weather**

Weather is explicitly **optional** in the project plan.

So for MVP:

### **Skip it.**

Don't delay the model because of weather data.

The official feature list says:

## weather --- optional, skip for MVP unless data is easy to get

# **Step 10 --- Build the final training CSV**

This is the important part.

Person C should eventually create something like:

distance_km,turn_count,hour_of_day,day_of_week,hazard_count_along_route,avg_speed_limit,actual_duration_minutes\
5.2,4,8,0,0,50,11.4\
8.7,7,9,0,1,45,19.2\
12.3,10,18,4,2,40,31.7\
6.4,3,14,2,0,60,12.1\
15.8,14,19,4,3,45,42.5

### **The most important column is:**

actual_duration_minutes

That is the **target y**.

Everything before it is input X.

------------------------------------------------------------------------

# **Step 11 --- Final feature set**

For the first LightGBM model, I would tell Person C to use:

X:

distance_km\
turn_count\
hour_of_day\
day_of_week\
hazard_count_along_route\
avg_speed_limit

Optional:

road_type_distribution\
weather

Target:

actual_duration_minutes

This is directly aligned with the project's specified ETA features.

------------------------------------------------------------------------

# **Step 12 --- Clean the dataset**

Before training:

### **Remove**

-   Missing coordinates\
-   Missing timestamps\
-   Negative/zero durations\
-   Impossible speeds\
-   Extremely abnormal trip distances\
-   Duplicate trips\
-   Corrupted GPS trajectories

For example, a trip saying:

distance = 10 km\
duration = 3 seconds

is obviously bad training data.

Don't simply delete everything based on arbitrary thresholds; document
the filtering rules in the README.

------------------------------------------------------------------------

# **Step 13 --- Split the dataset**

Use:

70% → training\
15% → validation\
15% → testing

For example:

100,000 rows

70,000 → train\
15,000 → validation\
15,000 → test

**Important:** avoid randomly mixing points from the same trajectory
between train and test.

Ideally, split at the **trip/trajectory level** so the same trip cannot
leak into both sets.

------------------------------------------------------------------------

# **Step 14 --- Train LightGBM**

Person C can use Python:

pandas\
numpy\
scikit-learn\
lightgbm

Conceptually:

X = df\[\
\[\
"distance_km",\
"turn_count",\
"hour_of_day",\
"day_of_week",\
"hazard_count_along_route",\
"avg_speed_limit"\
\]\
\]

y = df\["actual_duration_minutes"\]

Then:

X_train\
X_validation\
X_test

        ↓  

LightGBM Regressor\
↓\
ETA prediction\
---

# **Step 15 --- Evaluate the model**

Person C should **not just say "accuracy = 95%"**.

ETA is a regression problem.

Use:

### **MAE**

Mean Absolute Error.

Example:

MAE = 2.4 minutes

means predictions are off by approximately 2.4 minutes on average.

### **RMSE**

Measures larger errors more strongly.

### **R²**

Shows how much variation the model explains.

So the report can show:

LightGBM ETA Model

MAE : 2.4 minutes\
RMSE : 4.1 minutes\
R² : 0.87

Those numbers are just an **example format**---Person C must report the
actual measured results.

------------------------------------------------------------------------

# **Step 16 --- Compare against a baseline**

This is important for your final-year project.

Don't only show:

> LightGBM gives ETA.

Show:

Baseline:\
ETA = distance / average_speed

vs.

LightGBM:\
ETA = learned prediction

Then compare:

  Model                     MAE
  ------------------------- ---------------
  Distance/Speed baseline   actual result
  LightGBM                  actual result

If LightGBM performs better, you have a much stronger justification for
using ML.

This also matches the plan's reasoning that simple distance / avg_speed
is insufficient because ETA depends on traffic/time/road
characteristics.

------------------------------------------------------------------------

# **Step 17 --- Save the trained model**

After training:

modules/routing-eta/server/training/

should contain something like:

training/\
├── collect_data.py\
├── prepare_dataset.py\
├── train_lightgbm.py\
├── evaluate.py\
├── eta_training.csv\
└── eta_model.json

The exact filename isn't mandated, but the Person C plan explicitly
expects training scripts and an exported model under the routing module.

------------------------------------------------------------------------

# **Step 18 --- Connect LightGBM to the routing server**

Now the real WeRide flow becomes:

Mobile App\
│\
│ POST /route\
↓\
Node.js Routing Server\
│\
├── A\* → calculates route\
│\
├── Extract:\
│ distance\
│ turns\
│ hazards\
│ speed limit\
│ time/day\
│\
↓\
LightGBM\
│\
↓\
ETA = 18.6 minutes\
│\
↓\
route_response

The response must follow the frozen contract:

{\
"route_id": "string",\
"path_points": \[\["lat", "lng"\]\],\
"distance_km": 12.4,\
"eta_minutes": 18.6,\
"safety_score": 0.82,\
"recalculated_at_hlc": "..."\
}

That route_response shape is frozen in the project plan.

------------------------------------------------------------------------

# **Step 19 --- What Person C should finally demonstrate**

For the final demo:

### **Input**

Origin\
Destination\
Current hazards\
Current time

### **A\***

Find safest route

### **Feature extraction**

distance = 8.2 km\
turns = 6\
hour = 18\
day = Friday\
hazards = 2\
speed_limit = 45 km/h

### **LightGBM**

ETA = 21.7 minutes

### **App**

┌─────────────────────────┐\
│ ETA 21 min │\
│ Distance 8.2 km │\
│ Safety ███████ 82%│\
└─────────────────────────┘

Then if B publishes a new hazard:

New hazard\
↓\
A\* recalculates\
↓\
New route\
↓\
New features\
↓\
LightGBM\
↓\
New ETA

This is exactly the integration scenario Person C's plan calls for:
hazard appears → route reroutes → ETA updates.

------------------------------------------------------------------------

# **What dataset should Person C actually use?**

I'd give him this priority:

### **Option 1 --- Recommended starting point**

**GeoLife + OpenStreetMap**

GeoLife provides real GPS trajectories and timestamps; OSM provides
road-network information. GeoLife is officially available from
Microsoft.
([Microsoft](https://www.microsoft.com/en-us/research/publication/geolife-gps-trajectory-dataset-user-guide/?utm_source=chatgpt.com))

### **Option 2 --- Additional trip-duration data**

**NYC TLC Trip Record Data**

The official NYC TLC data contains pickup/drop-off timestamps,
pickup/drop-off locations and trip distance, making it useful for a
travel-duration regression dataset. ([NYC Homeowner
Portal](https://home4.nyc.gov/site/tlc/about/tlc-trip-record-data.page?utm_source=chatgpt.com))

[NYC TLC Trip Record
Data](https://home4.nyc.gov/site/tlc/about/tlc-trip-record-data.page?utm_source=chatgpt.com)

### **Option 3 --- Project-plan bootstrap**

**Google Maps Directions API ETA**

Generate origin/destination/time combinations, obtain ETA, calculate
your features, and use the returned ETA as the training label. This is
actually the **recommended approach in Person C's plan**.

------------------------------------------------------------------------

## **The exact assignment I would give Person C**

You can send him this:

> **Build the WeRide ETA ML pipeline using LightGBM.**

> 1.  Obtain GPS/trip data from GeoLife and/or another suitable trip
>     dataset.\
> 2.  Filter to vehicle/driving trips where possible.\
> 3.  Convert trajectories into individual trips.\
> 4.  Calculate distance and actual trip duration.\
> 5.  Extract hour_of_day and day_of_week.\
> 6.  Use OSM/road-graph data to derive turn_count and avg_speed_limit;
>     use road_type_distribution if practical.\
> 7.  Add hazard_count_along_route from B's hazard data when available;
>     use clearly labelled synthetic hazards initially if historical
>     hazard data is unavailable.\
> 8.  Skip weather for MVP.\
> 9.  Create eta_training.csv with:

distance_km\
turn_count\
hour_of_day\
day_of_week\
hazard_count_along_route\
avg_speed_limit\
\> actual_duration_minutes

> 10. Clean invalid/outlier records.\
> 11. Split data by trip into train/validation/test.\
> 12. Train an LightGBM regression model.\
> 13. Evaluate using MAE, RMSE and R².\
> 14. Compare against a simple distance/average-speed baseline.\
> 15. Export the trained model.\
> 16. Implement server-side ETA inference.\
> 17. Connect it to POST /route.\
> 18. Return eta_minutes in the frozen route_response.\
> 19. Add an eta_model_sanity test.\
> 20. Document dataset source, feature engineering, target, split,
>     metrics, model parameters and limitations in
>     modules/routing-eta/README.md.

That gives Person C a **complete start-to-finish ML task**, rather than
just "build an LightGBM model." It also stays consistent with the actual
project plan.
