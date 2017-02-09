'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('chai').assert;
const proxy = require('proxyquire').noCallThru();
const vuegister = require('../');

// absolute path to fixtures folder
let dir = __dirname + '/fixtures/';

describe('vuegister', () => {
  describe('#extract', () => {
    it('basic.vue', () => {
      let test = vuegister.extract(file('basic.vue'));

      assert.deepEqual(test, file('spec/basic-extract.json'));
    });

    it('attribs.vue', () => {
      let test = vuegister.extract(file('attribs.vue'));

      assert.deepEqual(test, file('spec/attribs-extract.json'));
    });

    it('one-line.vue', () => {
      let test = vuegister.extract(file('one-line.vue'));

      assert.deepEqual(test, file('spec/one-line-extract.json'));
    });

    it('incorrect input', () => {
      assert.throws(() => vuegister.extract());
      assert.throws(() => vuegister.extract(null));
    });
  });

  describe('#load', () => {
    it('basic.vue', () => {
      let test = vuegister.load(dir + 'basic.vue');

      assert.deepEqual(test, file('spec/basic-load.json', {dir}));
    });

    it('attribs.vue', () => {
      let test = vuegister.load(dir + 'attribs.vue');

      assert.deepEqual(test, file('spec/attribs-load.json', {dir}));
    });

    it('incorrect input', () => {
      assert.throws(() => vuegister.load());
      assert.throws(() => vuegister.load(null));
    });
  });

  describe('#register', () => {
    const _vuegister = proxy('../index.js', {
      'vuegister-plugin-coffee': (code, opts) => {
        return file('stub/plugin-coffee.json');
      },
    });

    beforeEach(() => _vuegister.register({maps: true}));

    afterEach(() => _vuegister.unregister());

    it('require test', () => {
      assert.doesNotThrow(() => require(dir + 'basic.vue'));
      assert.doesNotThrow(() => require(dir + 'attribs.vue'));
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
      assert.isFalse(_vuegister.register());
    });
  });

  describe('#unregister', () => {
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

  describe('#_processLangAttr', () => {
    const _vuegister = proxy('../index.js', {
      'vuegister-plugin-coffee': (code, opts) => {
        return true;
      },
    });

    let test = _vuegister._processLangAttr;

    it('load correct plugin', () => {
      let coffee = file('attribs-src.coffee');


      assert.doesNotThrow(() => test('coffee', coffee, {}));
      assert.isTrue(test('coffee', coffee, {}));
    });

    it('load not installed plugin', () => {
      assert.throws(() => test('golang', '', {}));
    });
  });

  describe('#_generateMap', () => {
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

  if (scope) {
    data = template(data, scope);
  }

  return path.extname(name) === '.json' ?
          JSON.parse(data) :
          data;
}

// simple template engine
function template(str, scope) {
  return str.replace(/<%(.+?)%>/g, (p1, p2) => {
    // p1..pn here is parenthesized substring matches
    p2 = p2.trim();

    if (Object.prototype.hasOwnProperty.call(scope, p2)) {
      return typeof scope[p2] === 'function' ?
            scope[p2]() :
            scope[p2];
    }

    return p1;
  });
}
