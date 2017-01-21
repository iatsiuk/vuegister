// ESLint Configuration File
// See http://eslint.org/docs/user-guide/configuring for more details

module.exports = {
  'root': true,
  'extends': ['eslint:recommended', 'google'],
  'env': {
    es6: true,
    node: true,
    mocha: true
  },
  'globals': {},
  'rules': {
    'require-jsdoc': 'off',
    'strict': ['error', 'global'],
    'no-console': ['error', {allow: ['error']}],
  },
  'parserOptions': {}
};
