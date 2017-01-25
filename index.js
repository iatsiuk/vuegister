'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const htmlparser = require('htmlparser2');
const tokenizer = require('acorn').tokenizer;
const sourceMap = require('source-map');

const VUE_EXT = '.vue';

/**
 * Extracts text and all attributes from the script tag.
 *
 * @param {string} content - Content of the SFC file.
 * @return {object} - Returns an object of the following format:
 * {
 *    content: string, // raw text from the script tag
 *    attribs: object, // attributes from src script tag
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
 * Parses SFC.
 *
 * @param {string} file - Absolute path to the SFC.
 * @return {object} - Returns the following object:
 * {
 *    file: string,      //
 *    code: string,      //
 *    lang: string,      //
 *    mapOffset: number, //
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
 *    plugins: object, // configuration for plugins, for example:
 *                     // {
 *                     //   babel: {
 *                     //     babelrc: true,
 *                     //   },
 *                     // }
 * }
 */
function setHook(options) {
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
               {map: mapsCache.get(source), url: null} :
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
         extra: 'lang' in opts.plugins ? opts.plugins[vue.lang] : {},
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
}

/**
 * Processes given code.
 *
 * @param {string} lang - Lang attribute from the scrip tag.
 * @param {string} code - Raw text from the script tag.
 * @param {object} options - Options, an object of the following format:
 * {
 *    file: string,      // 'unknown', file name
 *    maps: boolean,     // false, provide source map
 *    mapOffset: number, // 0, map offset
 *    debug: boolean,    // false, print debug
 *    extra: object,     // {}, plugin options
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
  if (offset === undefined || offset <= 0) {
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

  // private
  _: {
    generateSourceMap,
  },
};
