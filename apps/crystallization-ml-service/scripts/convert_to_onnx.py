"""
Script to convert Keras model to ONNX format.

IMPORTANT: This conversion requires specific package versions due to compatibility issues.

Prerequisites:
    1. Create a new virtual environment:
       python -m venv onnx_convert_env
       
    2. Activate it:
       onnx_convert_env\Scripts\activate  (Windows)
       source onnx_convert_env/bin/activate  (Linux/Mac)
       
    3. Install compatible versions:
       pip install tensorflow==2.15.0 tf2onnx==1.15.1 onnx==1.14.1 numpy==1.24.3 protobuf==3.20.3
       
    4. Run this script:
       python scripts/convert_to_onnx.py

Alternative Docker approach:
    docker run -it --rm -v ${PWD}:/app -w /app tensorflow/tensorflow:2.15.0 bash -c "
        pip install tf2onnx onnx --quiet
        python scripts/convert_to_onnx.py
    "
"""

import os
import sys

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import warnings
warnings.filterwarnings('ignore')

import tensorflow as tf
print(f"TensorFlow version: {tf.__version__}")

try:
    import tf2onnx
    print(f"tf2onnx version: {tf2onnx.__version__}")
except ImportError:
    print("ERROR: tf2onnx not installed. Run: pip install tf2onnx")
    sys.exit(1)

import onnx
import numpy as np


def convert_keras_to_onnx(
    keras_model_path: str = 'models/best_hybrid_model.keras',
    onnx_output_path: str = 'models/crystallization_model.onnx',
    opset_version: int = 13
):
    """Convert a Keras model to ONNX format."""
    
    print("="*60)
    print("Keras to ONNX Model Conversion")
    print("="*60)
    
    print(f"\nLoading Keras model from: {keras_model_path}")
    
    if not os.path.exists(keras_model_path):
        raise FileNotFoundError(f"Keras model not found at {keras_model_path}")
    
    # Load the Keras model
    model = tf.keras.models.load_model(keras_model_path)
    print("Model loaded successfully!")
    
    # Analyze model structure
    print("\n=== Model Analysis ===")
    if isinstance(model.input, list):
        print("Multi-input model detected:")
        for i, inp in enumerate(model.input):
            print(f"  Input {i}: {inp.name}, shape={inp.shape}")
    else:
        print(f"Input: {model.input.name}, shape={model.input.shape}")
    
    if isinstance(model.output, list):
        print("Multi-output model detected:")
        for i, out in enumerate(model.output):
            print(f"  Output {i}: {out.name}, shape={out.shape}")
    else:
        print(f"Output: {model.output.name}, shape={model.output.shape}")
    
    # Build input signature
    if isinstance(model.input, list):
        input_signature = []
        for inp in model.input:
            shape = list(inp.shape)
            shape[0] = None  # Batch dimension
            name = inp.name.split(':')[0].replace('/', '_')
            input_signature.append(tf.TensorSpec(shape=shape, dtype=inp.dtype, name=name))
    else:
        shape = list(model.input.shape)
        shape[0] = None
        input_signature = [tf.TensorSpec(shape=shape, dtype=model.input.dtype, name='input')]
    
    print(f"\nConverting to ONNX (opset {opset_version})...")
    
    # Convert to ONNX
    onnx_model, _ = tf2onnx.convert.from_keras(
        model,
        input_signature=input_signature,
        opset=opset_version,
        output_path=onnx_output_path
    )
    
    print(f"\n✅ ONNX model saved to: {onnx_output_path}")
    
    # Verify
    print("\nVerifying ONNX model...")
    onnx_model = onnx.load(onnx_output_path)
    onnx.checker.check_model(onnx_model)
    print("✅ Verification passed!")
    
    # File sizes
    keras_size = os.path.getsize(keras_model_path) / (1024 * 1024)
    onnx_size = os.path.getsize(onnx_output_path) / (1024 * 1024)
    print(f"\nFile sizes: Keras={keras_size:.2f}MB, ONNX={onnx_size:.2f}MB")
    
    return onnx_output_path


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.dirname(script_dir))
    
    print(f"Working directory: {os.getcwd()}")
    
    try:
        convert_keras_to_onnx()
        print("\n✅ Conversion complete!")
        print("\nNext step:")
        print("  copy models\\crystallization_model.onnx ..\\crystallization-onnx-service\\models\\")
    except Exception as e:
        print(f"\n❌ Conversion failed: {e}")
        print("\nTroubleshooting:")
        print("1. Try using compatible package versions (see docstring above)")
        print("2. Use Docker with TensorFlow 2.15.0 image")
        print("3. Check if the model architecture is supported by ONNX")
