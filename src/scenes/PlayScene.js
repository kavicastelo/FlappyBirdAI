import Phaser from 'phaser';
import { DQNAgent } from '../ai/DQNAgent.js';

export class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
        // Define key constants
        this.STATE_SIZE = 5;
        this.ACTION_SIZE = 2; // 0: Nothing, 1: Jump
    }

    create() {
        this.add.rectangle(400, 300, 800, 600, 0x87CEEB);

        // Initialize agent only once
        if (!this.agent) {
            this.agent = new DQNAgent(this.STATE_SIZE, this.ACTION_SIZE);
        }

        this.createGameObjects();
        this.setupCollisions();
        this.createUI();
        this.resetGame();
    }

    createGameObjects() {
        this.bird = this.add.image(100, 300, '__WHITE')
            .setDisplaySize(40, 30)
            .setTint(0xffd700)
            .setOrigin(0.5);
        this.physics.add.existing(this.bird);
        this.bird.body.setGravityY(1000);
        this.bird.body.setSize(4, 4);

        this.pipes = this.physics.add.group();
        this.scoreTriggers = this.physics.add.group();

        // Ground
        const ground = this.add.rectangle(400, 620, 800, 80, 0x90EE90).setAlpha(0.3);
        this.physics.add.existing(ground, true);
        this.physics.add.collider(this.bird, ground, () => this.setGameOver('ground'));
    }

    setupCollisions() {
        this.physics.add.overlap(this.bird, this.pipes, () => this.setGameOver('pipe'));
        this.physics.add.overlap(this.bird, this.scoreTriggers, this.onScore, null, this);
    }

    createUI() {
        this.scoreText = this.add.text(20, 20, 'Score: 0', { fontSize: '36px', fill: '#000', fontStyle: 'bold' });
        this.episodeText = this.add.text(20, 60, 'Episode: 0', { fontSize: '18px', fill: '#666' });
        this.epsilonText = this.add.text(20, 85, 'ε: 1.000', { fontSize: '16px', fill: '#888' });
    }

    resetGame() {
        this.episode = (this.episode || 0) + 1;
        this.score = 0;
        this.isGameOver = false;
        this.totalSteps = 0;

        // Reset Physics
        this.physics.resume();
        this.bird.setPosition(100, 300);
        this.bird.body.setVelocity(0, 0);
        this.bird.setTint(0xffd700);

        this.pipes.clear(true, true);
        this.scoreTriggers.clear(true, true);

        if (this.pipeTimer) this.pipeTimer.remove();

        // Spawn first pipe
        this.spawnPipePair(500, Phaser.Math.Between(200, 400));

        this.pipeTimer = this.time.addEvent({
            delay: 1600,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });

        this.scoreText.setText('Score: 0');
        this.episodeText.setText('Episode: ' + this.episode);

        // Initialize current state
        this.currentState = this.getState();
    }

    setGameOver(reason) {
        this.isGameOver = true;
    }

    update() {
        // If resetting, do nothing
        if (this.isResetting) return;

        // Cleanup offscreen pipes
        this.cleanupOffscreen();

        this.totalSteps++;

        // 1. FRAME SKIPPING (Training Optimization)
        // We only make decisions every X frames to stabilize input
        if (this.totalSteps % 6 !== 0 && !this.isGameOver) {
            return;
        }

        // 2. CHECK BOUNDS (Ceiling death)
        if (this.bird.y < 0) {
            this.setGameOver('ceiling');
        }

        // 3. DETERMINE REWARD & NEXT STATE
        // We calculate the reward for the *result* of the previous action (or current situation)
        let reward = 0.1; // Alive bonus

        // 4. CHECK IF DEAD
        if (this.isGameOver) {
            reward = -100; // Major penalty

            // Save this terminal experience
            // We use a dummy next state because 'done' is true
            const terminalState = Array(this.STATE_SIZE).fill(0);
            this.agent.remember(this.currentState, 0, reward, terminalState, true);

            // Train and Reset
            this.trainAndReset();
            return;
        }

        // 5. AI ACTS
        // Pass current state to Agent
        const action = this.agent.act(this.currentState);

        // Apply Action
        if (action === 1) {
            this.bird.body.velocity.y = -350;
            reward -= 0.2; // Minor penalty for flapping (encourages efficiency)
        }

        // 6. GET NEW STATE (Result of action)
        // Ideally, this should happen in the next frame, but for simple physics, 
        // calculating it here is acceptable approximation for Phaser Arcade.
        const nextState = this.getState();

        // 7. REMEMBER
        this.agent.remember(this.currentState, action, reward, nextState, false);

        // 8. UPDATE STATE FOR NEXT LOOP
        this.currentState = nextState;

        // 9. PERIODIC TRAINING
        if (this.totalSteps % 60 === 0) {
            this.agent.train(64);
            this.epsilonText.setText('ε: ' + this.agent.epsilon.toFixed(4));
        }
    }

    async trainAndReset() {
        this.isResetting = true;
        this.bird.setTint(0xff0000);
        this.physics.pause();

        // Train on the crash
        await this.agent.train(64);
        this.epsilonText.setText('ε: ' + this.agent.epsilon.toFixed(4));

        this.time.delayedCall(500, () => {
            this.isResetting = false;
            this.resetGame();
        });
    }

    getState() {
        let closestPipe = null;
        let closestDist = Infinity;

        // Find the closest pipe that is technically "in front" of the bird
        // We add bird.width to ensure we track the pipe until we have fully cleared it
        const pipes = this.pipes.getChildren();
        const birdRightEdge = this.bird.x + this.bird.width / 2;

        for (let i = 0; i < pipes.length; i++) {
            const pipe = pipes[i];
            // Only look at top pipes to avoid duplicates
            if (pipe.originY === 1) {
                const pipeRightEdge = pipe.x + pipe.width / 2;
                // Use pipe right edge for comparison so we don't switch targets mid-transit
                const dist = pipeRightEdge - (this.bird.x - this.bird.width / 2);

                if (dist > 0 && dist < closestDist) {
                    closestDist = dist;
                    closestPipe = pipe;
                }
            }
        }

        // Default values if no pipe (e.g., start of game)
        let normalizedDist = 1.0;
        let distToUpper = 0.5;
        let distToLower = 0.5;

        if (closestPipe) {
            const gapY = closestPipe.gapY; // We stored this in spawnPipePair
            normalizedDist = (closestPipe.x - this.bird.x) / 800; // Normalize

            // Distance to gap edges
            const upperY = gapY - 75; // 150 gap / 2
            const lowerY = gapY + 75;

            distToUpper = (this.bird.y - upperY) / 600;
            distToLower = (lowerY - this.bird.y) / 600;
        }

        // Normalize Inputs
        const birdY = this.bird.y / 600;
        const velocity = Phaser.Math.Clamp(this.bird.body.velocity.y / 1000, -1, 1);

        return [birdY, velocity, normalizedDist, distToUpper, distToLower];
    }

    spawnPipePair(x, gapY) {
        const pipeWidth = 70;
        const gapSize = 150;

        // --- Top Pipe ---
        const topPipe = this.pipes.create(x, gapY - gapSize / 2, '__WHITE')
            .setOrigin(0.5, 1)
            .setDisplaySize(pipeWidth, 600)
            .setTint(0x228B22);
        topPipe.body.velocity.x = -200;
        topPipe.body.immovable = true;
        topPipe.body.allowGravity = false;
        topPipe.gapY = gapY;
        topPipe.body.enable = false;

        // --- Bottom Pipe ---
        const bottomPipe = this.pipes.create(x, gapY + gapSize / 2, '__WHITE')
            .setOrigin(0.5, 0)
            .setDisplaySize(pipeWidth, 600)
            .setTint(0x228B22);
        bottomPipe.body.velocity.x = -200;
        bottomPipe.body.immovable = true;
        bottomPipe.body.allowGravity = false;
        bottomPipe.body.enable = false;

        // --- Score Trigger ---
        const trigger = this.scoreTriggers.create(x, gapY, '__WHITE')
            .setAlpha(0);
        trigger.body.setSize(20, 600);
        trigger.body.velocity.x = -200; // Should match pipe velocity
        trigger.body.allowGravity = false;
        trigger.body.enable = false;

        this.time.delayedCall(200, () => {
            if (topPipe.body) topPipe.body.enable = true;
            if (bottomPipe.body) bottomPipe.body.enable = true;
            if (trigger.body) trigger.body.enable = true;
        });
    }

    onScore(bird, trigger) {
        trigger.destroy();
        this.score++;
        this.scoreText.setText('Score: ' + this.score);
    }

    cleanupOffscreen() {
        this.pipes.getChildren().forEach(p => {
            if (p.x < -100) p.destroy();
        });
        this.scoreTriggers.getChildren().forEach(t => {
            if (t.x < -100) t.destroy();
        });
    }
}
