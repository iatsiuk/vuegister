'use strict';

/**
 * The require hook for load SFC (single-file component or *.vue) files.
 * @module vuegister
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const deepMerge = require('lodash.merge');
const htmlparser = require('htmlparser2');
const tokenizer = require('acorn').tokenizer;
const sourceMap = require('source-map');
const Location = require('./location');

const VUE_EXT = '.vue';

let sourceMapsCache = new Map();

/**
 * Extracts SCF sections (inner text and all tag attributes) specified by
 * tags argument, low level API.
 *
 * @alias module:vuegister
 * @param {string} buf - Content of the SFC file.
 * @param {array} tags - List of sections to be extracted.
 * @return {array} Returns extracted sections, each section is an object of
 * the following format:
 * ```js
 * {
 *   tag: string,    // name of the tag
 *   text: string,   // inner text, content of the tag
 *   attrs: object,  // key-value pairs, attributes of the tag
 *   offset: number, // line number where the tag begins in the SCF minus
 *                   // one or zero for external file
 * }
 * ```
 */
function extract(buf, tags) {
  if (typeof buf !== 'string') {
    throw new TypeError('First argument must be a string.');
  }
  if (!Array.isArray(tags)) {
    throw new TypeError('Second argument must be an array.');
  }

  let isRootTagFinded = {};
  let tagsCounter = {};

  let parser = new htmlparser.Parser({
    onopentag(tag, attrs) {
      if (tags.indexOf(tag) === -1) return;

      if (isRootTagFinded[tag]) {
        tagsCounter[tag] += 1;

        return;
      }

      isRootTagFinded[tag] = true;
      tagsCounter[tag] = 1;

      section = {tag, attrs};
      sectStart = parser.endIndex + 1;
    },
    onclosetag(tag) {
      if (tags.indexOf(tag) === -1) return;

      if (--tagsCounter[tag]) {
        return;
      }

      section.tag = tag;
      section.text = buf.substring(sectStart, parser.startIndex);
      section.offset = has(section.attrs, 'src') ? 0 : loc.getLine(sectStart);

      sections.push(section);
    },
    onerror(err) {
      /* istanbul ignore next */
      throw err;
    },
  }, {decodeEntities: true});

  // for now htmlparser2 doesn't provides line numbers for tag
  // @see https://github.com/fb55/htmlparser2/issues/89
  let loc = new Location(buf);
  let sectStart = 0;
  let section = {};

  let sections = [];

  parser.parseComplete(buf);

  return sections;
}

/**
 * Parses SFC, high level API.
 *
 * @alias module:vuegister
 * @param {string} buf - Content of the SFC file.
 * @param {string} [file] - Full path to the SFC.
 * @param {object} [cfg] - Options, an object of the following format:
 * ```js
 * {
 *   maps: boolean,   // false, provide source map
 *   lang: object,    // {}, default language for tag without lang attribute,
 *                    // for example:
 *                    // {
 *                    //   {script: 'js'}
 *                    // }
 *   plugins: object, // {}, user configuration for the plugins, for example:
 *                    // {
 *                    //   babel: {
 *                    //     babelrc: true,
 *                    //   },
 *                    // }
 * }
 * ```
 * @return {string} Returns ready-to-use JavaScript with injected template.
 */
function load(buf, file, cfg) {
  if (typeof buf !== 'string') {
    throw new TypeError('First argument must be a string.');
  }

  cfg = Object.assign({
    maps: false,
    lang: {script: 'js', template: 'html'},
    plugins: {},
  }, cfg);

  let vue = {};

  for (let section of extract(buf, ['script', 'template'])) {
    let attrs = section.attrs;
    let lang = has(attrs, 'lang') ? attrs.lang : cfg.lang[section.tag];

    if (has(attrs, 'src')) {
      let dir = file ? path.dirname(file) : process.cwd();

      file = path.resolve(dir, attrs.src);
      section.text = fs.readFileSync(file, 'utf8');
    }

    let transpiled = transpile(lang, section.text, {
      file,
      maps: cfg.maps,
      offset: section.offset,
      extra: Object.assign({}, cfg.plugins[lang]),
    });

    vue[section.tag] = transpiled.data;

    if (cfg.maps && transpiled.map) {
      sourceMapsCache.set(file, transpiled.map);
    }
  }

  vue.script += injectTemplate(vue.template);

  return vue.script;
}

