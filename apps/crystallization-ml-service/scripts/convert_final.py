"""
Final conversion script for multi-input Keras model.
Run with Docker:
docker run --rm -v ${PWD}:/app -w /app tensorflow/tensorflow:2.15.0 bash -c "pip install tf2onnx onnx -q && python scripts/convert_final.py"
"""
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import tensorflow as tf
import tf2onnx
import onnx
import sys

def convert():
    print("Loading model...")
    model_path = 'models/best_hybrid_model.keras'
    model = tf.keras.models.load_model(model_path)
    
    print("Model Input Config:")
    input_signature = []
    
    # We know the specific structure now from inspection
    # Input 0: log_input (None, 30, 8)
    # Input 1: weather_input (None, 30, 7)
    
    # Construct precise signature based on model.input
    if isinstance(model.input, list):
        for i, inp in enumerate(model.input):
            shape = list(inp.shape)
            shape[0] = None # dynamic batch
            name = inp.name.split(':')[0]
            print(f"  Input {i}: {name} {shape} {inp.dtype}")
            input_signature.append(tf.TensorSpec(shape, inp.dtype, name=name))
    else:
        print("Unexpected single input model")
        return

    output_path = 'models/crystallization_model.onnx'
    
    print(f"Converting to {output_path}...")
    tf2onnx.convert.from_keras(
        model, 
        input_signature=input_signature, 
        opset=15, 
        output_path=output_path
    )
    print("Conversion successful!")

if __name__ == '__main__':
    convert()
