'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const htmlparser = require('htmlparser2');
const tokenizer = require('acorn').tokenizer;
const sourceMap = require('source-map');

const VUE_EXT = '.vue';

/**
 * Extracts text and all attributes from the script tag, low level API
 *
 * @param {string} content - Content of the SFC file.
 * @return {object} - Returns an object of the following format:
 * {
 *    content: string, // raw text from the script tag
 *    attribs: object, // key-value pairs, attributes from the src script tag
 *    start: number,   // line number where the script begins in the SFC
 *    end: number,     // line number where the script ends in the SFC
 * }
 */
function extractScript(content) {
  if (typeof content !== 'string') {
    new TypeError('Content parameter must be a string.');
  }

  let data = content.split(/\r?\n/);
  let position = 0;
  let isScript = false;
  let parser = new htmlparser.Parser({
    onopentag(tag, attributes) {
      if (tag !== 'script') return;

      if (attributes !== undefined) {
        Object.assign(result.attribs, attributes);
      }

      isScript = true;
      result.start = position;
    },
    onclosetag(tag) {
      if (tag !== 'script') return;

      isScript = false;
      result.end = position;
    },
    ontext(text) {
      if (!isScript) return;

      result.content += text;
    },
    onerror(err) {
      throw err;
    },
  }, {decodeEntities: true});

  let result = {
    content: '',
    attribs: {},
    start: 0,
    end: 0,
  };

  while(data.length > 0) {
    position++;
    parser.write(data.shift() + os.EOL);
  }
  parser.end();

  return result;
}

/**
 * Parses SFC, high level API
 *
 * @param {string} file - Absolute path to the SFC.
 * @return {object} - Returns the following object:
 * {
 *    file: string,      // full path to SFC or absolute path to external
 *                       // script from src attribute of script tag
 *    code: string,      // text from script tag or external script
 *    lang: string,      // vulue from lang script attribute
 *    mapOffset: number, // offset is the line number where the script begins
 *                       // in the SFC minus one or zero for external script
 * }
 */
function parseVue(file) {
  let content = fs.readFileSync(file, 'utf8');
  let script = extractScript(content);
  let result = {
    file,
    code: script.content,
    lang: script.attribs.lang || '',
    mapOffset: script.start - 1,
  };

  if ('src' in script.attribs) {
    result.file = path.resolve(path.dirname(file), script.attribs.src);
    result.code = fs.readFileSync(result.file, 'utf8');
    result.mapOffset = 0;
  }

  return result;
}

/**
 * Setups hook on require *.vue extension.
 *
 * @param {object} [options] - Available options are:
 * {
 *    maps: boolean,   // generate source map
 *    plugins: object, // user configuration for plugins, for example:
 *                     // {
 *                     //   babel: {
 *                     //     babelrc: true,
 *                     //   },
 *                     // }
 * }
 * @return {boolean} - Returns true on success.
 */
function setHook(options) {
  if (VUE_EXT in require.extensions) {
    return false;
  }

  let opts = {
    maps: false,
    plugins: {},
  };

  Object.assign(opts, options);

  let mapsCache = new Map();

  if (opts.maps) {
    require('source-map-support').install({
      environment: 'node',
      handleUncaughtExceptions: false,
      retrieveSourceMap: (source) => {
        return mapsCache.has(source) ?
               {map: mapsCache.get(source), url: source} :
               null;
      },
    });
  }

  require.extensions[VUE_EXT] = (module, file) => {
    let vue = parseVue(file);
    let sourceMap = {};

    if (vue.lang) {
      let processed = processLangAttr(vue.lang, vue.code, {
         file: vue.file,
         maps: opts.maps,
         mapOffset: vue.mapOffset,
         extra: vue.lang in opts.plugins ? opts.plugins[vue.lang] : {},
      });

      vue.code = processed.code;
      sourceMap = processed.map;
    }

    if (opts.maps) {
      if (vue.mapOffset > 0 && !vue.lang) {
        sourceMap = generateSourceMap(vue.code, vue.file, vue.mapOffset);
      }

      mapsCache.set(vue.file, sourceMap);
    }

    vue.code += noTemplate();

    return module._compile(vue.code, vue.file);
  };

  return true;
}

/**
 * Removes requre hook.
 */
function removeHook() {
  if (VUE_EXT in require.extensions) {
    delete require.extensions[VUE_EXT];

    Object.keys(require.cache).forEach((key) => {
      if (path.extname(key) === VUE_EXT) {
        delete require.cache[key];
      }
    });

    if ('prepareStackTrace' in Error) {
      delete Error.prepareStackTrace;
    }
  }
}

/**
 * Passes given code to external plugin.
 *
 * @param {string} lang - Lang attribute from the scrip tag.
 * @param {string} code - Code for transpiler.
 * @param {object} options - Options, an object of the following format:
 * {
 *    file: string,      // 'unknown', file name
 *    maps: boolean,     // false, provide source map
 *    mapOffset: number, // 0, map offset
 *    extra: object,     // {}, plugin options from user
 * }
 * @return {object} - Returns the following object:
 * {
 *    code: string, // transpiled code, JavaScript
 *    map: object,  // generated source map
 * }
 */
function processLangAttr(lang, code, options) {
  let opts = {
    file: 'unknown',
    maps: false,
    mapOffset: 0,
    debug: false,
    extra: {},
  };

  Object.assign(opts, options);

  let transpiler;

  try {
    transpiler = require(`vuegister-plugin-${lang}`);
  } catch (err) {
    console.error(`Plugin vuegister-plugin-${lang} not found.`);
    console.error('To install it run:');
    console.error(`npm install --save-dev vuegister-plugin-${lang}`);

    process.exit(1);
  }

  return transpiler(code, opts);
}

/**
 * Generates source map for the JavaScript.
 *
 * @param {string} content - Content of the script tag
 * @param {string} file - The file name of the generated source.
 * @param {number} offset - Offset for script tag, usually "script.start - 1"
 * @return {object} - Returns the source map.
 */
function generateSourceMap(content, file, offset) {
  if (offset <= 0) {
    throw new RangeError('Offset parameter should be greater than zero.');
  }

  let generator = new sourceMap.SourceMapGenerator();
  let options = {
    locations: true,
    sourceType: 'module',
  };

  for (let token of tokenizer(content, options)) {
    let position = token.loc.start;

    generator.addMapping({
      source: file,
      original: {line: position.line + offset, column: position.column},
      generated: position,
      name: token.value,
    });
  }

  return generator.toJSON();
}

/**
 * Hack to suppress Vue.js warning: template or render function not defined.
 *
 * @return {string} - JavaScript code.
 */
function noTemplate() {
  let js = [
    '',
    'var __vue__options__ = (module.exports);',
    '__vue__options__.render = () => {};',
    '__vue__options__.staticRenderFns = [];',
    '',
  ];

  return js.join(os.EOL);
}

module.exports = {
  // public
  extract: extractScript,
  load: parseVue,
  register: setHook,
  unregister: removeHook,

  // private
  _: {
    generateSourceMap,
  },
};
