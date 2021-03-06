'use strict';

var angular = require('angular')
  , app = angular.module('bodyFilters', []);

app.filter('locationClass', [function () {
  return function (location) {
    var matches = /\/(.*?)\//.exec(location);
    return matches ?
      'article--' + matches[1] :
      location === '/' ?
        'article--details' :
        '';
  };
}]);
