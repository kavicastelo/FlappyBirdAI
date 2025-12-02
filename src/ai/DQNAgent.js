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

        const batch = this.memory
            .sort(() => Math.random() - 0.5)
            .slice(0, batchSize);

        await tf.tidy(async () => {
            const states = tf.tensor2d(batch.map(m => m.state));
            const nextStates = tf.tensor2d(batch.map(m => m.nextState));

            const qCurrent = this.model.predict(states);
            const qNext = this.model.predict(nextStates);

            const qCurrentData = await qCurrent.array();
            const qNextData = await qNext.array();

            const x = [];
            const y = [];

            batch.forEach((exp, i) => {
                let target = exp.reward;
                if (!exp.done) {
                    const maxQ = Math.max(...qNextData[i]);
                    target += this.gamma * maxQ;
                }

                const targetF = qCurrentData[i].slice();
                targetF[exp.action] = target;
                x.push(exp.state);
                y.push(targetF);
            });

            await this.model.fit(tf.tensor2d(x), tf.tensor2d(y), {
                epochs: 1,
                verbose: 0
            });
        });

        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
    }
}
