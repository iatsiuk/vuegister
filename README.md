# vuegister [![npm version](https://badge.fury.io/js/vuegister.svg)](https://badge.fury.io/js/vuegister) [![build status](https://travis-ci.org/iatsiuk/vuegister.svg?branch=master)](https://travis-ci.org/iatsiuk/vuegister)

## About

Vuegister (a portmanteau for vue-register) is a require hook for loading of the [Vue.js](https://vuejs.org) single-file components (or *.vue files). The main purpose of this package is to help the developer with unit testing of the component's logic. It allows you to import the object from the *.vue template as you do it with any Node.js module.

Sometimes you want to run multiple small tests simultaneously. Opening a new page with test suite in browser (even in PhantomJS) can take minutes. With the help of [jsdom](https://github.com/tmpvar/jsdom) it is possible to speed up this process. You can run your unit tests in the pure Node.js environment. There is no need in heavy test runners (like Karma) or code transpilers (like Babel). Actual versions of Node.js supports new features from the latest revision of the JavaScript ECMA-262 specification. The website [node.green](http://node.green/) provides overview of supported ECMAScript features in various versions of Node.js.

This package doesn't perform any transpiling of the code. Vuegister just extracts text between script tags, adds source map and passes the result to Module.prototype.\_compile. The module.\_compile method can only run JavaScript code (not CoffeeScript or Babel dependent). At the same time you can use external plugins for the code transpiling. Please see the **Plugins** section of this document.

## Installation

```sh
npm i vuegister -D
```

## Plugins

Vuegister can be easily extended through plugins to support various code preprocessors. Take a look at the [babel](https://github.com/iatsiuk/vuegister-plugin-babel) plugin for further details.

## Usage

Register *.vue extension from Node.js:

```js
require('vuegister').register()
```

Using require hook from the Mocha test framework. This is equivalent to Babel’s [babel-register](https://babeljs.io/docs/usage/babel-register/):

```sh
mocha --require vuegister/register
```

## Test suite example

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

  it('renders the correct message', () => {
    const Ctor = Vue.extend(MyComponent)
    const vm = new Ctor().$mount()
    assert.strictEqual(vm.$el.textContent, 'bye!')
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
npm i jsdom jsdom-global -D
mocha -r jsdom-global/register -r vuegister/register
```

## API Reference

Project documentation is generated automatically from source code. Please take a look at the [api.md](api.md) file in this repository.

## Tests

To run the test suite, install development dependencies and execute:

```sh
npm run coverage
```

## License

Distributed under MIT License.
