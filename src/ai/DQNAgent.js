import * as tf from '@tensorflow/tfjs';

export class DQNAgent {
    constructor(stateSize, actionSize) {
        this.stateSize = stateSize;
        this.actionSize = actionSize;
        this.memory = [];
        this.gamma = 0.95;
        this.epsilon = 1.0;
        this.epsilonMin = 0.01;
        this.epsilonDecay = 0.999; // Slower by default
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
            const action = prediction.argMax(-1).dataSync()[0];
            tensor.dispose();
            prediction.dispose();
            return action;
        });
    }

    remember(state, action, reward, nextState, done) {
        this.memory.push({ state, action, reward, nextState, done });
        if (this.memory.length > 10000) {
            this.memory.shift();
        }
    }

    async train(batchSize = 64) {
        if (this.memory.length < batchSize) return;

        // Sample batch WITHOUT duplicates
        const indices = new Set();
        while (indices.size < batchSize && indices.size < this.memory.length) {
            indices.add(Math.floor(Math.random() * this.memory.length));
        }
        const batch = Array.from(indices).map(i => this.memory[i]);

        const states = batch.map(b => b.state);
        const actions = batch.map(b => b.action);
        const rewards = batch.map(b => b.reward);
        const nextStates = batch.map(b => b.nextState);
        const dones = batch.map(b => b.done);

        const statesTensor = tf.tensor2d(states);

        // Compute targets in tidy (SAFE!)
        const targetData = tf.tidy(() => {
            const currentQs = this.model.predict(statesTensor);
            const nextQs = this.model.predict(tf.tensor2d(nextStates));
            const nextQsMax = nextQs.max(-1);

            const currentQsData = currentQs.arraySync();
            const nextQsMaxData = nextQsMax.arraySync();

            const targets = currentQsData.map((qValues, i) => {
                let target = rewards[i];
                if (!dones[i]) {
                    target += this.gamma * nextQsMaxData[i];
                }
                qValues[actions[i]] = target;
                return qValues;
            });

            return targets; // JS array only
        });

        // Train outside tidy
        const targetsTensor = tf.tensor2d(targetData);
        await this.model.fit(statesTensor, targetsTensor, { epochs: 1, verbose: 0 });
        statesTensor.dispose();
        targetsTensor.dispose();

        // Slow epsilon decay
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
    }
}
