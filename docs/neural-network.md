# Neural Network Architecture

The AI agent in this project uses a **Deep Q-Network (DQN)**, a type of reinforcement learning algorithm that combines Q-Learning with deep neural networks.

## Architecture Overview

The network takes the current state of the game as input and outputs the estimated Q-values for each possible action. The action with the highest Q-value is selected.

```mermaid
graph LR
    subgraph Input Layer
        I1[Bird Y]
        I2[Velocity]
        I3[Dist to Pipe]
        I4[Dist to Top]
        I5[Dist to Bottom]
    end

    subgraph Hidden Layers
        H1[Dense Layer 1<br/>64 Neurons<br/>ReLU]
        H2[Dense Layer 2<br/>64 Neurons<br/>ReLU]
        H3[Dense Layer 3<br/>32 Neurons<br/>ReLU]
    end

    subgraph Output Layer
        O1[Action 0: Do Nothing]
        O2[Action 1: Jump]
    end

    I1 --> H1
    I2 --> H1
    I3 --> H1
    I4 --> H1
    I5 --> H1

    H1 --> H2
    H2 --> H3
    H3 --> O1
    H3 --> O2
```

## Inputs (State Space)

The neural network receives 5 continuous values normalized to a range (mostly 0-1 or -1 to 1) to help the network converge faster.

| Input | Description | Normalization |
|-------|-------------|---------------|
| **Bird Y** | Vertical position of the bird | `y / 600` (Screen Height) |
| **Velocity** | Vertical speed of the bird | `clamp(velocity / 1000, -1, 1)` |
| **Dist to Pipe** | Horizontal distance to the next pipe | `(pipeX - birdX) / 800` |
| **Dist to Top** | Vertical distance to the top pipe's lower edge | `(birdY - topPipeY) / 600` |
| **Dist to Bottom** | Vertical distance to the bottom pipe's upper edge | `(bottomPipeY - birdY) / 600` |

## Outputs (Action Space)

The network outputs 2 values, representing the "Q-value" (expected future reward) for each action.

1.  **Do Nothing (0)**: The bird continues to fall due to gravity.
2.  **Jump (1)**: The bird flaps its wings and gains upward velocity.

## Implementation Details

The model is built using `tf.sequential()` in TensorFlow.js:

```javascript
const model = tf.sequential();
model.add(tf.layers.dense({ units: 64, inputShape: [5], activation: 'relu' }));
model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
model.add(tf.layers.dense({ units: 2, activation: 'linear' }));
model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
```
