'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('chai').assert;
const vuegister = require('../');

describe('vuegister', () => {
  // helpers
  let dir = __dirname + '/fixtures/';
  let file = (name) => {
    let data = fs.readFileSync(dir + name, 'utf8');

    return path.extname(name) === '.json' ?
           JSON.parse(data) :
           data;
  };

  describe('#extractScript', () => {
    it('basic', () => {
      let given = vuegister.extract(file('basic.vue'));

      assert.deepEqual(given, file('basic-extract.json'));
    });

    it('invalid parameter', () => {
      assert.throws(() => vuegister.extract());
      assert.throws(() => vuegister.extract({}));
    });

    it('invalid vue file');

    it('script attributes', () => {
      let given = vuegister.extract(file('script-attributes.vue'));

      assert.deepEqual(given, file('script-attributes-extract.json'));
    });
  });

  describe('#parseVue', () => {
    it('basic', () => {
      let vue = vuegister.load(dir + 'basic.vue');
      let expected = file('basic-load.json');

      expected.file = path.resolve(expected.file);
      assert.deepEqual(vue, expected);
    });

    it('script attributes', () => {
      let vue = vuegister.load(dir + 'script-attributes.vue');
      let expected = file('script-attributes-load.json');

      expected.file = path.resolve(expected.file);
      assert.deepEqual(vue, expected);
    });

    it('invalid file name', () => {
      assert.throws(() => vuegister.load('my-invalid-file'));
    });
  });

  describe('#generateSourceMap', () => {
    let makeMap = (filename, offset) => {
      return vuegister._.generateSourceMap(file(filename), filename, offset);
    };

    it('no offset', () => {
      assert.throws(() => makeMap('basic.js'));
      assert.throws(() => makeMap('basic.js', 0));
    });

    it('offset', () => {
      assert.deepEqual(makeMap('basic.js', 5), file('basic-source-map.json'));
    });
  });

  describe('#register', () => {
    before(() => vuegister.register({maps: true}));

    it('basic require', () => {
      const vue = require(dir + 'basic.vue');

      assert.deepEqual(vue.data(), {msg: 'Hello'});
    });

    it('correct line number in err.stack', () => {
      const vue = require(dir + 'throw-error.vue');

      try {
        vue.data();
      } catch (err) {
        assert.include(err.stack, dir + 'throw-error.vue:8:11');
      }
    });
  });

  describe('#processLangAttr', () => {
    it('load correct plugin');
  });
});
