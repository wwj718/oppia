// Copyright 2012 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Controllers for the graphical state editor.
 *
 * @author sll@google.com (Sean Lip)
 */

function StateEditor($scope, $http, $filter, $sce, $modal, explorationData,
                   warningsData, activeInputData, oppiaRequestCreator) {

  $scope.$on('guiTabSelected', function(event, stateName) {
    $scope.stateName = stateName;
    $scope.initStateEditor();
  });

  $scope.initStateEditor = function() {
    var stateData = $scope.$parent.states[$scope.stateName];
    $scope.content = stateData.content || [];
    $scope.stateParamChanges = stateData.param_changes || [];

    if ($scope.stateName && stateData) {
      $scope.$broadcast('stateEditorInitialized', stateData);
    }
  }

  $scope.getIncomingStates = function(stateName) {
    var incomingStates = {},
        statesToRuleNames = {},
        otherStateName;

    for (otherStateName in $scope.states) {
      var handlers = $scope.states[otherStateName].widget.handlers;
      var widgetParams = $scope.states[otherStateName].widget.customization_args;
      for (var i = 0; i < handlers.length; i++) {
        for (var j = 0; j < handlers[i].rule_specs.length; j++) {
          if (handlers[i].rule_specs[j].dest == stateName) {
            incomingStates[otherStateName] = $scope.states[otherStateName];

            var previousChoices = null;
            if (widgetParams.hasOwnProperty('choices')) {
              previousChoices = widgetParams.choices;
            }

            var ruleName = $filter('parameterizeRuleDescription')(
                handlers[i].rule_specs[j], previousChoices);

            if (otherStateName in statesToRuleNames) {
              statesToRuleNames[otherStateName].push(ruleName);
            } else {
              statesToRuleNames[otherStateName] = [ruleName];
            }
          }
        }
      }
    }

    for (otherStateName in incomingStates) {
      incomingStates[otherStateName].rules = statesToRuleNames[otherStateName];
    }
    return incomingStates;
  };

  // This should only be non-null when the state name editor is open.
  $scope.stateNameMemento = null;

  $scope.openStateNameEditor = function() {
    $scope.stateNameMemento = $scope.stateName;
    $scope.tmpStateName = $scope.stateName;
  };

  $scope.saveStateName = function(newStateName) {
    newStateName = $scope.normalizeWhitespace(newStateName);
    if (!$scope.isValidEntityName(newStateName, true)) {
      return;
    }
    if (newStateName.length > 50) {
      warningsData.addWarning(
        'State names should be at most 50 characters long.');
      return;
    }
    if (newStateName !== $scope.stateName &&
        $scope.states.hasOwnProperty(newStateName)) {
      warningsData.addWarning(
        'The name \'' + newStateName + '\' is already in use.');
      return;
    }

    if ($scope.stateNameMemento === newStateName) {
      $scope.stateNameMemento = null;
      return;
    }

    if ($scope.stateNameMemento !== newStateName) {
      // Tidy up the rest of the states.
      if ($scope.$parent.initStateName == $scope.stateName) {
        $scope.$parent.initStateName = newStateName;
      }

      $scope.states[newStateName] = angular.copy(
        $scope.states[$scope.stateName]);
      delete $scope.states[$scope.stateName];
      for (var otherStateName in $scope.states) {
        var handlers = $scope.states[otherStateName].widget.handlers;
        for (var i = 0; i < handlers.length; i++) {
          for (var j = 0; j < handlers[i].rule_specs.length; j++) {
            if (handlers[i].rule_specs[j].dest === $scope.stateName) {
              handlers[i].rule_specs[j].dest = newStateName;
            }
          }
        }
      }

      $scope.stateName = newStateName;
      $scope.$parent.stateName = newStateName;
      $scope.$parent.selectGuiTab();

      $scope.$parent.addRenameStateChange(
        newStateName, $scope.stateNameMemento);

      $scope.initStateEditor();
      $scope.stateNameMemento = null;
      $scope.drawGraph();
      // Refresh the location hash.
      $scope.selectGuiTab();
    }
  };

  // This should only be non-null when the content editor is open.
  $scope.contentMemento = null;

  $scope.editContent = function() {
    $scope.contentMemento = angular.copy($scope.content);
  };

  $scope.saveTextContent = function() {
    $scope.$apply();
    if ($scope.contentMemento !== $scope.content) {
      // The $apply() call seems to be needed in order to ensure that the latest
      // values from the RTE are captured.
      // TODO(sll): Do we need to update math?
      $scope.addStateChange(
          'content', angular.copy($scope.content),
          angular.copy($scope.contentMemento)
      );
    }
    $scope.contentMemento = null;
  };

  $scope.getCustomizationModalInstance = function(widgetId, widgetParams) {
    // NB: This method is used for interactive widgets.
    return $modal.open({
      templateUrl: 'modals/customizeWidget',
      backdrop: 'static',
      resolve: {
        widgetId: function() {
          return widgetId;
        },
        widgetParams: function() {
          return widgetParams;
        }
      },
      controller: [
        '$scope', '$http', '$modalInstance', 'widgetId', 'widgetParams',
        'warningsData', 'oppiaRequestCreator',
        function($scope, $http, $modalInstance, widgetId, widgetParams, warningsData, oppiaRequestCreator) {
          $scope.widgetId = widgetId;
          $scope.widgetParams = widgetParams;

          $http.post(
              '/widgets/interactive/' + widgetId,
              oppiaRequestCreator.createRequest({
                'customization_args': {}
              }),
              {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).
                  success(function(data) {
                    $scope.paramDescriptions = {};
                    for (var paramName in data.widget.params) {
                      $scope.paramDescriptions[paramName] = data.widget.params[paramName].description;
                    }
                  }).error(function(data) {
                    warningsData.addWarning(
                        'Error: Failed to obtain widget parameter descriptions.');
                  });

          $scope.save = function(widgetParams) {
            $scope.$broadcast('externalSave');
            $modalInstance.close({
              widgetParams: widgetParams
            });
          };
        }
      ]
    });
  };

  $scope.saveStateParamChanges = function(newValue, oldValue) {
    if (!angular.equals(newValue, oldValue)) {
      $scope.addStateChange('param_changes', newValue, oldValue);
    }
  };

}

StateEditor.$inject = ['$scope', '$http', '$filter', '$sce', '$modal',
    'explorationData', 'warningsData', 'activeInputData', 'oppiaRequestCreator'];