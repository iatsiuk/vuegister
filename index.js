'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const htmlparser = require('htmlparser2');
const sourceMap = require('source-map');
const mapConverter = require('convert-source-map');

/**
 * Parses SFC.
 * @param {string} content - Text data of the SFC file.
 * @return {Object} - Returns parsed SFC, it's an object of the following
 * format:
 * {
 *    content: string, // raw text from the script tag
 *    src: string, // path to external file from the script's src attribute
 *    start: number, // line number where the script begins in the SFC
 *    end: number, // line number where the script ends in the SFC
 * }
 */
function parseVue(content) {
  let data = content.split(/\r?\n/);
  let position = 0;
  let lines = [];
  let isScript = false;
  let script = {
    content: '',
  };

  let parser = new htmlparser.Parser({
    onopentag(name, attributes) {
      if (name !== 'script') return;

      if (typeof attributes !== 'undefined' && 'src' in attributes) {
        script.src = attributes.src;
      }

      isScript = true;
      lines.push(position);
    },
    onclosetag(name) {
      if (name !== 'script') return;

      isScript = false;
      lines.push(position);
    },
    ontext(text) {
      if (!isScript) return;

      script.content += text;
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

  script.start = lines.shift();
  script.end = lines.shift();

  return script;
}

/**
 * Generates source map.
 * @param {string} file - The file name of the generated source.
 * @param {number} start - Line number where the script begins in the SFC.
 * @param {number} end - Line number where the script ends in the SFC.
 * @return {string} - Returns an inline comment that can be appended to the
 * source file.
 */
function addMap(file, start, end) {
  let generator = new sourceMap.SourceMapGenerator();

  for (let offset = 0; offset < end - start + 1; ++offset) {
    generator.addMapping({
      source: file,
      original: {line: start + offset, column: 0},
      generated: {line: offset + 1, column: 0},
    });
  }

  return os.EOL + mapConverter.fromObject(generator.toJSON()).toComment();
}

/**
 * Loads SFC from the given file.
 * @param {string} file - The file name of the *.vue component.
 * @return {Object} - Returns object with the following keys:
 * {
 *    content: string, // raw text from script tag
 *    file: string, // the full path to SFC
 * }
 */
function loadVue(file) {
  let content = fs.readFileSync(file, 'utf8');
  let script = parseVue(content);

  script.content += noTemplate();
  if (isDev && path.extname(file) === '.vue') {
    script.content += addMap(file, script.start, script.end);
  }

  if ('src' in script) {
    let scriptSrc = path.resolve(path.dirname(file), script.src);

    script.content = fs.readFileSync(scriptSrc, 'utf8');
    file = scriptSrc;
  }

  return {content: script.content, file: file};
}

/**
 * Setups hook on require *.vue extension.
 * @param {Object} options - This will be passed to source-map-support
 * installer.
 */
function registerVue(options) {
  if (isDev) {
    require('source-map-support').install(options);
  }

  require.extensions['.vue'] = (module, file) => {
    let vue = loadVue(file);

    module._compile(vue.content, vue.file);
  };
}

/**
 * Checks NODE_ENV variable.
 * @return {boolean}
 */
function isDev() {
  return (process.env.NODE_ENV === 'development');
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
