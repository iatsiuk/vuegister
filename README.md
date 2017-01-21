# vuegister [![Build Status](https://travis-ci.org/iatsiuk/vuegister.svg?branch=master)](https://travis-ci.org/iatsiuk/vuegister)

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

To run test suite create `test.js` and `MyComponent.vue` files inside your `test` folder.

Content of the `test.js` file:

```js
const assert = require('chai').assert;
const Vue = require('vue/dist/vue.common')
const MyComponent = require('./MyComponent.vue')

describe('MyComponent', () => {
  it('has a created hook', () => {
    assert.isFunction(MyComponent.created)
  })

  it('sets the correct default data', () => {
    assert.isFunction(MyComponent.data)
    const defaultData = MyComponent.data()
    assert.strictEqual(defaultData.message, 'hello!')
  })

  it('correctly sets the message when created', () => {
    const vm = new Vue(MyComponent).$mount()
    assert.strictEqual(vm.message, 'bye!')
  })
})
```

Content of the `MyComponent.vue` file:

```html
<template>
  <span>{{ message }}</span>
</template>
<script>
  module.exports = {
    data () {
      return {
        message: 'hello!'
      }
    },
    created () {
      this.message = 'bye!'
    }
  }
</script>
```

Install jsdom-global and run tests with:

```sh
npm install --save-dev jsdom jsdom-global
mocha -r jsdom-global/register -r vuegister/register
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
  content: string,    // raw text from the script tag
  attributes: Object, // attributes from src script tag
  start: number,      // line number where the script begins in the SFC
  end: number,        // line number where the script ends in the SFC
}
```

### vuegister.load(file: string)

Loads SFC from the given file, returns object with the following keys:

```
{
  code: string, // processed javascript
  file: string, // the full path to SFC or absolute path to the external
                // script from the src script tag
  map: Object,  // generated source map
}
```

### vuegister.register(options: object)

Setups hook on require *.vue extension.

## Tests

To run the test suite, install development dependencies and execute Mocha inside the vuegister folder.

## License

Distributed under MIT License.
