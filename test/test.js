'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('chai').assert;
const proxy = require('proxyquire').noCallThru();
const vuegister = require('../');

describe('vuegister', () => {
  // simple template
  let _template = (string, scope) => {
    return string.replace(/<%(.+?)%>/g, (p1, p2) => {
      p2 = p2.trim();

      if (Object.prototype.hasOwnProperty.call(scope, p2)) {
        return typeof scope[p2] === 'function' ?
              scope[p2]() :
              scope[p2];
      }

      return p1;
    });
  };
  // returns absolute path to the fixtures folder
  let dir = __dirname + '/fixtures/';
  // reads files
  let file = (name, template) => {
    let data = fs.readFileSync(dir + name, 'utf8');

    if (template !== undefined) {
      data = _template(data, template);
    }

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
      let given = vuegister.extract(file('script-attribs.vue'));

      assert.deepEqual(given, file('script-attribs-extract.json'));
    });
  });

  describe('#parseVue', () => {
    it('basic', () => {
      let vue = vuegister.load(dir + 'basic.vue');

      assert.deepEqual(vue, file('basic-load.json', {dir}));
    });

    it('script attributes', () => {
      let vue = vuegister.load(dir + 'script-attribs.vue');

      assert.deepEqual(vue, file('script-attribs-load.json', {dir}));
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

    after(() => vuegister.unregister());

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
    it('load correct plugin', () => {
      const _vuegister = proxy('../index.js', {
        'vuegister-plugin-coffee': (code, opts) => {
          assert.strictEqual(file('script-attribs.coffee'), code);
          assert.deepEqual(opts, file('script-attribs-opts.json', {dir}));

          return {
            code: file('script-attribs.coffee.js'),
            map: {},
          };
        },
      });

      _vuegister.register({
        plugins: {
          coffee: {bare: true},
        },
      });

      let vue = require(dir + 'script-attribs.vue');

      assert.deepEqual(vue.data(), {msg: 'Hello world!'});

      _vuegister.unregister();
    });
  });
});
