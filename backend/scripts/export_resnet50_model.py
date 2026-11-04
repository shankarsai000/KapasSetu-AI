"""
Export a lightweight ResNet50 ONNX model for automatic backbone escalation testing:
Input: [batch, 3, 224, 224] (float32)
Output: [batch, 3] (float32) -> logits for [Good, Medium, Poor]
"""

from pathlib import Path
import numpy as np
import onnx
from onnx import TensorProto, helper


def build_resnet50_grading_onnx(output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)

    input_shape = [1, 3, 224, 224]
    output_shape = [1, 3]

    input_tensor = helper.make_tensor_value_info('input', TensorProto.FLOAT, input_shape)
    output_tensor = helper.make_tensor_value_info('logits', TensorProto.FLOAT, output_shape)

    # Fast 7x7 conv stride 2, pool, linear 3
    w_conv = np.random.normal(0, 0.05, (32, 3, 7, 7)).astype(np.float32)
    b_conv = np.zeros(32, dtype=np.float32)
    w_conv_tensor = helper.make_tensor('w_conv', TensorProto.FLOAT, [32, 3, 7, 7], w_conv.flatten())
    b_conv_tensor = helper.make_tensor('b_conv', TensorProto.FLOAT, [32], b_conv)

    conv_node = helper.make_node(
        'Conv',
        inputs=['input', 'w_conv', 'b_conv'],
        outputs=['conv_out'],
        kernel_shape=[7, 7],
        pads=[3, 3, 3, 3],
        strides=[2, 2]
    )

    relu_node = helper.make_node('Relu', inputs=['conv_out'], outputs=['relu_out'])
    pool_node = helper.make_node('GlobalAveragePool', inputs=['relu_out'], outputs=['pool_out'])
    flatten_node = helper.make_node('Flatten', inputs=['pool_out'], outputs=['flat_out'], axis=1)

    w_fc = np.random.normal(0, 0.05, (32, 3)).astype(np.float32)
    b_fc = np.array([2.8, 1.4, 0.2], dtype=np.float32)
    w_fc_tensor = helper.make_tensor('w_fc', TensorProto.FLOAT, [32, 3], w_fc.flatten())
    b_fc_tensor = helper.make_tensor('b_fc', TensorProto.FLOAT, [3], b_fc.flatten())

    gemm_node = helper.make_node(
        'Gemm',
        inputs=['flat_out', 'w_fc', 'b_fc'],
        outputs=['logits'],
        alpha=1.0,
        beta=1.0,
        transA=0,
        transB=0
    )

    graph_def = helper.make_graph(
        nodes=[conv_node, relu_node, pool_node, flatten_node, gemm_node],
        name='cotton_resnet50_escalation_model',
        inputs=[input_tensor],
        outputs=[output_tensor],
        initializer=[w_conv_tensor, b_conv_tensor, w_fc_tensor, b_fc_tensor]
    )

    model_def = helper.make_model(graph_def, producer_name='kapassetu_ai')
    model_def.ir_version = 10
    model_def.opset_import[0].version = 17
    onnx.checker.check_model(model_def)
    onnx.save(model_def, str(output_path))
    print(f"ResNet50 ONNX escalation model generated at: {output_path}")


if __name__ == '__main__':
    target = Path(__file__).resolve().parent.parent / 'backend' / 'models' / 'cotton_grading_resnet50.onnx'
    build_resnet50_grading_onnx(target)
