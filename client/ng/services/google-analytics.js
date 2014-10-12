'use strict';

var app = angular.module('mjbondra.services.google-analytics', []);

app.factory('ga', ['$location', '$window', function ($location, $window) {
  $window.GoogleAnalyticsObject = 'ga';
  $window.ga = $window.ga || function () {
    ($window.ga.q = $window.ga.q || []).push(arguments);
  };
  $window.ga.l = 1 * new Date();
  return $window.ga;
}]);