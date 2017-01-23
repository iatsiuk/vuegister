'use strict';

const fs = require('fs');
const assert = require('chai').assert;
const vuegister = require('../');

describe('vuegister', () => {
  describe('#extractScript', () => {
    let files = [
      'basic.vue',
      'script-src-attribute.vue',
      'empty-lines.vue',
    ];
    let script;

    beforeEach(() => {
      let file = __dirname + '/fixtures/' + files.shift();
      let content = fs.readFileSync(file, 'utf8');

      script = vuegister.extract(content);
    });

    it('basic.vue', () => {
      assert.isString(script.content);
      assert.lengthOf(Object.keys(script.attribs), 0);
      assert.strictEqual(script.start, 5);
      assert.strictEqual(script.end, 13);
    });

    it('script-src-attribute.vue', () => {
      assert.isString(script.content);
      assert.strictEqual(script.attribs.src, './script-src-attribute.js');
      assert.strictEqual(script.start, 7);
      assert.strictEqual(script.end, 7);
    });

    it('empty-lines.vue', () => {
      assert.isString(script.content);
      assert.lengthOf(Object.keys(script.attribs), 0);
      assert.strictEqual(script.start, 5);
      assert.strictEqual(script.end, 22);
    });
  });

  describe('#requireExtension', () => {
    before(function() {
      vuegister.register();
    });

    it('basic.vue', () => {
      const vue = require('./fixtures/basic.vue');

      assert.deepEqual(vue.data(), {msg: 'Hello'});
    });

    it('throw-error.vue', () => {
      const vue = require('./fixtures/throw-error.vue');

      let srt = __dirname + '/fixtures/throw-error.vue:8:11';

      try {
        vue.data();
      } catch (err) {
        assert.isAbove(err.stack.indexOf(srt), -1);
      }
    });
  });
});
