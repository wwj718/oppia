// Copyright 2014 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Controllers for the exploration settings tab.
 *
 * @author sll@google.com (Sean Lip)
 */

oppia.controller('ExplorationSettings', [
    '$scope', '$http', '$window', '$modal', '$rootScope', 'activeInputData', 'explorationData',
    'explorationTitleService', 'explorationCategoryService', 'explorationObjectiveService',
    'explorationLanguageCodeService', 'explorationTagsService', 'explorationRightsService',
    'explorationInitStateNameService', 'explorationParamSpecsService', 'changeListService',
    'warningsData', 'explorationStatesService', 'explorationParamChangesService',
    'explorationWarningsService', 'CATEGORY_LIST',
    'explorationAdvancedFeaturesService', function(
      $scope, $http, $window, $modal, $rootScope, activeInputData, explorationData,
      explorationTitleService, explorationCategoryService, explorationObjectiveService,
      explorationLanguageCodeService, explorationTagsService, explorationRightsService,
      explorationInitStateNameService, explorationParamSpecsService, changeListService,
      warningsData, explorationStatesService, explorationParamChangesService,
      explorationWarningsService, CATEGORY_LIST,
      explorationAdvancedFeaturesService) {

  $scope.CATEGORY_LIST_FOR_SELECT2 = [];

  for (var i = 0; i < CATEGORY_LIST.length; i++) {
    $scope.CATEGORY_LIST_FOR_SELECT2.push({
      id: CATEGORY_LIST[i],
      text: CATEGORY_LIST[i]
    });
  }

  $scope.TAG_REGEX = GLOBALS.TAG_REGEX;

  var MY_EXPLORATIONS_PAGE_URL = '/my_explorations';
  var EXPLORE_PAGE_PREFIX = '/explore/';

  $scope.getExplorePageUrl = function() {
    return (
      window.location.protocol + '//' + window.location.host +
      EXPLORE_PAGE_PREFIX + $scope.explorationId);
  };

  $scope.initSettingsTab = function() {
    $scope.explorationTitleService = explorationTitleService;
    $scope.explorationCategoryService = explorationCategoryService;
    $scope.explorationObjectiveService = explorationObjectiveService;
    $scope.explorationLanguageCodeService = explorationLanguageCodeService;
    $scope.explorationTagsService = explorationTagsService;
    $scope.explorationRightsService = explorationRightsService;
    $scope.explorationInitStateNameService = explorationInitStateNameService;
    $scope.explorationParamSpecsService = explorationParamSpecsService;
    $scope.explorationParamChangesService = explorationParamChangesService;

    explorationData.getData().then(function(data) {
      $scope.refreshSettingsTab();
      $scope.hasPageLoaded = true;
    });
  };

  $scope.refreshSettingsTab = function() {
    var _states = explorationStatesService.getStates();
    // Ensure that explorationStatesService has been initialized before getting
    // the state names from it. (Otherwise, navigating to the settings tab
    // directly (by entering a URL that ends with /settings) results in a
    // console error.
    if (_states) {
      var newCategory = {
        id: explorationCategoryService.displayed,
        text: explorationCategoryService.displayed
      };

      if ($scope.CATEGORY_LIST_FOR_SELECT2.indexOf(newCategory) === -1) {
        $scope.CATEGORY_LIST_FOR_SELECT2.push(newCategory);
      }

      $scope.stateNames = Object.keys(_states);
    }
  };

  $scope.$on('refreshSettingsTab', $scope.refreshSettingsTab);

  $scope.initSettingsTab();

  $scope.ROLES = [
    {name: 'Manager (can edit permissions)', value: 'owner'},
    {name: 'Collaborator (can make changes)', value: 'editor'},
    {name: 'Playtester (can give feedback)', value: 'viewer'}
  ];

  $scope.saveExplorationTitle = function() {
    explorationTitleService.saveDisplayedValue();
  };

  $scope.saveExplorationCategory = function() {
    explorationCategoryService.saveDisplayedValue();
  };

  $scope.saveExplorationObjective = function() {
    explorationObjectiveService.saveDisplayedValue();
    explorationWarningsService.updateWarnings();
  };

  $scope.saveExplorationLanguageCode = function() {
    explorationLanguageCodeService.saveDisplayedValue();
  };

  $scope.saveExplorationTags = function() {
    explorationTagsService.saveDisplayedValue();
  };

  $scope.saveExplorationInitStateName = function() {
    var newInitStateName = explorationInitStateNameService.displayed;

    if (!explorationStatesService.getState(newInitStateName)) {
      warningsData.addWarning('Invalid initial state name: ' + newInitStateName);
      explorationInitStateNameService.restoreFromMemento();
      return;
    }

    explorationInitStateNameService.saveDisplayedValue();

    $rootScope.$broadcast('refreshGraph');
  };

  $scope.postSaveParamChangesHook = function() {
    explorationWarningsService.updateWarnings();
  };

  /********************************************
  * Methods for enabling advanced features.
  ********************************************/
  $scope.areParametersEnabled = (
    explorationAdvancedFeaturesService.areParametersEnabled);
  $scope.areGadgetsEnabled = (
    explorationAdvancedFeaturesService.areGadgetsEnabled);
  $scope.areFallbacksEnabled = (
    explorationAdvancedFeaturesService.areFallbacksEnabled);

  $scope.enableParameters = (
    explorationAdvancedFeaturesService.enableParameters);
  $scope.enableGadgets = (
    explorationAdvancedFeaturesService.enableGadgets);
  $scope.enableFallbacks = (
    explorationAdvancedFeaturesService.enableFallbacks);

  /********************************************
  * Methods for rights management.
  ********************************************/
  $scope.openEditRolesForm = function() {
    activeInputData.name = 'explorationMetadata.editRoles';
    $scope.newMemberUsername = '';
    $scope.newMemberRole = $scope.ROLES[0];
  };

  $scope.closeEditRolesForm = function() {
    $scope.newMemberUsername = '';
    $scope.newMemberRole = $scope.ROLES[0];
    activeInputData.clear();
  };

  $scope.editRole = function(newMemberUsername, newMemberRole) {
    activeInputData.clear();
    explorationRightsService.saveChangeToBackend({
      new_member_username: newMemberUsername,
      new_member_role: newMemberRole
    });
  };

  $scope.toggleViewabilityIfPrivate = function() {
    explorationRightsService.saveChangeToBackend({
      viewable_if_private: !explorationRightsService.viewableIfPrivate()
    });
  };

  /********************************************
  * Methods relating to control buttons.
  ********************************************/
  $scope.showTransferExplorationOwnershipModal = function() {
    warningsData.clear();
    $modal.open({
      templateUrl: 'modals/transferExplorationOwnership',
      backdrop: true,
      controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
          $scope.transfer = $modalInstance.close;

          $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
            warningsData.clear();
          };
        }
      ]
    }).result.then(function() {
      explorationRightsService.saveChangeToBackend({is_community_owned: true});
    });
  };

  $scope.showNominateExplorationModal = function() {
    warningsData.clear();
    $modal.open({
      templateUrl: 'modals/nominateExploration',
      backdrop: true,
      controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
        $scope.close = function() {
          $modalInstance.dismiss('cancel');
          warningsData.clear();
        };
      }]
    });
  };

  $scope.deleteExploration = function(role) {
    warningsData.clear();

    $modal.open({
      templateUrl: 'modals/deleteExploration',
      backdrop: true,
      controller: ['$scope', '$modalInstance', function($scope, $modalInstance) {
        $scope.reallyDelete = $modalInstance.close;

        $scope.cancel = function() {
          $modalInstance.dismiss('cancel');
          warningsData.clear();
        };
      }]
    }).result.then(function() {
      var deleteUrl = $scope.explorationDataUrl;
      if (role) {
        deleteUrl += ('?role=' + role);
      }
      $http['delete'](deleteUrl).success(function(data) {
        $window.location = MY_EXPLORATIONS_PAGE_URL;
      });
    });
  };

  var openModalForModeratorAction = function(action) {
    warningsData.clear();

    $http.get('/moderatorhandler/email_draft/' + action).then(function(response) {
      // An empty draft email body indicates that no email will be sent.
      var draftEmailBody = response.data.draft_email_body;

      $modal.open({
        templateUrl: 'modals/takeModeratorAction',
        backdrop: true,
        resolve: {
          emailBody: function() {
            return draftEmailBody;
          }
        },
        controller: [
            '$scope', '$modalInstance', 'emailBody',
            function($scope, $modalInstance, emailBody) {
          $scope.action = action;
          $scope.emailBody = emailBody;

          $scope.EMAIL_BODY_SCHEMA = {
            type: 'html'
          };

          $scope.reallyTakeAction = function() {
            $modalInstance.close({
              emailBody: $scope.emailBody
            });
          };

          $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
            warningsData.clear();
          };
        }]
      }).result.then(function(result) {
        // TODO(sll): Fix this. The existing logic is:
        // explorationRightsService.saveChangeToBackend({is_public: false});
        // explorationRightsService.saveChangeToBackend({is_publicized: true});
        explorationRightsService.saveModeratorChangeToBackend({
          action: action,
          email_body: result.emailBody
        });
      });
    });
  };

  $scope.unpublishExplorationAsModerator = function() {
    openModalForModeratorAction('unpublish_exploration');
  };

  $scope.publicizeExplorationAsModerator = function() {
    openModalForModeratorAction('publicize_exploration');
  };

  $scope.unpublicizeExplorationAsModerator = function() {
    // Currently this does not require sending an email.
    explorationRightsService.saveChangeToBackend({is_publicized: false});
  };

  $scope.isExplorationLockedForEditing = function() {
    return changeListService.isExplorationLockedForEditing();
  };
}]);
