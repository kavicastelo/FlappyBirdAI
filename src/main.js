import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene.js';

window.addEventListener('click', function unlockAudio() {
  Phaser.Sound.WebAudioSoundContext?.unlock();
  this.removeEventListener('click', unlockAudio);
}, { once: true });

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: true
    }
  },
  scene: [PlayScene]
};

const game = new Phaser.Game(config);
