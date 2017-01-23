'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const htmlparser = require('htmlparser2');
const tokenizer = require('acorn').tokenizer;
const sourceMap = require('source-map');
const mapConverter = require('convert-source-map');

const VUE_EXT = '.vue';

/**
 * Extracts text and all attributes from the script tag.
 *
 * @param {string} content - Content of the SFC file.
 * @return {Object} - Returns an object of the following format:
 * {
 *    content: string, // raw text from the script tag
 *    attribs: Object, // attributes from src script tag
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
  let result = {};
  let parser = new htmlparser.Parser({
    onopentag(tag, attributes) {
      if (tag !== 'script') return;

      if (attributes !== undefined) {
        result.attribs = {};
        Object.assign(result.attribs, attributes);
      }

      isScript = true;
      result.start = position;
      result.content = '';
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
  });

  while(data.length > 0) {
    position++;
    parser.write(data.shift() + os.EOL);
  }
  parser.end();

  return result;
}

/**
 * Setups hook on require *.vue extension.
 *
 * @param {Object} [options] - Available options are:
 * {
 *    sourceMaps: boolean, // generate source maps
 * }
 */
function requireExtension(options) {
  let cfg = {
    sourceMaps: true,
  };

  if (options !== undefined) {
    Object.assign(cfg, options);
  }

  if (cfg.sourceMaps) {
    require('source-map-support').install({
      environment: 'node',
      hookRequire: true,
    });
  }

  require.extensions[VUE_EXT] = (module, file) => {
    let content = fs.readFileSync(file, 'utf8');
    let script = extractScript(content);

    // do we need to load external file from src script attribute?
    if ('src' in script.attribs) {
      file = path.resolve(path.dirname(file), script.attribs.src);
      script.content = fs.readFileSync(file, 'utf8');
    }

    let code = '';

    if ('lang' in script.attribs) {
      // transforms code to the JavaScript
      let transpiler;

      try {
        transpiler = require(`vuegister-plugin-${script.lang}`);
      } catch (err) {
        console.error(`Plugin vuegister-plugin-${script.lang} not found.`);
        console.error('To install it run:');
        console.error(`npm install --save-dev vuegister-plugin-${script.lang}`);

        process.exit(1);
      }

      code = transpiler(script, file, cfg);
    } else {
      code = script.content;
    }

    // generate source map only for javascript inside SFC file
    if (cfg.sourceMaps && path.extname(file) === VUE_EXT) {
      let map = generateSourceMap(script.content, file, script.start - 1);

      code += os.EOL + mapConverter.fromObject(map).toComment();
    }

    code += noTemplate();

    return module._compile(code, file);
  };
}

/**
 * Generates source map.
 *
 * @param {string} content - Content of the script tag
 * @param {string} file - The file name of the generated source.
 * @param {number} offset - Offset for script tag, usually "script.start - 1"
 * @return {Object} - Returns the source map.
 */
function generateSourceMap(content, file, offset) {
  if (offset < 0) {
    throw new RangeError('Offset parameter is less than zero.');
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
  extract: extractScript,
  register: requireExtension,
};
