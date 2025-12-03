import * as tf from '@tensorflow/tfjs';

export class DQNAgent {
    constructor(stateSize, actionSize) {
        this.stateSize = stateSize;
        this.actionSize = actionSize;
        this.memory = [];
        this.gamma = 0.95;
        this.epsilon = 1.0;
        this.epsilonMin = 0.01;
        this.epsilonDecay = 0.995;
        this.learningRate = 0.001;
        this.model = this._buildModel();
    }

    _buildModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 64, inputShape: [this.stateSize], activation: 'relu' }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dense({ units: this.actionSize, activation: 'linear' }));
        model.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'meanSquaredError'
        });
        return model;
    }

    act(state) {
        if (Math.random() <= this.epsilon) {
            return Math.floor(Math.random() * this.actionSize);
        }
        return tf.tidy(() => {
            const tensor = tf.tensor2d([state]);
            const prediction = this.model.predict(tensor);
            return prediction.argMax(-1).dataSync()[0];
        });
    }

    remember(state, action, reward, nextState, done) {
        // Limit memory size to prevent browser crash
        if (this.memory.length > 50000) {
            this.memory.shift();
        }
        this.memory.push({ state, action, reward, nextState, done });
    }

    async train(batchSize = 64) {
        if (this.memory.length < batchSize) return;

        // Sample batch
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
            const idx = Math.floor(Math.random() * this.memory.length);
            batch.push(this.memory[idx]);
        }

        const states = batch.map(b => b.state);
        const nextStates = batch.map(b => b.nextState);

        // Operations inside tidy to prevent tensor leaks
        const { statesTensor, targetData } = tf.tidy(() => {
            const statesTensor = tf.tensor2d(states);
            const nextStatesTensor = tf.tensor2d(nextStates);

            const currentQs = this.model.predict(statesTensor);
            const nextQs = this.model.predict(nextStatesTensor);
            const nextQsMax = nextQs.max(-1).dataSync(); // Sync needed for JS mapping logic

            const currentQsData = currentQs.arraySync();

            // Update Q values with Bellman equation
            const targets = currentQsData.map((qValues, i) => {
                const { action, reward, done } = batch[i];
                let target = reward;
                if (!done) {
                    target = reward + this.gamma * nextQsMax[i];
                }
                qValues[action] = target;
                return qValues;
            });

            return { statesTensor: tf.keep(statesTensor), targetData: targets };
        });

        // Fit the model
        const targetsTensor = tf.tensor2d(targetData);
        await this.model.fit(statesTensor, targetsTensor, { epochs: 1, verbose: 0 });

        // Explicit clean up of tensors kept/created outside tidy
        statesTensor.dispose();
        targetsTensor.dispose();

        // Decay epsilon
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
    }
}
