"""
Alternative ONNX conversion using concrete functions.
This script works around tf2onnx compatibility issues with TensorFlow 2.20+
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("Keras to ONNX Conversion (Alternative Method)")
print("=" * 60)

import tensorflow as tf
import numpy as np
print(f"TensorFlow version: {tf.__version__}")

# Load model
model_path = 'models/best_hybrid_model.keras'
print(f"\nLoading model from: {model_path}")

model = tf.keras.models.load_model(model_path)
print("Model loaded successfully!")
print(f"Input shape: {model.input_shape}")
print(f"Output shape: {model.output_shape}")

# Try alternative export methods
print("\n=== Attempting ONNX Export ===")

# Method 1: Try using tf.saved_model format with tf2onnx CLI later
print("\n1. Creating SavedModel with explicit signature...")
saved_model_path = 'models/saved_model_for_onnx'

# Define explicit input signature
if isinstance(model.input, list):
    # Multi-input model
    input_shapes = []
    for inp in model.input:
        shape = list(inp.shape)
        shape[0] = 1  # Set batch size to 1
        input_shapes.append(shape)
    print(f"  Multi-input model with shapes: {input_shapes}")
else:
    # Single input
    shape = list(model.input.shape)
    shape[0] = 1
    print(f"  Single input with shape: {shape}")

# Export to SavedModel format
try:
    # Create a simple wrapper
    @tf.function(input_signature=[tf.TensorSpec(shape=[None, 1, 8], dtype=tf.float32, name='input')])
    def serve_fn(x):
        return model(x)
    
    # Save the model
    tf.saved_model.save(
        model, 
        saved_model_path,
        signatures={'serving_default': serve_fn}
    )
    print(f"  ✅ SavedModel exported to: {saved_model_path}")
except Exception as e:
    print(f"  ❌ SavedModel export failed: {e}")
    
    # Try using model.export
    try:
        model.export(saved_model_path)
        print(f"  ✅ Model exported using model.export() to: {saved_model_path}")
    except Exception as e2:
        print(f"  ❌ model.export() also failed: {e2}")
        sys.exit(1)

# Method 2: Try tf2onnx with the saved model
print("\n2. Converting SavedModel to ONNX...")
try:
    import tf2onnx
    import onnx
    
    print(f"  tf2onnx version: {tf2onnx.__version__}")
    
    # Use subprocess to call tf2onnx CLI
    import subprocess
    result = subprocess.run([
        sys.executable, '-m', 'tf2onnx.convert',
        '--saved-model', saved_model_path,
        '--output', 'models/crystallization_model.onnx',
        '--opset', '15'
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("  ✅ ONNX conversion successful!")
        print(f"  Output: {result.stdout}")
    else:
        print(f"  ❌ ONNX conversion failed:")
        print(f"  {result.stderr}")
        
        # Method 3: Manual ONNX creation approach
        print("\n3. Trying direct from_keras conversion...")
        
        # Patch the model to be compatible
        class SimpleWrapper(tf.keras.Model):
            def __init__(self, original_model):
                super().__init__()
                self.original_model = original_model
            
            @tf.function(input_signature=[tf.TensorSpec(shape=[None, 1, 8], dtype=tf.float32)])
            def call(self, x):
                return self.original_model(x)
        
        wrapped = SimpleWrapper(model)
        wrapped.build(input_shape=(None, 1, 8))
        
        # Try conversion with wrapped model
        input_sig = [tf.TensorSpec(shape=[None, 1, 8], dtype=tf.float32, name='input')]
        
        model_proto, _ = tf2onnx.convert.from_keras(
            wrapped,
            input_signature=input_sig,
            opset=15,
            output_path='models/crystallization_model.onnx'
        )
        print("  ✅ Direct conversion successful!")
        
except Exception as e:
    print(f"  ❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Verify the ONNX model if it exists
onnx_path = 'models/crystallization_model.onnx'
if os.path.exists(onnx_path):
    print("\n=== Verifying ONNX Model ===")
    import onnx
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("✅ ONNX model verification passed!")
    
    size_mb = os.path.getsize(onnx_path) / (1024 * 1024)
    print(f"ONNX model size: {size_mb:.2f} MB")
    
    print("\nONNX Inputs:")
    for inp in onnx_model.graph.input:
        print(f"  - {inp.name}")
    print("\nONNX Outputs:")
    for out in onnx_model.graph.output:
        print(f"  - {out.name}")
else:
    print("\n❌ ONNX model was not created")
    sys.exit(1)

print("\n" + "=" * 60)
print("Conversion complete!")
print("=" * 60)
