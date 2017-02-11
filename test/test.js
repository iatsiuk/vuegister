'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('chai').assert;
const proxy = require('proxyquire').noCallThru();
const vuegister = require('../src/vuegister');

// absolute path to fixtures folder
let dir = __dirname + '/fixtures/';


let _ = (filename, object) => {
  fs.writeFileSync(`${__dirname}/fixtures/${filename}`,
    JSON.stringify(object, null, '  '), 'utf8');
};


describe('vuegister', () => {
  describe('#extract', () => {
    let tags = ['script', 'template', 'style'];

    it('basic.vue', () => {
      let test = vuegister.extract(file('basic.vue'), tags);

      assert.deepEqual(test, file('spec/basic-extract.json'));
    });

    it('attribs.vue', () => {
      let test = vuegister.extract(file('attribs.vue'), tags);

      assert.deepEqual(test, file('spec/attribs-extract.json'));
    });

    it('one-line.vue', () => {
      let test = vuegister.extract(file('one-line.vue'), tags);

      assert.deepEqual(test, file('spec/one-line-extract.json'));
    });

    it('incorrect input', () => {
      assert.throws(() => vuegister.extract());
      assert.throws(() => vuegister.extract(null));
      assert.throws(() => vuegister.extract(''));
    });
  });

  describe('#register', () => {
    const _vuegister = proxy('../src/vuegister.js', {
      'vuegister-plugin-coffee': () => {
        return file('stub/plugin-coffee.json');
      },
      'vuegister-plugin-pug': () => {
        return file('stub/plugin-pug.json');
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
