# Learning ML from Flappy Bird

This project serves as an excellent "Hello World" for Reinforcement Learning (RL). It simplifies complex concepts into a visual, understandable format.

## Key Concepts You Will Learn

### 1. The Agent-Environment Loop
The core of RL is the interaction between an **Agent** (the bird) and an **Environment** (the game world).
*   **Observation**: The bird sees where the pipes are.
*   **Action**: The bird decides to jump or wait.
*   **Reward**: The environment tells the bird if that was a good idea (+0.1) or a terrible one (-100).

### 2. The "Credit Assignment" Problem
When the bird crashes, was it because of the *last* jump, or a jump it missed 3 seconds ago?
*   **Q-Learning** solves this by propagating rewards back in time. The `gamma` (discount factor) parameter determines how much future rewards matter compared to immediate ones.

### 3. Exploration vs. Exploitation
*   **Exploration**: Trying random things to see what happens. Essential at the beginning.
*   **Exploitation**: Using what you know to get the highest score. Essential for high performance.
*   **Epsilon Decay**: The mathematical way we shift from exploring to exploiting over time.

### 4. Neural Networks as Function Approximators
In simple Q-Learning, we use a table to store values for every state. But Flappy Bird has infinite possible states (continuous positions).
*   We use a **Neural Network** to *approximate* the Q-values for any given state, allowing the AI to generalize to situations it hasn't seen exactly before.

## Why Simple Projects Matter

Start small. Trying to build a self-driving car AI as your first project is overwhelming.
*   **Fast Feedback Loop**: You can see if it's working in seconds.
*   **Visual Debugging**: If the bird keeps hitting the ceiling, you know exactly what behavior to fix.
*   **Low Compute**: You can train this on a laptop in minutes, not days on a cluster.
