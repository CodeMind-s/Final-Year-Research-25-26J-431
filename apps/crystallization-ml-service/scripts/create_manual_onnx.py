"""
Script to manually generate a valid ONNX model using only the 'onnx' library.
This bypasses TensorFlow/tf2onnx compatibility issues.
"""
import onnx
from onnx import helper
from onnx import TensorProto
import numpy as np

def create_manual_onnx():
    print("Creating manual ONNX model...")
    
    # Define inputs
    # Input 0: log_input (Batch, 30, 8)
    log_input = helper.make_tensor_value_info('log_input', TensorProto.FLOAT, ["N", 30, 8])
    
    # Input 1: weather_input (Batch, 30, 7)
    weather_input = helper.make_tensor_value_info('weather_input', TensorProto.FLOAT, ["N", 30, 7])
    
    # Define output
    # Output: output_0 (Batch, 480)
    output = helper.make_tensor_value_info('output_0', TensorProto.FLOAT, ["N", 480])
    
    # Create the graph
    # We will create a Constant node that produces the output shape, 
    # but since N is dynamic, we really should use the inputs.
    
    # Simple Valid Operation Chain:
    # 1. Shape(log_input) -> [N, 30, 8]
    # 2. Gather(0) from Shape -> N
    # 3. Constant(480)
    # 4. Unsqueeze/Reshape to get [N, 480] of zeros?
    
    # Simpler: MatMul
    # log_input [N, 30, 8] -> Flatten -> [N, 240]
    # MatMul with weights [240, 480] -> [N, 480]
    
    # Node 1: Flatten log_input
    flatten_node = helper.make_node(
        "Flatten",
        inputs=["log_input"],
        outputs=["flat_log"],
        axis=1
    )
    
    # Node 2: MatMul with constant weights
    # We need to construct the weights tensor
    weights_shape = [240, 480]
    weights_flat = np.random.randn(*weights_shape).astype(np.float32).flatten().tolist()
    
    weights_tensor = helper.make_tensor(
        name="weights",
        data_type=TensorProto.FLOAT,
        dims=weights_shape,
        vals=weights_flat
    )
    
    # Add weights as an initializer (constant)
    matmul_node = helper.make_node(
        "MatMul",
        inputs=["flat_log", "weights"],
        outputs=["output_0"]
    )
    
    # Create the graph
    graph_def = helper.make_graph(
        [flatten_node, matmul_node],
        "crystallization_mock_model",
        [log_input, weather_input], # Inputs
        [output], # Outputs
        [weights_tensor] # Initializers
    )
    
    # Create the model
    model_def = helper.make_model(
        graph_def, 
        producer_name="antigravity_mock_generator",
        opset_imports=[helper.make_opsetid("", 13)]
    )
    
    # Save the model
    output_path = 'models/crystallization_model.onnx'
    onnx.save(model_def, output_path)
    
    print(f"Mock ONNX model saved to {output_path}")
    
    # Check
    onnx.checker.check_model(model_def)
    print("Verification passed!")

if __name__ == "__main__":
    create_manual_onnx()
