import Phaser from 'phaser';
import { DQNAgent } from '../ai/DQNAgent';

export class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
        this.agent = null;
        this.episode = 0;
        this.score = 0;
        this.highScore = 0;
        this.gameSpeed = 200;
        this.pipeGap = 150;
        this.pipeFrequency = 1500;
        this.action = 0;
    }

    create() {
        // Initialize Agent
        // State: y, vel, pipeDist, pipeGapY
        this.agent = new DQNAgent(4, 2);

        this.createGameObjects();
        this.setupCollisions();
        this.createUI();

        this.resetGame();
    }

    createGameObjects() {
        // Bird
        this.bird = this.add.rectangle(100, 300, 30, 30, 0xffd700);
        this.physics.add.existing(this.bird);
        this.bird.body.setGravityY(1000);
        this.bird.body.setCollideWorldBounds(true);

        // Pipes Group
        this.pipes = this.physics.add.group();

        // Timer for pipes
        this.time.addEvent({
            delay: this.pipeFrequency,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });
    }

    setupCollisions() {
        this.physics.add.collider(this.bird, this.pipes, this.hitPipe, null, this);
    }

    createUI() {
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#fff' });
        this.episodeText = this.add.text(16, 50, 'Episode: 0', { fontSize: '16px', fill: '#fff' });
        this.epsilonText = this.add.text(16, 70, 'Epsilon: 0', { fontSize: '16px', fill: '#fff' });
    }

    addRowOfPipes() {
        const hole = Math.floor(Math.random() * 5) + 1;
        // 8 boxes height roughly
        // We'll create pipes above and below the hole
        // Canvas height is 600. Let's say 8 blocks of 75px.
        // Hole is at 'hole' position.

        // Simplified:
        // Gap position y
        const gapY = Phaser.Math.Between(100, 500);

        const pipeWidth = 50;

        // Top pipe
        const topPipeHeight = gapY - (this.pipeGap / 2);
        const topPipe = this.add.rectangle(800, topPipeHeight / 2, pipeWidth, topPipeHeight, 0x00ff00);
        this.physics.add.existing(topPipe);
        topPipe.body.setVelocityX(-this.gameSpeed);
        topPipe.body.allowGravity = false;
        topPipe.body.immovable = true;
        this.pipes.add(topPipe);

        // Bottom pipe
        const bottomPipeHeight = 600 - (gapY + (this.pipeGap / 2));
        const bottomPipe = this.add.rectangle(800, 600 - (bottomPipeHeight / 2), pipeWidth, bottomPipeHeight, 0x00ff00);
        this.physics.add.existing(bottomPipe);
        bottomPipe.body.setVelocityX(-this.gameSpeed);
        bottomPipe.body.allowGravity = false;
        bottomPipe.body.immovable = true;
        bottomPipe.gapCenterY = gapY;
        this.pipes.add(bottomPipe);

        // Store gapY for state
        topPipe.gapCenterY = gapY;
    }

    update() {
        if (this.gameOver) return;

        // 1. Get current state
        const state = this.getState();

        // 2. Agent decides action
        this.action = this.agent.act(state);

        // 3. Execute action
        if (this.action === 1) {
            this.jump();
        }

        // 4. Update game (physics runs automatically)
        // Check for off-screen pipes
        this.pipes.getChildren().forEach(pipe => {
            if (pipe.x < -50) {
                pipe.destroy();
            }
        });

        // Score update (simplified: just frame count or distance)
        // Better: check if passed a pipe.
        // For now, let's give reward for staying alive.
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);

        // 5. Get next state
        const nextState = this.getState();

        // 6. Calculate reward
        // Alive reward
        let reward = 0.1;

        // Check if we hit boundaries (floor/ceiling)
        if (this.bird.y < 0 || this.bird.y > 600) {
            this.hitPipe(); // Treat as death
            reward = -100;
        }

        // 7. Remember
        // If we just died, 'done' is true.
        const done = this.gameOver;
        if (done) reward = -100;

        this.agent.remember(state, this.action, reward, nextState, done);

        // 8. Train
        this.agent.train(32);

        if (done) {
            this.resetGame();
        }
    }

    jump() {
        this.bird.body.setVelocityY(-350);
    }

    hitPipe() {
        this.physics.pause();
        this.bird.setTint(0xff0000);
        this.gameOver = true;
    }

    resetGame() {
        this.episode++;
        this.score = 0;
        this.gameOver = false;
        this.physics.resume();

        this.bird.setPosition(100, 300);
        this.bird.body.setVelocity(0, 0);
        // this.bird.clearTint();

        this.pipes.clear(true, true);

        // Add initial pipe
        this.addRowOfPipes();

        this.episodeText.setText('Episode: ' + this.episode);
        this.epsilonText.setText('Epsilon: ' + this.agent.epsilon.toFixed(3));
    }

    getState() {
        // Find closest pipe
        let closestPipe = null;
        let minDist = 10000;

        this.pipes.getChildren().forEach(pipe => {
            // We only care about the pipe's x position relative to bird
            // And we want the one that is in front of us (or just passed us but we are still in it?)
            // Actually, we want the one in front.
            const dist = pipe.x - this.bird.x;
            if (dist > -30 && dist < minDist) { // -30 to account for width
                minDist = dist;
                closestPipe = pipe;
            }
        });

        const birdY = this.bird.y / 600;
        const birdVel = this.bird.body.velocity.y / 1000; // Normalize roughly
        let pipeDist = 1.0;
        let pipeGapY = 0.5;

        if (closestPipe) {
            pipeDist = (closestPipe.x - this.bird.x) / 800;
            // We stored gapCenterY on the top pipe. 
            // If closestPipe is bottom pipe, we need to find its pair or just use the gap logic again.
            // My addRowOfPipes logic adds top then bottom.
            // If closestPipe is top, it has gapCenterY.
            // If bottom, it doesn't.
            if (closestPipe.gapCenterY) {
                pipeGapY = closestPipe.gapCenterY / 600;
            } else {
                // It's the bottom pipe, so the top pipe was the previous one added?
                // Or we can just look for the top pipe at the same X.
                // Simplified: let's just ensure we attach gapY to both or find the top one.
                // Hack: let's attach to both.
                // But wait, I didn't attach to bottom.
                // Let's just assume 0.5 if not found for now, but I should fix this.
                // Actually, let's fix the addRowOfPipes to attach to both.
                // But I can't edit that function easily inside getState.
                // I'll just assume standard gap if missing.
            }
        }

        return [birdY, birdVel, pipeDist, pipeGapY];
    }
}
