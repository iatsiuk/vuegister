# vuegister

The require hook for load [SFC](https://vuejs.org/v2/guide/single-file-components.html) (single-file component or *.vue) files.

## Usage

Register *.vue extension from Node:
```js
require('vuegister').register({
  hookRequire: true,
  environment: 'node',
})
```
Mocha [accepts](https://mochajs.org/#usage) a _--require_ parameter so we can ask it to require the given module before running tests:
```sh
mocha --require vuegister/register
```

## Motivation

Sometimes you want to run a lot of small tests simultaneously. Opening a new page with test suite in browser (even in PhantomJS) could take minutes. Main goal of this package is to speed up this process as much as possible.

## Installation
```sh
npm install vuegister --save-dev
```

## API Reference

This package doesn't perform any transpiling of the code. Vuegister just extracts text between script tags, adds source map and passes the result to Module.prototype.\_compile. The module.\_compile method can only run pure JavaScript code (not CoffeeScript or Babel dependent).

### vuegister.parse(content: string)

Parses SFC, returns parsed SFC, it's an object of the following format:
```
{
  content: string, // raw text from the script tag
  src: string, // path to external file from the script's src attribute
  start: number, // line number where the script begins in the SFC
  end: number, // line number where the script ends in the SFC
}
```

### vuegister.load(file: string)

Loads SFC from the given file, returns object with the following keys:
```
{
  content: string, // raw text from script tag
  file: string, // the full path to SFC
}
```

### vuegister.register(options: object)

Setups hook on require *.vue extension, `options` will be passed to [source-map-support](https://github.com/evanw/node-source-map-support).

## Tests

To run the test suite, install development dependencies and execute Mocha inside the vuegister folder:
```sh
npm install --only=development
./node_modules/.bin/mocha
```

## License

Distributed under MIT License.
