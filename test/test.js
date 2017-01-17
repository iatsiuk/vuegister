'use strict';

const fs = require('fs');
const assert = require('chai').assert;
const sourceMap = require('source-map');
const mapConverter = require('convert-source-map');
const vuegister = require('../');

require('../register');

describe('vuegister', () => {
  it('base template', () => {
    const vue = require('./fixtures/basic.vue');

    assert.deepEqual(vue.data(), {msg: 'Hello'});
  });

  it('source map for vue', () => {
    process.env.NODE_ENV = 'development';

    let file = __dirname + '/fixtures/basic.vue';
    let script = vuegister.load(file);
    let comment = script.content.split(/\r?\n/).pop();
    let map = mapConverter.fromComment(comment).toObject();
    let consumer = new sourceMap.SourceMapConsumer(map);
    let testData = new Map([
      [1, 5],
      [5, 9],
      [9, 13],
    ]);

    testData.forEach((expected, given) => {
      let position = consumer.originalPositionFor({line: given, column: 0});

      assert.strictEqual(position.line, expected);
      assert.strictEqual(position.source, file);
    });

    delete process.env.NODE_ENV;
  });

  it('script src attribute', () => {
    const vue = require('./fixtures/script-src-attribute.vue');

    assert.deepEqual(vue.data(), {msg: 'Hello'});
  });

  it('one line script', () => {
    let file = __dirname + '/fixtures/one-line-script.vue';
    let content = fs.readFileSync(file, 'utf8');
    let script = vuegister.parse(content);

    assert.strictEqual(script.start, 11);
    assert.strictEqual(script.end, 11);
    assert.strictEqual(script.content.split(/\r?\n/).length, 1);
  });

  it('empty lines', () => {
    let file = __dirname + '/fixtures/empty-lines.vue';
    let content = fs.readFileSync(file, 'utf8');
    let script = vuegister.parse(content);

    assert.strictEqual(script.start, 5);
    assert.strictEqual(script.end, 22);
    assert.strictEqual(script.content.split(/\r?\n/).length, 18);
  });
});