/**
 * Setups hook on require *.vue extension.
 *
 * @alias module:vuegister
 * @param {object} [options] - Available options are:
 * ```js
 * {
 *   maps: boolean,   // false, provide source map
 *   lang: object,    // {}, default language for tag without lang attribute,
 *                    // for example:
 *                    // {
 *                    //   {script: 'js'}
 *                    // }
 *   plugins: object, // {}, user configuration for the plugins, for example:
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
  if (has(require.extensions, VUE_EXT)) {
    return false;
  }

  options = deepMerge({
    maps: false,
    lang: {script: 'js', template: 'html'},
    plugins: {},
  }, options);

  if (options.maps) installMapsSupport();

  require.extensions[VUE_EXT] = (module, file) => {
    let buf = fs.readFileSync(file, 'utf8');
    let script = load(buf, file, options);

    return module._compile(script, file);
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
  let list = [];

  // removes module and all its children from the node's require cache
  let unload = (id) => {
    let module = require.cache[id];

    if (!module) return;

    module.children.forEach((child) => unload(child.id));
    delete require.cache[id];
    list.push(id);
  };

  let sourceMapSupport = require.resolve('source-map-support');

  Object.keys(require.cache).forEach((key) => {
    if (path.extname(key) === VUE_EXT || key === sourceMapSupport) {
      unload(key);
    }
  });

  if (has(require.extensions, VUE_EXT)) {
    delete require.extensions[VUE_EXT];
  }

  if (has(Error, 'prepareStackTrace')) {
    delete Error.prepareStackTrace;
  }

  sourceMapsCache.clear();

  return list;
}

/**
 * Passes given code to the external plugin.
 *
 * @param {string} lang - Lang attribute from the tag.
 * @param {string} text - Code for the transpiler.
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
 *   text: string, // transpiled text from plugin
 *   map: object,  // generated source map
 * }
 * ```
 */
function transpile(lang, text, options) {
  let plugin = `vuegister-plugin-${lang}`;

  let langs = {
    js() {
      let map = (options.maps && options.offset > 0) ?
                generateMap(text, options.file, options.offset) : null;

      return {data: text, map};
    },

    html() {
      return {data: text, map: null};
    },

    error(err) {
      let error = `Plugin ${plugin} not found.` + os.EOL + err.message;

      throw new Error(error);
    },
  };

  // allows to override default html and js methods by plugins
  try {
    return require(plugin)(text, options);
  } catch (err) {
    return (langs[lang] || langs['error'](err))();
  }
}

/**
 * Generates source map for JavaScript.
 *
 * @param {string} content - Content of the script tag.
 * @param {string} file - File name of the generated source.
 * @param {number} offset - Offset for script tag
 * @return {object} Returns the source map.
 */
function generateMap(content, file, offset) {
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
 * Installs handler on prepareStackTrace
 */
function installMapsSupport() {
  require('source-map-support').install({
    environment: 'node',
    handleUncaughtExceptions: false,
    retrieveSourceMap: (source) => {
      return sourceMapsCache.has(source) ?
             {map: sourceMapsCache.get(source), url: source} :
             null;
    },
  });
}

/**
 * Hack to suppress Vue.js warning: template or render function not defined.
 *
 * @param {string} template - Template, it's html code.
 * @return {string} Returns JavaScript code.
 */
function injectTemplate(template) {
  let js = [
    '',
    'var __vue__options__ = (module.exports.__esModule) ?',
    'module.exports.default : module.exports;',
    '__vue__options__.template = ' + JSON.stringify(template) + ';',
    '',
  ];

  return js.join(os.EOL);
}

/**
 * Checks if path is a direct property of object.
 *
 * @param {object} object - The object to query.
 * @param {string} path - The path to check.
 * @return {boolean} Returns true if path exists, else false.
 */
function has(object, path) {
  return Object.prototype.hasOwnProperty.call(object, path);
}

module.exports = {
  // public
  extract,
  load,
  register,
  unregister,
  // private
  _transpile: transpile,
  _generateMap: generateMap,
};
