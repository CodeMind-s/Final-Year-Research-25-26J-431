#!/usr/bin/env python3
"""
Docker-compatible script to convert Keras model to ONNX.
Run with: docker run --rm -v ${PWD}:/app -w /app tensorflow/tensorflow:2.16.1 bash -c "pip install tf2onnx onnx -q && python scripts/docker_convert.py"
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("Keras to ONNX Conversion (Docker)")
print("=" * 60)

import tensorflow as tf
print(f"TensorFlow version: {tf.__version__}")

# Load model
model_path = 'models/best_hybrid_model.keras'
print(f"\nLoading model from: {model_path}")

try:
    model = tf.keras.models.load_model(model_path)
    print("Model loaded successfully!")
except Exception as e:
    print(f"ERROR loading model: {e}")
    sys.exit(1)

# Print model info
print(f"\n=== Model Info ===")
print(f"Input shape: {model.input_shape}")
print(f"Output shape: {model.output_shape}")

# Import ONNX tools
import tf2onnx
import onnx
print(f"tf2onnx version: {tf2onnx.__version__}")
print(f"onnx version: {onnx.__version__}")

# Build input signature based on actual model input
print("\n=== Building Input Signature ===")
if isinstance(model.input, list):
    input_signature = []
    for i, inp in enumerate(model.input):
        shape = list(inp.shape)
        shape[0] = None  # Batch dimension
        name = f"input_{i}"
        input_signature.append(tf.TensorSpec(shape=shape, dtype=inp.dtype, name=name))
        print(f"  Input {i}: {name} -> {shape}")
else:
    shape = list(model.input.shape)
    shape[0] = None
    input_signature = [tf.TensorSpec(shape=shape, dtype=model.input.dtype, name='input')]
    print(f"  Input: input -> {shape}")

# Convert to ONNX
output_path = 'models/crystallization_model.onnx'
print(f"\n=== Converting to ONNX ===")
print(f"Output path: {output_path}")
print("This may take a few minutes...")

try:
    model_proto, _ = tf2onnx.convert.from_keras(
        model,
        input_signature=input_signature,
        opset=15,
        output_path=output_path
    )
    print(f"\n✅ SUCCESS! Model saved to: {output_path}")
    
    # Verify the model
    print("\nVerifying ONNX model...")
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print("✅ ONNX model verification passed!")
    
    # Print file size
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nONNX model size: {size_mb:.2f} MB")
    
    # Print input/output names
    print("\nONNX Inputs:")
    for inp in onnx_model.graph.input:
        print(f"  - {inp.name}")
    print("\nONNX Outputs:")
    for out in onnx_model.graph.output:
        print(f"  - {out.name}")
        
except Exception as e:
    print(f"\n❌ ERROR during conversion: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("Conversion complete!")
print("=" * 60)
