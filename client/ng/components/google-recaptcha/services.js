'use strict';

var angular = require('angular')
  , app = angular.module('mjbondra.components.google-recaptcha.services', []);

app.factory('grecaptcha', [
  '$window',
  function ($window) {
    $window.grecaptcha = $window.grecaptcha || {};
    return $window.grecaptcha;
  }
]);

app.factory('recaptchaReset', [
  'grecaptcha',
  function (grecaptcha) {
    return function (id) {
      if (grecaptcha.reset)
        grecaptcha.reset(id);
    };
  }
]);

app.factory('recaptchaSiteKey', [
  function () {
    var key;
    return {
      get: function () {
        return key;
      },
      set: function (_key) {
        key = _key;
      }
    };
  }
]);