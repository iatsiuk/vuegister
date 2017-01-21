'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const htmlparser = require('htmlparser2');
const tokenizer = require('acorn').tokenizer;
const sourceMap = require('source-map');
const mapConverter = require('convert-source-map');

/**
 * Parses SFC.
 * @param {string} content - Text data of the SFC file.
 * @return {Object} - Returns parsed SFC, it's an object of the following
 * format:
 * {
 *    content: string,    // raw text from the script tag
 *    attributes: Object, // attributes from src script tag
 *    start: number,      // line number where the script begins in the SFC
 *    end: number,        // line number where the script ends in the SFC
 * }
 */
function parseVue(content) {
  let data = content.split(/\r?\n/);
  let position = 0;
  let lines = [];
  let isScript = false;
  let result = {
    content: '',
    attributes: {},
  };
  let parser = new htmlparser.Parser({
    onopentag(name, attributes) {
      if (name !== 'script') return;

      if (attributes !== undefined) {
        Object.assign(result.attributes, attributes);
      }

      isScript = true;
      // line number where the script begins in the SFC
      lines.push(position);
    },
    onclosetag(name) {
      if (name !== 'script') return;

      isScript = false;
      // line number where the script ends in the SFC
      lines.push(position);
    },
    ontext(text) {
      if (!isScript) return;

      result.content += text;
    },
    onerror(err) {
      throw err;
    },
  });

  while(data.length > 0) {
    position++;
    parser.write(data.shift() + os.EOL);
  }
  parser.end();

  result.start = lines.shift();
  result.end = lines.shift();

  return result;
}

/**
 * Generates source map.
 * @param {string} content - Content of the script tag
 * @param {string} file - The file name of the generated source.
 * @param {number} offset - Offset for script tag, usually "script.start - 1"
 * @return {Object} - Returns the source map.
 */
function addMap(content, file, offset) {
  if (offset < 0) {
    throw new Error('Offset parameter is less than zero.');
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
      generated: {line: position.line, column: position.column},
      name: token.value !== undefined ? token.value : null,
    });
  }

  return generator.toJSON();
}

/**
 * Loads SFC from the given file.
 * @param {string} file - The file name of the *.vue component.
 * @return {Object} - Returns object with the following keys:
 * {
 *    code: string, // processed javascript
 *    file: string, // the full path to SFC or absolute path to the external
 *                  // script from the src script tag
 *    map: Object,  // generated source map
 * }
 */
function loadVue(file) {
  let content = fs.readFileSync(file, 'utf8');
  let script = parseVue(content);

  // generate source map only for script inside SFC file
  let sourceMap = null;
  if (path.extname(file) === '.vue') {
    sourceMap = addMap(script.content, file, script.start - 1);
  }

  // do we need to load external file from src script attribute?
  if ('src' in script.attributes) {
    file = path.resolve(path.dirname(file), script.attributes.src);
    script.content = fs.readFileSync(file, 'utf8');
  }

  let result = {};

  // do we need to transpile code?
  if ('lang' in script.attributes) {
    result = transpileCode(
      script.attributes.lang,
      script.code,
      sourceMap
    );
  } else {
    result = {code: script.content, map: sourceMap};
  }

  return Object.assign(result, {file: file});
}

/**
 * Transforms code to the JavaScript.
 * @param {string} lang - Preprocessor language, i.e. babel, coffee & etc.
 * @param {string} code - Content of the script tag.
 * @param {Object} map - Source map for the given file.
 * @return {Object} - Returns transformed code, it's object with the following
 * keys:
 * {
 *    code: string, // transpiled javascript
 *    map: Object,  // generated source map
 * }
 */
function transpileCode(lang, code, map) {
  try {
    const transpiler = require(`vuegister-plugin-${lang}`);

    return transpiler(code, map);
  } catch (err) {
    console.error(`Plugin vuegister-plugin-${lang} not found.`);
    console.error('To install it run:');
    console.error(`npm install --save-dev vuegister-plugin-${lang}`);

    process.exit(1);
  }
}

/**
 * Setups hook on require *.vue extension.
 * @param {Object} options - Options
 */
function registerVue(options) {
  require('source-map-support').install(options);

  require.extensions['.vue'] = (module, file) => {
    let vue = loadVue(file);

    vue.code += noTemplate();

    if (vue.map !== null) {
      vue.code += os.EOL + mapConverter.fromObject(vue.map).toComment();
    }

    module._compile(vue.code, vue.file);
  };
}

/**
 * Hack to suppress Vue.js warning: template or render function not defined.
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
  parse: parseVue,
  load: loadVue,
  register: registerVue,
};
