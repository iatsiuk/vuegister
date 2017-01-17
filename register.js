'use strict';

require('./').register({
  // add support for files with inline source maps
  hookRequire: true,
  // specify the environment
  environment: 'node',
});
