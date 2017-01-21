'use strict';

const fs = require('fs');
const assert = require('chai').assert;
const sourceMap = require('source-map');
const vuegister = require('../');

require('../register');

describe('vuegister', () => {
  it('base template', () => {
    const vue = require('./fixtures/basic.vue');

    assert.deepEqual(vue.data(), {msg: 'Hello'});
  });

  it('source map for vue', () => {
    let file = __dirname + '/fixtures/basic.vue';
    let vue = vuegister.load(file);
    let consumer = new sourceMap.SourceMapConsumer(vue.map);
    let testData = new Map([
      [{line: 2, column: 0}, {line: 6, column: 0, name: 'module'}],
      [{line: 4, column: 4}, {line: 8, column: 4, name: 'return'}],
      [{line: 5, column: 6}, {line: 9, column: 6, name: 'msg'}],
      [{line: 5, column: 11}, {line: 9, column: 11, name: 'Hello'}],
      [{line: 3, column: 7}, {line: 7, column: 7, name: null}],
    ]);

    testData.forEach((expected, given) => {
      Object.assign(expected, {source: file});
      assert.deepEqual(consumer.originalPositionFor(given), expected);
    });
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
