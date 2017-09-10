'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('chai').assert;
const proxy = require('proxyquire').noCallThru();
const vuegister = require('../src/vuegister');

// absolute path to fixtures folder
let dir = __dirname + '/fixtures/';

describe('vuegister', () => {
  describe('extract', () => {
    let tags = ['script', 'template', 'style'];

    it('incorrect input', () => {
      assert.throws(() => vuegister.extract());
      assert.throws(() => vuegister.extract('', false));
    });

    it('basic.vue', () => {
      let test = vuegister.extract(file('basic.vue'), tags);

      assert.deepEqual(test, file('spec/basic-extract.json'));
    });

    it('attribs.vue', () => {
      let test = vuegister.extract(file('attribs-src-coffee.vue'), tags);

      assert.deepEqual(test, file('spec/attribs-src-coffeee-extract.json'));
    });

    it('one-line.vue', () => {
      let test = vuegister.extract(file('one-line.vue'), tags);

      assert.deepEqual(test, file('spec/one-line-extract.json'));
    });

    it('nested-template.vue', () => {
      let test = vuegister.extract(file('nested-template.vue'), tags);

      assert.deepEqual(test, file('spec/nested-template-extract.json'));
    });
  });

  describe('load', () => {
    it('incorrect input', () => {
      assert.throws(() => vuegister.load());
    });

    it('basic.vue', () => {
      let test = vuegister.load(file('basic.vue'));

      assert.deepEqual(test, file('spec/basic-load.json'));
    });

    it('attribs-src-js.vue', () => {
      let name = dir + 'attribs-src-js.vue';
      let test = vuegister.load(file('attribs-src-js.vue'), name);

      assert.deepEqual(test, file('spec/attribs-src-load.json'));
    });
  });

  describe('#register', () => {
    beforeEach(() => vuegister.register({maps: true}));

    afterEach(() => vuegister.unregister());

    it('require basic.vue', () => {
      assert.doesNotThrow(() => require(dir + 'basic.vue'));
    });

    it('correct line number in err.stack', () => {
      const vue = require(dir + 'throws-error.vue');

      try {
        vue.data();
      } catch (err) {
        assert.include(err.stack, dir + 'throws-error.vue:8:11');
      }
    });

    it('false on double register() call', () => {
      assert.isFalse(vuegister.register());
    });
  });

  describe('unregister', () => {
    beforeEach(() => vuegister.register());

    it('throws error on require', () => {
      vuegister.unregister();

      assert.throws(() => require(dir + 'basic.vue'));
    });

    it('returns unloaded module id', () => {
      require(dir + 'basic.vue');

      let test = vuegister.unregister();

      assert.include(test, dir + 'basic.vue');
    });
  });

  describe('_transpile', () => {
    const _vuegister = proxy('../src/vuegister.js', {
      'vuegister-plugin-coffee': () => {
        return file('stub/plugin-coffee.json');
      },
      'vuegister-plugin-pug': () => {
        return file('stub/plugin-pug.json');
      },
    });

    let cfg = {
      maps: false,
      lang: {script: 'js', template: 'html'},
      plugins: {},
    };

    beforeEach(() => _vuegister.register({maps: true}));

    afterEach(() => _vuegister.unregister());

    it('plugin not installed', () => {
      assert.throws(() => {
        _vuegister._transpile('babel', file('basic.js'), cfg);
      });
    });

    it('plugin API for 0.2.x', () => {
      let coffee = file('attribs-src.coffee');
      let test = _vuegister._transpile('coffee', coffee, cfg);

      assert.property(test, 'data');
      assert.property(test, 'map');
    });
  });

  describe('_generateMap', () => {
    let map = (filename, offset) => {
      return vuegister._generateMap(file(filename), filename, offset);
    };

    it('no offset', () => {
      assert.throws(() => map('basic.js'));
      assert.throws(() => map('basic.js', 0));
    });

    it('basic.vue', () => {
      assert.deepEqual(map('basic.js', 5), file('spec/basic-map.json'));
    });
  });
});

// reads file from fixtures folder
function file(name, scope) {
  let data = fs.readFileSync(dir + name, 'utf8');

  if (scope) data = template(data, scope);

  return path.extname(name) === '.json' ? JSON.parse(data) : data;
}

// simple template engine
function template(str, scope) {
  return str.replace(/<%(.+?)%>/g, (p1, p2) => {
    // p1..pn here is parenthesized substring matches
    p2 = p2.trim();

    if (Object.prototype.hasOwnProperty.call(scope, p2)) {
      return typeof scope[p2] === 'function' ? scope[p2]() : scope[p2];
    }

    return p1;
  });
}
