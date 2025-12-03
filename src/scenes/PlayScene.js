import Phaser from 'phaser';
import { DQNAgent } from '../ai/DQNAgent.js';

export class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
        this.agent = null;
        this.episode = 0;
        this.score = 0;
        this.highScore = 0;
        this.lastScore = 0;
        this.gameSpeed = 200;
        this.pipeGap = 150;
        this.pipeFrequency = 1600;
        this.gameOver = false;
        this.totalSteps = 0;
        this.pipeTimer = null;
    }

    create() {
        this.add.rectangle(400, 300, 800, 600, 0x87CEEB);

        this.agent = new DQNAgent(4, 2);
        this.agent.epsilonDecay = 0.9999; // Very slow decay — crucial for learning

        this.createGameObjects();
        this.setupCollisions();
        this.createUI();

        this.resetGame(); // This will spawn first pipe immediately
    }

    createGameObjects() {
        this.bird = this.add.image(100, 300, '__WHITE')
            .setDisplaySize(40, 30)
            .setTint(0xffd700)
            .setOrigin(0.5);
        this.physics.add.existing(this.bird);
        this.bird.body.setGravityY(1000);
        this.bird.body.setSize(34, 24);

        this.pipes = this.physics.add.group();
        this.scoreTriggers = this.physics.add.group();

        // Ground
        const ground = this.add.rectangle(400, 620, 800, 80, 0x90EE90).setAlpha(0.3);
        this.physics.add.existing(ground, true);
        this.physics.add.collider(this.bird, ground, this.hitPipe, null, this);
    }

    setupCollisions() {
        this.physics.add.overlap(this.bird, this.pipes, this.hitPipe, null, this);
        this.physics.add.overlap(this.bird, this.scoreTriggers, this.onScore, null, this);
    }

    createUI() {
        this.scoreText = this.add.text(20, 20, 'Score: 0', { fontSize: '36px', fill: '#000', fontStyle: 'bold' });
        this.highScoreText = this.add.text(20, 60, 'Best: 0', { fontSize: '20px', fill: '#333' });
        this.episodeText = this.add.text(20, 90, 'Episode: 0', { fontSize: '18px', fill: '#666' });
        this.epsilonText = this.add.text(20, 115, 'ε: 1.000', { fontSize: '16px', fill: '#888' });
    }

    // Normal random pipes (called by timer)
    addRowOfPipes() {
        this.spawnPipePair(Phaser.Math.Between(160, 440));
    }

    // Reusable function — used for first pipe AND timer
    spawnPipePair(gapY) {
        const pipeWidth = 70;

        // Top pipe
        const topPipe = this.pipes.create(850, gapY - this.pipeGap / 2, '__WHITE')
            .setOrigin(0.5, 1)
            .setDisplaySize(pipeWidth, gapY - this.pipeGap / 2)
            .setTint(0x228B22);
        topPipe.body.setVelocityX(-this.gameSpeed);
        topPipe.body.allowGravity = false;
        topPipe.body.immovable = true;
        topPipe.gapY = gapY;

        // Bottom pipe
        const bottomY = gapY + this.pipeGap / 2;
        const bottomPipe = this.pipes.create(850, bottomY, '__WHITE')
            .setOrigin(0.5, 0)
            .setDisplaySize(pipeWidth, 600 - bottomY)
            .setTint(0x228B22);
        bottomPipe.body.setVelocityX(-this.gameSpeed);
        bottomPipe.body.allowGravity = false;
        bottomPipe.body.immovable = true;
        bottomPipe.gapY = gapY;

        // Score trigger
        const trigger = this.scoreTriggers.create(850, gapY, '__WHITE')
            .setDisplaySize(1, 1)
            .setVisible(false);
        trigger.body.setSize(40, this.pipeGap);
        trigger.body.setOffset(-20, -this.pipeGap / 2);
        trigger.body.setVelocityX(-this.gameSpeed);
        trigger.body.allowGravity = false;
    }

    onScore(bird, trigger) {
        trigger.destroy();
        this.score++;
        this.scoreText.setText('Score: ' + this.score);
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreText.setText('Best: ' + this.highScore);
        }
    }

    update() {
        if (this.gameOver) return;

        this.totalSteps++;

        // Death by bounds
        if (this.bird.y < 30 || this.bird.y > 570) {
            this.hitPipe();
            return;
        }

        const state = this.getState();
        const action = this.agent.act(state);
        if (action === 1) this.jump();

        // Cleanup
        this.pipes.getChildren().forEach(p => p.x < -100 && p.destroy());
        this.scoreTriggers.getChildren().forEach(t => t.x < -100 && t.destroy());

        const nextState = this.getState();
        let reward = 0.1;
        if (this.score > this.lastScore) {
            reward += 10.0;
            this.lastScore = this.score;
        }

        const done = this.gameOver;
        if (done) reward = -100;

        this.agent.remember(state, action, reward, nextState, done);
        if (this.totalSteps % 4 === 0) {
            this.agent.train(64);
        }

        this.epsilonText.setText('ε: ' + this.agent.epsilon.toFixed(4));

        if (done) {
            this.time.delayedCall(600, () => this.resetGame());
        }
    }

    jump() {
        this.bird.body.setVelocityY(-380);
    }

    hitPipe() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.physics.pause();
        this.bird.setTint(0xff0000);
        this.time.delayedCall(600, () => this.resetGame());
    }

    // THE FIXED RESET — THIS IS THE KEY
    resetGame() {
        console.log(`Episode ${this.episode + 1} starting...`);

        this.episode++;
        this.score = 0;
        this.lastScore = 0;
        this.gameOver = false;
        this.totalSteps = 0;

        // Reset bird
        this.bird.clearTint();
        this.bird.setAlpha(1);
        this.bird.setPosition(100, 300);
        this.bird.body.setVelocity(0, 0);

        // Full cleanup
        this.pipes.clear(true, true);
        this.scoreTriggers.clear(true, true);
        if (this.pipeTimer) this.pipeTimer.remove();

        this.physics.resume();

        // CRITICAL: Spawn first pipe IMMEDIATELY with random gap
        const firstGapY = Phaser.Math.Between(180, 420);
        this.spawnPipePair(firstGapY);

        // Then start repeating timer
        this.pipeTimer = this.time.addEvent({
            delay: this.pipeFrequency,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });

        // UI
        this.scoreText.setText('Score: 0');
        this.episodeText.setText('Episode: ' + this.episode);
    }

    getState() {
        let closestDist = Infinity;
        let closestPipe = null;

        this.pipes.getChildren().forEach(pipe => {
            const dist = pipe.x - this.bird.x;
            if (dist > 0 && dist < closestDist) {
                closestDist = dist;
                closestPipe = pipe;
            }
        });

        let pipeDist = 1.0;
        let pipeGapY = 0.5;
        if (closestPipe && closestPipe.gapY !== undefined) {
            pipeDist = Math.max(0, closestDist / 800);
            pipeGapY = closestPipe.gapY / 600;
        }

        const birdY = this.bird.y / 600;
        const birdVel = Phaser.Math.Clamp(this.bird.body.velocity.y / 1200, -1, 1);

        return [birdY, birdVel, pipeDist, pipeGapY];
    }
}
