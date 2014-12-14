'use strict';

var angular = require('angular');

require('./body');
require('./console');
require('./details');
require('./forms');
require('./google-analytics');
require('./google-recaptcha');
require('./head');
require('./messages');
require('./navigation');
require('./projects');
require('./scroll');
require('./styles');

angular.module('mjbondra.components', [
  'mjbondra.components.body',
  'mjbondra.components.console',
  'mjbondra.components.details',
  'mjbondra.components.forms',
  'mjbondra.components.google-analytics',
  'mjbondra.components.google-recaptcha',
  'mjbondra.components.head',
  'mjbondra.components.messages',
  'mjbondra.components.navigation',
  'mjbondra.components.projects',
  'mjbondra.components.scroll',
  'mjbondra.components.styles'
]);
