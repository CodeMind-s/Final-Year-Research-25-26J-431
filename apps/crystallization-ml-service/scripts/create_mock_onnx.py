"""
Script to generate a mock ONNX model for crystallization service.
This allows the service to run even if the Keras model conversion fails.
"""
import onnx
from onnx import helper
from onnx import TensorProto

def create_mock_model():
    print("Creating mock ONNX model...")
    
    # Define inputs matching the real model
    # Input 0: log_input (Batch, 30, 8)
    log_input = helper.make_tensor_value_info('log_input', TensorProto.FLOAT, [None, 30, 8])
    
    # Input 1: weather_input (Batch, 30, 7)
    weather_input = helper.make_tensor_value_info('weather_input', TensorProto.FLOAT, [None, 30, 7])
    
    # Define output matching the real model (Batch, 480)
    # 480 = 60 days * 8 parameters
    output = helper.make_tensor_value_info('output_0', TensorProto.FLOAT, [None, 480])
    
    # Create a node (Identity doesn't change shape, so we need something that changes shape)
    # We'll just create a constant output for now to keep it simple and valid
    
    # Since ONNX requires valid ops, we'll try to do something valid but simple.
    # We will ignore inputs and return a constant tensor of correct shape.
    # But batch size is dynamic...
    
    # Let's make a model that takes (N, 30, 8) -> Reduces to (N, 1, 1) -> Expands to (N, 480) ? Too complex.
    # Let's just define the graph inputs/outputs and leave the body empty? No, invalid.
    
    # Simple valid graph: 
    # Flatten log_input -> (N, 240)
    # Flatten weather_input -> (N, 210)
    # Concat -> (N, 450)
    # Pad -> (N, 480)
    
    # Flatten node for log_input
    flatten_log = helper.make_node("Flatten", ["log_input"], ["flat_log"], axis=1)
    
    # Flatten node for weather_input
    flatten_weather = helper.make_node("Flatten", ["weather_input"], ["flat_weather"], axis=1)
    
    # Concat
    concat = helper.make_node("Concat", ["flat_log", "flat_weather"], ["concatenated"], axis=1)
    
    # Pad to reach 480 (240 + 210 = 450, need 30 more)
    # We need a constant pad
    # This is getting complicated to construct manually.
    
    # EASIER: Just use sklearn-onnx or similar if available? No.
    # Let's use `tf2onnx` to convert a TENSORFLOW function that defines this dummy behavior!
    pass

import tensorflow as tf
import tf2onnx

def create_tf_dummy():
    print("Creating dummy TensorFlow model...")
    
    # Define functional model with explicit inputs
    input_log = tf.keras.Input(shape=(30, 8), name='log_input')
    input_weather = tf.keras.Input(shape=(30, 7), name='weather_input')
    
    # Simple logic: Flatten and dense projection to 480 output
    x1 = tf.keras.layers.Flatten()(input_log)
    x2 = tf.keras.layers.Flatten()(input_weather)
    x = tf.keras.layers.Concatenate()([x1, x2])
    output = tf.keras.layers.Dense(480, name='output_0')(x)
    
    model = tf.keras.Model(inputs=[input_log, input_weather], outputs=output)
    
    print("Converting dummy model to ONNX...")
    input_signature = [
        tf.TensorSpec([None, 30, 8], tf.float32, name='log_input'),
        tf.TensorSpec([None, 30, 7], tf.float32, name='weather_input')
    ]
    
    tf2onnx.convert.from_keras(
        model, 
        input_signature=input_signature, 
        opset=15, 
        output_path='models/crystallization_model.onnx'
    )
    print("Mock model created successfully at models/crystallization_model.onnx")

if __name__ == "__main__":
    create_tf_dummy()
