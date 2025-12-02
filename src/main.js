import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [PlayScene]
};

const game = new Phaser.Game(config);
