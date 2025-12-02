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
        this.lastPipeX = 0;
        this.passedPipes = new Set();
        this.gameOver = false;
    }

    create() {
        this.agent = new DQNAgent(4, 2);

        this.createGameObjects();
        this.setupCollisions();
        this.createUI();

        this.resetGame();
    }

    createGameObjects() {
        // Background
        this.add.rectangle(400, 300, 800, 600, 0x87CEEB);

        // Bird
        this.bird = this.add.image(100, 300, '__WHITE')
            .setDisplaySize(40, 30)
            .setTint(0xffd700)
            .setOrigin(0.5);

        this.physics.add.existing(this.bird);
        this.bird.body.setGravityY(1000);
        this.bird.body.setSize(34, 24);

        // Pipes group
        this.pipes = this.physics.add.group();

        // Ground (invisible death zone)
        const ground = this.add.rectangle(400, 620, 800, 80, 0x8B4513);
        this.physics.add.existing(ground, true); // static
        this.physics.add.collider(this.bird, ground, this.hitPipe, null, this);

        this.physics.add.collider(this.bird, ground, this.hitPipe, null, this);

        // Spawn pipes
        this.pipeTimer = this.time.addEvent({
            delay: this.pipeFrequency,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });
    }

    setupCollisions() {
        this.physics.add.overlap(this.bird, this.pipes, this.hitPipe, null, this);
    }

    createUI() {
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontSize: '32px',
            fill: '#000',
            fontStyle: 'bold'
        });

        this.episodeText = this.add.text(20, 60, 'Episode: 0', { fontSize: '18px', fill: '#000' });
        this.highScoreText = this.add.text(20, 85, 'Best: 0', { fontSize: '18px', fill: '#000' });
        this.epsilonText = this.add.text(20, 110, 'ε: 1.000', { fontSize: '16px', fill: '#555' });
    }

    addRowOfPipes() {
        const gapY = Phaser.Math.Between(150, 450); // Center of gap
        const pipeWidth = 70;

        // Top pipe
        const topPipe = this.pipes.create(850, gapY - this.pipeGap / 2, null)
            .setSize(pipeWidth, gapY - this.pipeGap / 2)
            .setOrigin(0.5, 1);
        topPipe.body.setVelocityX(-this.gameSpeed);
        topPipe.body.allowGravity = false;
        topPipe.body.immovable = true;
        topPipe.isTop = true;
        topPipe.gapY = gapY;

        this.add.rectangle(topPipe.x, topPipe.y, pipeWidth, topPipe.height * 2, 0x00ff00);

        // Bottom pipe
        const bottomY = gapY + this.pipeGap / 2;
        const bottomPipe = this.pipes.create(850, bottomY, null)
            .setSize(pipeWidth, 600 - bottomY)
            .setOrigin(0.5, 0);
        bottomPipe.body.setVelocityX(-this.gameSpeed);
        bottomPipe.body.allowGravity = false;
        bottomPipe.body.immovable = true;
        bottomPipe.gapY = gapY; // Shared!
        bottomPipe.pairId = topPipe; // Link them

        this.add.rectangle(bottomPipe.x, bottomPipe.y + bottomPipe.height / 2, pipeWidth, bottomPipe.height * 2, 0x00ff00);

        // Score trigger (invisible)
        const scoreTrigger = this.physics.add.sprite(850, gapY, null)
            .setSize(10, this.pipeGap)
            .setVisible(false);
        scoreTrigger.body.setVelocityX(-this.gameSpeed);
        scoreTrigger.body.allowGravity = false;
        scoreTrigger.gapY = gapY;
        this.physics.add.overlap(this.bird, scoreTrigger, () => {
            if (!this.passedPipes.has(scoreTrigger)) {
                this.passedPipes.add(scoreTrigger);
                this.score++;
                this.scoreText.setText('Score: ' + this.score);
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    this.highScoreText.setText('Best: ' + this.highScore);
                }
            }
        }, null, this);
    }

    update() {
        if (this.gameOver) return;

        const state = this.getState();
        const action = this.agent.act(state);

        if (action === 1) {
            this.jump();
        }

        // Clean up old pipes
        this.pipes.getChildren().forEach(pipe => {
            if (pipe.x < -100) {
                if (pipe.pairId) pipe.pairId.destroy();
                pipe.destroy();
            }
        });

        // Reward for staying alive
        let reward = 0.1;

        // Big reward for passing pipe
        // (We'll give it in overlap callback, but also check here if needed)

        const nextState = this.getState();
        const done = this.gameOver;

        if (done) reward = -100;

        this.agent.remember(state, action, reward, nextState, done);

        // Train every few steps
        if (this.time.now % 4 === 0) {
            this.agent.train(32);
        }

        // Update UI
        this.epsilonText.setText('ε: ' + this.agent.epsilon.toFixed(3));

        // Auto-restart after death
        if (done) {
            this.time.delayedCall(1000, () => this.resetGame());
        }
    }

    jump() {
        this.bird.body.setVelocityY(-380);
        // Optional: add flap animation/sound later
    }

    hitPipe() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.physics.pause();
        this.bird.setTint(0xff0000);

        // Flash effect
        this.tweens.add({
            targets: this.bird,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 5
        });
    }

    resetGame() {
        this.episode++;
        this.score = 0;
        this.gameOver = false;
        this.passedPipes.clear();

        this.bird.clearTint();
        this.bird.setPosition(100, 300);
        this.bird.body.setVelocity(0, 0);
        this.bird.alpha = 1;

        this.pipes.clear(true, true);
        this.children.list
            .filter(c => c.type === 'Sprite' && c.body && !c.body.isStatic)
            .forEach(c => c.destroy());

        this.physics.resume();

        // Start spawning pipes again
        this.pipeTimer.reset({
            delay: this.pipeFrequency,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });

        this.episodeText.setText('Episode: ' + this.episode);
        this.scoreText.setText('Score: 0');
    }

    getState() {
        let pipeDist = 1.0;
        let pipeGapY = 0.5;

        // Find the closest pipe ahead of the bird
        let closestDist = Infinity;
        let closestPipe = null;

        this.pipes.getChildren().forEach(pipe => {
            const dist = pipe.x - this.bird.x;
            if (dist > 0 && dist < closestDist) {
                closestDist = dist;
                closestPipe = pipe;
            }
        });

        if (closestPipe && closestPipe.gapY !== undefined) {
            pipeDist = closestDist / 800;
            pipeGapY = closestPipe.gapY / 600;
        }

        const birdY = this.bird.y / 600;
        const birdVel = Phaser.Math.Clamp(this.bird.body.velocity.y / 1000, -1, 1);

        return [birdY, birdVel, pipeDist, pipeGapY];
    }
}
