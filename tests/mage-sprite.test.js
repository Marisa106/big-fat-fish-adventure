'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const { CONFIG } = require('../js/core/config.js');

const MAGE = CONFIG.classes.mage;

test('mage sprite config matches the generated asset manifest', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'mage', 'mage.json'), 'utf8'));
  const def = MAGE.sprite;
  assert.ok(def, 'mage should have a sprite definition');
  assert.equal(def.frames, meta.frames);
  assert.equal(def.cols, meta.cols);
  assert.equal(def.rows, meta.rows);
  assert.equal(def.fps, meta.fps);
  assert.equal(def.impactFrame, meta.impactFrame);
  assert.equal(def.frameWidth, meta.frameWidth);
  assert.equal(def.frameHeight, meta.frameHeight);
  assert.equal(def.heightTiles, meta.heightTiles);
  assert.equal(def.feetAtTilePct, meta.feetAtTilePct);
  assert.equal(def.footFraction, meta.footFraction);
  assert.ok(def.frames > 1, 'attack animation should have multiple frames');
  assert.ok(def.frames <= def.cols * def.rows, 'sheet must have room for every frame');
  assert.ok(def.impactFrame >= 0 && def.impactFrame < def.frames, 'impact frame inside the clip');
  assert.ok(def.fps > 0 && def.playbackSpeed > 0);
  assert.ok(def.heightTiles > 0 && def.feetAtTilePct > 0 && def.feetAtTilePct < 1);
  assert.ok(def.footFraction > 0 && def.footFraction < 1);
});

test('mage sprite files exist and the original portrait is untouched', () => {
  const def = MAGE.sprite;
  ['portrait', 'icon', 'idle', 'sheet'].forEach((key) => {
    const file = path.join(ROOT, def[key]);
    assert.ok(fs.existsSync(file), key + ' file should exist: ' + def[key]);
    assert.ok(fs.statSync(file).size > 1024, key + ' file should not be empty');
  });
  const portrait = path.join(ROOT, 'assets', 'mage', 'portrait.png');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(portrait)).digest('hex');
  assert.equal(
    hash,
    '5cfcfcea3fa1e2dac4d71a0a3bbfd44324a2f88c7cdbc9081b251171135d4894',
    'portrait.png must stay byte-identical to the supplied artwork'
  );
});
