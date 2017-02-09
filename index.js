'use strict';

/** @module vuegister */

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
 * @alias module:vuegister
 * @param {string} content - Content of the SFC file.
 * @return {object} Returns an object of the following format:
 * ```js
 * {
 *   content: string, // raw text from the script tag
 *   attribs: object, // key-value pairs, attributes from the src script tag
 *   start: number,   // line number where the script begins in the SFC
 *   end: number,     // line number where the script ends in the SFC
 * }
 * ```
 */
function extract(content) {
  if (typeof content !== 'string') {
    throw new TypeError('Content parameter must be a string.');
  }

  let getLine = (index, lines) => {
    for (let i = 0; i < lines.length; i++) {
      if (index < lines[i]) return i + 1;
    }

    return lines.length + 1;
  };

  let nl = /\r?\n/g;
  let lines = [];

  while (nl.test(content)) {
    lines.push(nl.lastIndex - 1);
  }

  let parser = new htmlparser.Parser({
    onopentag(tag, attribs) {
      if (tags.indexOf(tag) === -1) return;

      result[tag].attribs = attribs;
      textIndex = parser.endIndex + 1;
    },
    onclosetag(tag) {
      if (tags.indexOf(tag) === -1) return;

      result[tag].content = content.substring(textIndex, parser.startIndex);
      result[tag].start = getLine(textIndex - 1, lines);
      result[tag].end = getLine(parser.startIndex, lines);
    },
    onerror(err) {
      /* istanbul ignore next */
      throw err;
    },
  }, {decodeEntities: true});

  let tags = ['script', 'template'];
  let textIndex = 0;

  let result = {
    template: {},
    script: {},
  };

  parser.parseComplete(content);

  return result;
}

/**
 * Parses SFC, high level API
 *
 * @alias module:vuegister
 * @param {string} file - Absolute path to the SFC.
 * @return {object} Returns the following object:
 * ```js
 * {
 *   file: string,      // full path to the SFC or absolute path to the external
 *                      // script from src attribute of script tag
 *   code: string,      // text from the script tag or external script
 *   lang: string,      // value from the lang script attribute
 *   mapOffset: number, // line number where the script begins in the SCF minus
 *                      // one or zero for external script
 * }
 * ```
 */
function load(file) {
  let content = fs.readFileSync(file, 'utf8');
  let tags = extract(content);
  let result = {};

  for (let key of Object.keys(tags)) {
    let tag = tags[key];
    let hasSrc = 'src' in tag.attribs;

    if (hasSrc) {
      file = path.resolve(path.dirname(file), tag.attribs.src);
    }

    result[key] = {
      file: file,
      text: hasSrc ? fs.readFileSync(file, 'utf8') : tag.content,
      lang: tag.attribs.lang || '',
      mapOffset: hasSrc ? 0 : tag.start - 1,
    };
  }

  return result;
}

/**
 * Setups hook on require *.vue extension.
 *
 * @alias module:vuegister
 * @param {object} [options] - Available options are:
 * ```js
 * {
 *   maps: boolean,   // generate source map
 *   plugins: object, // user configuration for the plugins, for example:
 *                    // {
 *                    //   babel: {
 *                    //     babelrc: true,
 *                    //   },
 *                    // }
 * }
 * ```
 * @return {boolean} Returns true on success.
 */
function register(options) {
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
    let vue = load(file);
    let script = vue.script;
    let template = vue.template;
    let sourceMap = {};

    if (script.lang) {
      let processed = _processLangAttr(script.lang, script.text, {
         file: script.file,
         maps: opts.maps,
         mapOffset: script.mapOffset,
         extra: script.lang in opts.plugins ? opts.plugins[script.lang] : {},
      });

      script.text = processed.code;
      sourceMap = processed.map;
    }

    if (opts.maps) {
      if (script.mapOffset > 0 && !script.lang) {
        sourceMap = _generateMap(script.text, script.file, script.mapOffset);
      }

      mapsCache.set(script.file, sourceMap);
    }

    script.text += addTemplate(template.text);

    return module._compile(script.text, script.file);
  };

  return true;
}

/**
 * Removes requre hook.
 *
 * @alias module:vuegister
 * @return {array} Returns list of unloaded modules.
 */
function unregister() {
  // removes module and all its children from the node's require cache
  let unload = (id) => {
    let module = require.cache[id];

    if (!module) return;

    module.children.forEach((child) => unload(child.id));
    delete require.cache[id];
    result.push(id);
  };

  let result = [];

  if (VUE_EXT in require.extensions) {
    delete require.extensions[VUE_EXT];
  }

  let sourceMapSupport = require.resolve('source-map-support');

  Object.keys(require.cache).forEach((key) => {
    if (path.extname(key) === VUE_EXT || key === sourceMapSupport) {
      unload(key);
    }
  });

  if ('prepareStackTrace' in Error) {
    delete Error.prepareStackTrace;
  }

  return result;
}

/**
 * Passes given code to the external plugin.
 *
 * @alias module:vuegister
 * @param {string} lang - Lang attribute from the scrip tag.
 * @param {string} code - Code for the transpiler.
 * @param {object} options - Options, an object of the following format:
 * ```js
 * {
 *   file: string,      // 'unknown', file name
 *   maps: boolean,     // false, provide source map
 *   mapOffset: number, // 0, map offset
 *   extra: object,     // {}, plugin options from the user
 * }
 * ```
 * @return {object} Returns the following object:
 * ```js
 * {
 *   code: string, // transpiled code, JavaScript
 *   map: object,  // generated source map
 * }
 * ```
 */
function _processLangAttr(lang, code, options) {
  let opts = {
    file: 'unknown',
    maps: false,
    mapOffset: 0,
    extra: {},
  };

  Object.assign(opts, options);

  let transpiler;

  try {
    transpiler = require(`vuegister-plugin-${lang}`);
  } catch (err) {
    let error = `Plugin vuegister-plugin-${lang} not found.` + os.EOL +
                `To install it run:` + os.EOL +
                `npm i vuegister-plugin-${lang} -D`;

    throw new Error(error);
  }

  return transpiler(code, opts);
}

/**
 * Generates source map for JavaScript.
 *
 * @alias module:vuegister
 * @param {string} content - Content of the script tag.
 * @param {string} file - File name of the generated source.
 * @param {number} offset - Offset for script tag, usually "script.start - 1"
 * @return {object} Returns the source map.
 */
function _generateMap(content, file, offset) {
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
 * @return {string} JavaScript code.
 */
function addTemplate(template) {
  let js = [
    '',
    'var __vue__options__ = (module.exports.__esModule) ?',
    'module.exports.default : module.exports;',
    '__vue__options__.template = ' + JSON.stringify(template) + ';',
    '',
  ];

  return js.join(os.EOL);
}

module.exports = {
  extract,
  load,
  register,
  unregister,
  _processLangAttr,
  _generateMap,
};
