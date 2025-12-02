import * as tf from '@tensorflow/tfjs';

export class DQNAgent {
    constructor(stateSize, actionSize) {
        this.stateSize = stateSize;
        this.actionSize = actionSize;
        this.memory = [];
        this.gamma = 0.95;    // discount rate
        this.epsilon = 1.0;   // exploration rate
        this.epsilonMin = 0.01;
        this.epsilonDecay = 0.995;
        this.learningRate = 0.001;
        this.model = this._buildModel();
    }

    _buildModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: 24,
            inputShape: [this.stateSize],
            activation: 'relu'
        }));
        model.add(tf.layers.dense({
            units: 24,
            activation: 'relu'
        }));
        model.add(tf.layers.dense({
            units: this.actionSize,
            activation: 'linear'
        }));
        model.compile({
            loss: 'meanSquaredError',
            optimizer: tf.train.adam(this.learningRate)
        });
        return model;
    }

    act(state) {
        if (Math.random() <= this.epsilon) {
            return Math.floor(Math.random() * this.actionSize);
        }
        return tf.tidy(() => {
            const qs = this.model.predict(tf.tensor2d([state]));
            return qs.argMax(1).dataSync()[0];
        });
    }

    remember(state, action, reward, nextState, done) {
        this.memory.push({ state, action, reward, nextState, done });
        if (this.memory.length > 2000) {
            this.memory.shift();
        }
    }

    async train(batchSize) {
        if (this.memory.length < batchSize) return;

        const batch = [];
        // Random sampling
        for (let i = 0; i < batchSize; i++) {
            const idx = Math.floor(Math.random() * this.memory.length);
            batch.push(this.memory[idx]);
        }

        const states = batch.map(x => x.state);
        const nextStates = batch.map(x => x.nextState);

        const tfStates = tf.tensor2d(states);
        const tfNextStates = tf.tensor2d(nextStates);

        const qCurrent = this.model.predict(tfStates);
        const qNext = this.model.predict(tfNextStates);

        const x = [];
        const y = [];

        // We need to fetch data from tensors to manipulate them easily in JS
        // For performance in a real loop, we might want to keep things in tensors, 
        // but for this scale, dataSync is acceptable or we use arraySync.
        const qCurrentData = await qCurrent.array();
        const qNextData = await qNext.array();

        for (let i = 0; i < batchSize; i++) {
            const { state, action, reward, nextState, done } = batch[i];
            let target = reward;
            if (!done) {
                target = reward + this.gamma * Math.max(...qNextData[i]);
            }

            const targetVec = qCurrentData[i].slice();
            targetVec[action] = target;

            x.push(state);
            y.push(targetVec);
        }

        const xTensor = tf.tensor2d(x);
        const yTensor = tf.tensor2d(y);

        await this.model.fit(xTensor, yTensor, {
            epochs: 1,
            verbose: 0
        });

        xTensor.dispose();
        yTensor.dispose();
        tfStates.dispose();
        tfNextStates.dispose();
        qCurrent.dispose();
        qNext.dispose();

        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
    }
}
