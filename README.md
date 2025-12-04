# Flappy Bird AI

A Flappy Bird clone built with **Phaser 3** that learns to play itself using **Deep Q-Learning (DQN)** powered by **TensorFlow.js**.

## 🚀 Features

- **Game Engine**: Built using [Phaser 3](https://phaser.io/), a fast and robust HTML5 game framework.
- **AI Agent**: Implements a Deep Q-Network (DQN) agent that learns from trial and error.
- **Neural Network**: Uses [TensorFlow.js](https://www.tensorflow.org/js) for the underlying neural network and training.
- **Accelerated Training**: Includes frame skipping and experience replay to speed up the learning process.
- **Real-time Visualization**: Watch the AI learn and improve its score over time.

## 🛠️ Tech Stack

- **Phaser 3**: Game logic, physics, and rendering.
- **TensorFlow.js**: Neural network creation, training, and inference.
- **Vite**: Fast development server and bundler.

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/kavicastelo/FlappyBirdAI
    cd FlappyBirdAI
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## 🎮 Usage

1.  **Start the development server**:
    ```bash
    npm run dev
    ```

2.  **Open your browser**:
    Navigate to the URL shown in the terminal (usually `http://localhost:5173`).

3.  **Watch it learn**:
    The bird will start playing automatically. Initially, it will make random moves (exploration). As it plays more episodes, it will learn to navigate the pipes (exploitation).

## 🧠 How it Works

### State Representation
The AI observes the environment through 5 inputs:
1.  **Bird Y**: Vertical position of the bird.
2.  **Velocity**: Vertical velocity of the bird.
3.  **Distance to Pipe**: Horizontal distance to the next pipe.
4.  **Distance to Upper Gap**: Vertical distance to the top pipe's edge.
5.  **Distance to Lower Gap**: Vertical distance to the bottom pipe's edge.

### Action Space
The agent can take one of two actions:
- **0**: Do nothing.
- **1**: Jump (Flap).

### Training Process
- **Experience Replay**: The agent stores its experiences (State, Action, Reward, Next State) in a memory buffer.
- **Training**: Periodically, it samples a batch of experiences from memory to train the neural network.
- **Epsilon-Greedy Strategy**: The agent balances exploration (random actions) and exploitation (using the model) using an `epsilon` value that decays over time.

## 📂 Project Structure

- `src/main.js`: Entry point, initializes the Phaser game.
- `src/scenes/PlayScene.js`: Main game loop, handles physics, collisions, and rewards.
- `src/ai/DQNAgent.js`: The DQN agent implementation using TensorFlow.js.

## 📜 License

[MIT](LICENSE)
