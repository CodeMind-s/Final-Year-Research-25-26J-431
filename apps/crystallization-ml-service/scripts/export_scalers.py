"""
Script to export pickle-based scalers to JSON format for Node.js consumption.

Usage:
    cd apps/crystallization-ml-service
    python scripts/export_scalers.py
"""

import os
import pickle
import json
import sys

def export_scaler_to_json(pickle_path: str, json_path: str):
    """
    Export a sklearn StandardScaler or similar scaler to JSON format.
    
    Args:
        pickle_path: Path to the pickle file
        json_path: Path where JSON will be saved
    """
    if not os.path.exists(pickle_path):
        print(f"⚠️ Skipping {pickle_path} - file not found")
        return False
    
    print(f"Loading: {pickle_path}")
    
    with open(pickle_path, 'rb') as f:
        scaler = pickle.load(f)
    
    # Extract scaler parameters based on type
    scaler_params = {
        'type': type(scaler).__name__,
    }
    
    # Handle StandardScaler
    if hasattr(scaler, 'mean_') and hasattr(scaler, 'scale_'):
        scaler_params['mean'] = scaler.mean_.tolist() if hasattr(scaler.mean_, 'tolist') else list(scaler.mean_)
        scaler_params['scale'] = scaler.scale_.tolist() if hasattr(scaler.scale_, 'tolist') else list(scaler.scale_)
        scaler_params['var'] = scaler.var_.tolist() if hasattr(scaler, 'var_') and hasattr(scaler.var_, 'tolist') else None
        scaler_params['n_features_in'] = int(scaler.n_features_in_) if hasattr(scaler, 'n_features_in_') else None
    
    # Handle MinMaxScaler
    elif hasattr(scaler, 'min_') and hasattr(scaler, 'scale_'):
        scaler_params['min'] = scaler.min_.tolist() if hasattr(scaler.min_, 'tolist') else list(scaler.min_)
        scaler_params['scale'] = scaler.scale_.tolist() if hasattr(scaler.scale_, 'tolist') else list(scaler.scale_)
        scaler_params['data_min'] = scaler.data_min_.tolist() if hasattr(scaler, 'data_min_') else None
        scaler_params['data_max'] = scaler.data_max_.tolist() if hasattr(scaler, 'data_max_') else None
    
    # Handle other types - try to serialize all attributes
    else:
        print(f"  Unknown scaler type: {type(scaler).__name__}")
        # Try to get all numeric attributes
        for attr in dir(scaler):
            if not attr.startswith('_') and not callable(getattr(scaler, attr)):
                try:
                    value = getattr(scaler, attr)
                    if hasattr(value, 'tolist'):
                        scaler_params[attr] = value.tolist()
                    elif isinstance(value, (int, float, str, bool, list)):
                        scaler_params[attr] = value
                except Exception:
                    pass
    
    # Save to JSON
    with open(json_path, 'w') as f:
        json.dump(scaler_params, f, indent=2)
    
    print(f"  Exported to: {json_path}")
    print(f"  Type: {scaler_params['type']}")
    
    return True


def export_production_series(pickle_path: str, json_path: str):
    """
    Export the production series data to JSON.
    """
    if not os.path.exists(pickle_path):
        print(f"⚠️ Skipping {pickle_path} - file not found")
        return False
    
    print(f"Loading: {pickle_path}")
    
    with open(pickle_path, 'rb') as f:
        series = pickle.load(f)
    
    # Convert to JSON-serializable format
    if hasattr(series, 'tolist'):
        data = series.tolist()
    elif hasattr(series, 'to_dict'):
        data = series.to_dict()
    elif hasattr(series, 'values'):
        data = {'values': series.values.tolist(), 'index': series.index.tolist()}
    else:
        data = list(series)
    
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"  Exported to: {json_path}")
    
    return True


def main():
    # Change to crystallization-ml-service directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.dirname(script_dir))
    
    models_dir = 'models'
    
    print("="*50)
    print("Exporting Scalers to JSON")
    print("="*50)
    
    # Export scalers
    scalers = [
        ('weather_scaler.pkl', 'weather_scaler.json'),
        ('log_scaler.pkl', 'log_scaler.json'),
    ]
    
    for pickle_name, json_name in scalers:
        pickle_path = os.path.join(models_dir, pickle_name)
        json_path = os.path.join(models_dir, json_name)
        export_scaler_to_json(pickle_path, json_path)
    
    # Export production series
    print("\n" + "-"*50)
    print("Exporting Production Series")
    print("-"*50)
    
    export_production_series(
        os.path.join(models_dir, 'production_series.pkl'),
        os.path.join(models_dir, 'production_series.json')
    )
    
    print("\n" + "="*50)
    print("Export complete!")
    print("="*50)
    
    # List exported files
    print("\nExported files:")
    for f in os.listdir(models_dir):
        if f.endswith('.json'):
            size = os.path.getsize(os.path.join(models_dir, f))
            print(f"  {f} ({size} bytes)")


if __name__ == '__main__':
    main()
