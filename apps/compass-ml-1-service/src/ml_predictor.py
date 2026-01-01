import os
import json
import pandas as pd
import numpy as np
from pathlib import Path
from catboost import CatBoostClassifier
from datetime import datetime
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)
load_dotenv()


class SellerRecommendationPredictor:
    """
    Seller recommendation model with continuous learning using CatBoost
    """

    def __init__(self, models_dir=None):
        """Initialize the predictor with model and statistics paths"""
        if models_dir is None:
            models_dir = os.getenv('MODELS_DIR', 'models-Compass')
        
        self.models_dir = Path(models_dir)
        self.model_path = self.models_dir / 'catboost_seller_model_pricing_focused.cbm'
        self.stats_path = self.models_dir / 'seller_pricing_stats.json'
        self.global_stats_path = self.models_dir / 'global_stats.json'
        self.features_path = self.models_dir / 'catboost_features_pricing_focused.json'

        # Load model and statistics
        self.model = None
        self.seller_stats = {}
        self.global_stats = {}
        self.feature_info = {}
        
        self.load_model()
        self.load_statistics()

        logger.info(f"✓ Seller Recommendation Predictor initialized with {len(self.seller_stats)} sellers")

    def load_model(self):
        """Load the CatBoost model"""
        try:
            if os.path.exists(self.model_path):
                self.model = CatBoostClassifier()
                self.model.load_model(str(self.model_path))
                logger.info(f"Model loaded successfully from {self.model_path}")
            else:
                logger.warning(f"Model file not found at {self.model_path}")
                self.model = None
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            self.model = None

    def load_statistics(self):
        """Load seller statistics and feature info"""
        try:
            if os.path.exists(self.stats_path):
                with open(self.stats_path, 'r') as f:
                    self.seller_stats = json.load(f)
            
            if os.path.exists(self.global_stats_path):
                with open(self.global_stats_path, 'r') as f:
                    self.global_stats = json.load(f)
            
            if os.path.exists(self.features_path):
                with open(self.features_path, 'r') as f:
                    self.feature_info = json.load(f)
                    
            logger.info("Statistics loaded successfully")
        except Exception as e:
            logger.error(f"Error loading statistics: {str(e)}")

    def predict_sellers(self, input_data, top_k=5):
        """
        Get seller recommendations for given production parameters

        Args:
            input_data: Dictionary with landowner production details:
                {
                    'total_production_bags': 45000,
                    'price_per_bag': 12.5,
                    'area_sqft': 8500,
                    'season': 'summer',
                    'date': '2024-12-25'  # optional
                }
            top_k: Number of top sellers to recommend

        Returns:
            Dictionary with recommendations and metadata
        """
        if self.model is None:
            raise Exception("Model not loaded. Please ensure the model file exists.")
        
        # Prepare features
        features_df = self._prepare_features(input_data)

        # Get predictions
        probabilities = self.model.predict_proba(features_df)[0]

        # Get top K sellers
        top_k_indices = np.argsort(probabilities)[-top_k:][::-1]

        recommendations = []
        for rank, idx in enumerate(top_k_indices, 1):
            seller_id = self.model.classes_[idx]
            confidence = float(probabilities[idx])

            recommendations.append({
                'seller_id': str(seller_id),
                'confidence': confidence,
                'rank': rank
            })

        return {
            'status': 'success',
            'recommendations': recommendations,
            'input_summary': {
                'production_bags': input_data['total_production_bags'],
                'asking_price': input_data['price_per_bag'],
                'area_sqft': input_data['area_sqft'],
                'season': input_data['season'],
                'date': input_data.get('date', str(datetime.now().date()))
            },
            'timestamp': datetime.now().isoformat()
        }

    def learn_from_deal(self, deal_data):
        """
        Update model statistics after a deal is completed

        Args:
            deal_data: Dictionary with completed deal information:
                {
                    'seller_id': 'SELLER_001',
                    'price_per_bag': 12.5,
                    'total_production_bags': 45000,
                    'area_sqft': 8500,
                    'season': 'summer',
                    'date': '2024-12-25'
                }

        Returns:
            Success message with updated statistics
        """
        seller_key = str(deal_data['seller_id'])
        new_price = float(deal_data['price_per_bag'])
        new_production = float(deal_data['total_production_bags'])

        # Calculate production level
        prod_level = self._get_production_level(new_production)

        # Update seller statistics
        if seller_key in self.seller_stats:
            # Existing seller - exponential moving average (70% old, 30% new)
            alpha = 0.3
            old_stats = self.seller_stats[seller_key]

            # Update average price
            self.seller_stats[seller_key]['avg_price'] = \
                (1-alpha) * old_stats['avg_price'] + alpha * new_price

            # Update median production
            self.seller_stats[seller_key]['median_production'] = \
                (1-alpha) * old_stats['median_production'] + alpha * new_production

            # Update price for this production level
            if prod_level in old_stats['avg_price_by_prod']:
                self.seller_stats[seller_key]['avg_price_by_prod'][prod_level] = \
                    (1-alpha) * old_stats['avg_price_by_prod'][prod_level] + alpha * new_price
            else:
                self.seller_stats[seller_key]['avg_price_by_prod'][prod_level] = new_price

            update_type = "updated_existing"
        else:
            # New seller
            self.seller_stats[seller_key] = {
                'avg_price': new_price,
                'avg_price_by_prod': {prod_level: new_price},
                'median_production': new_production,
                'price_std': 0.0
            }
            update_type = "created_new"

        # Update global statistics (conservative 10% weight)
        alpha_global = 0.1
        self.global_stats['global_avg_price'] = \
            (1-alpha_global) * self.global_stats.get('global_avg_price', new_price) + alpha_global * new_price
        self.global_stats['global_median_prod'] = \
            (1-alpha_global) * self.global_stats.get('global_median_prod', new_production) + alpha_global * new_production

        # Save to disk
        self._save_statistics()

        return {
            'status': 'success',
            'update_type': update_type,
            'seller_id': seller_key,
            'updated_stats': {
                'avg_price': self.seller_stats[seller_key]['avg_price'],
                'median_production': self.seller_stats[seller_key]['median_production']
            },
            'timestamp': datetime.now().isoformat()
        }

    def _prepare_features(self, input_data):
        """Prepare feature vector from input data"""
        # Parse date
        if 'date' in input_data and input_data['date']:
            date = pd.to_datetime(input_data['date'])
        else:
            date = pd.Timestamp.now()

        # Basic features
        production = input_data['total_production_bags']
        price = input_data['price_per_bag']
        area = input_data['area_sqft']
        season = input_data['season']

        # Temporal features
        month = date.month
        quarter = (date.month - 1) // 3 + 1

        # Derived features
        price_per_sqft = price / (area + 1)
        bags_per_sqft = production / (area + 1)

        # Production level
        prod_level = self._get_production_level(production)

        # Price level
        if price <= 10:
            price_level = 'low_price'
        elif price <= 13:
            price_level = 'medium_price'
        else:
            price_level = 'high_price'

        # Area level
        if area <= 5000:
            area_level = 'small'
        elif area <= 10000:
            area_level = 'medium'
        elif area <= 20000:
            area_level = 'large'
        else:
            area_level = 'very_large'

        # Seller features (use global stats as default)
        seller_avg_price_for_tier = self.global_stats.get('global_avg_price', 12.0)
        seller_median_production = self.global_stats.get('global_median_prod', 50000.0)
        seller_price_consistency = self.global_stats.get('global_price_std', 1.5)
        production_diff_from_seller_pref = abs(production - seller_median_production)
        price_vs_seller_avg = price - seller_avg_price_for_tier

        # Create DataFrame with all features in correct order
        features = {
            'total_production_bags': production,
            'price_per_bag': price,
            'area_sqft': area,
            'month': month,
            'price_per_sqft': price_per_sqft,
            'bags_per_sqft': bags_per_sqft,
            'seller_avg_price_for_tier': seller_avg_price_for_tier,
            'seller_median_production': seller_median_production,
            'seller_price_consistency': seller_price_consistency,
            'production_diff_from_seller_pref': production_diff_from_seller_pref,
            'price_vs_seller_avg': price_vs_seller_avg,
            'season': season,
            'production_level': prod_level,
            'price_level': price_level,
            'area_level': area_level,
            'quarter': quarter
        }

        return pd.DataFrame([features])

    def _get_production_level(self, production):
        """Get production level category"""
        if production <= 20000:
            return 'very_low'
        elif production <= 35000:
            return 'low'
        elif production <= 50000:
            return 'medium'
        elif production <= 65000:
            return 'high'
        elif production <= 80000:
            return 'very_high'
        else:
            return 'extremely_high'

    def _save_statistics(self):
        """Save updated statistics to disk"""
        try:
            # Ensure directory exists
            self.models_dir.mkdir(parents=True, exist_ok=True)
            
            with open(self.stats_path, 'w') as f:
                json.dump(self.seller_stats, f, indent=2)

            with open(self.global_stats_path, 'w') as f:
                json.dump(self.global_stats, f, indent=2)
            
            logger.info("Statistics saved successfully")
        except Exception as e:
            logger.error(f"Error saving statistics: {str(e)}")
            raise
