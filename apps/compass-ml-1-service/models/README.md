# Model Files Directory

This directory should contain the trained CatBoost model and associated statistics files:

## Required Files

1. **catboost_seller_model_pricing_focused.cbm**
   - Trained CatBoost classifier model
   - Used to predict seller recommendations

2. **seller_pricing_stats.json**
   - Seller-specific pricing and production statistics
   - Updated through continuous learning

3. **global_stats.json**
   - Global market statistics
   - Used as fallback for new sellers

4. **catboost_features_pricing_focused.json**
   - Feature configuration and metadata
   - Documents which features the model expects

## Note

These files should be generated from your seller recommendation model training notebook/script. The service will load these files at startup and update the statistics files as deals are completed.
