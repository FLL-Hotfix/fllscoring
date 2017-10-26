describe('scores', function() {

    var module;
    var $scope, controller, scoresMock, teamsMock, stagesMock,$window,$q;
    var originalMockScores;

    beforeEach(function() {
        module = factory('views/scores', {
            'services/log': logMock,
            'services/fs': {},
        });
        angular.mock.module(module.name);
        angular.mock.inject(function($controller, $rootScope,_$window_,_$q_) {
            $scope = $rootScope.$new();
            $window = _$window_;
            $q = _$q_;
            scoresMock = createScoresMock($q);
            teamsMock = createTeamsMock();
            stagesMock = createStagesMock();
            controller = $controller('scoresCtrl', {
                '$scope': $scope,
                '$scores': scoresMock,
                '$teams': teamsMock,
                '$stages': stagesMock,
            });
            originalMockScores = angular.copy(scoresMock.scores);
        });
        $window.alert = jasmine.createSpy('alertSpy');
    });

    describe('initialization', function() {
        it('should initialize', function() {
            expect($scope.sort).toEqual('index');
            expect($scope.rev).toEqual(true);
            expect($scope.scores).toEqual(scoresMock.scores);
        });
    });

    describe('doSort',function() {
        it('should set toggle sort on an already sorted column',function() {
            $scope.doSort('index');
            expect($scope.rev).toBe(false);
            expect($scope.sort).toBe('index');
            $scope.doSort('index');
            expect($scope.rev).toBe(true);
            expect($scope.sort).toBe('index');
        });

        it('should the sort with rev false when no default given when a different column is sorted',function() {
            $scope.doSort('foo');
            expect($scope.rev).toBe(false);
            expect($scope.sort).toBe('foo');
        });

        it('should the sort with rev to the given default when a different column is sorted',function() {
            $scope.doSort('foo',true);
            expect($scope.rev).toBe(true);
            expect($scope.sort).toBe('foo');
        });
    });

    describe('removeScore',function() {
        it('should remove a score',function() {
            $scope.removeScore(1);
            expect(scoresMock.remove).toHaveBeenCalledWith(1);
            expect(scoresMock.save).toHaveBeenCalledWith();
        });
    });

    describe('editScore',function() {
        it('should edit a score',function() {
            $scope.editScore(0);
            expect($scope.editing[0]).toBeDefined();
        });
        it('should be cancelled when server score changes',function() {
            $scope.editScore(0);
            $scope.scores[0].teamNumber = 0;
            $scope.$digest();
            expect($scope.editing[0]).not.toBeDefined();
        });
        it('should not be cancelled when another score changes', function () {
            $scope.editScore(0);
            $scope.scores[1].teamNumber = 0;
            $scope.$digest();
            expect($scope.editing[0]).toBeDefined();
        });
        it('should not be cancelled when an uninteresting property changes', function () {
            $scope.editScore(0);
            $scope.scores[0].something = "foo";
            $scope.$digest();
            expect($scope.editing[0]).toBeDefined();
        });
    });

    describe('finishEditScore',function() {
        it('should call update and save',function() {
            $scope.editScore(0);
            $scope.finishEditScore(0);
            expect(scoresMock.update).toHaveBeenCalledWith(0, originalMockScores[0]);
            expect(scoresMock.save).toHaveBeenCalled();
        });
        it('should alert if an error is thrown from scores',function() {
            scoresMock.update.and.throwError('update error');
            $scope.editScore(0);
            $scope.finishEditScore(0);
            expect($window.alert).toHaveBeenCalledWith('Error updating score: Error: update error');
        });
        it('should not reset an unknown property of an updated server score',function() {
            $scope.editScore(0);
            $scope.scores[0].something = "foo";
            $scope.$digest();
            $scope.finishEditScore(0);
            var expectedScore = angular.copy(originalMockScores[0]);
            expectedScore.something = "foo";
            expect(scoresMock.update).toHaveBeenCalledWith(0, expectedScore);
        });
    });

    describe('cancelEditScore',function() {
        it('should not cause update to scores',function() {
            $scope.editScore(0);
            $scope.cancelEditScore(0);
            expect($scope.editing[0]).not.toBeDefined();
            expect(scoresMock._update).not.toHaveBeenCalled();
        });
    });

    describe('publishScore',function() {
        it('should publish a score and save it',function() {
            $scope.publishScore(0);
            var expectedScore = angular.copy(originalMockScores[0]);
            expectedScore.published = true;
            expect(scoresMock.update).toHaveBeenCalledWith(0, expectedScore);
            expect(scoresMock.save).toHaveBeenCalled();
        });
    });

    describe('unpublishScore',function() {
        it('should unpublish a score and save it',function() {
            $scope.unpublishScore(0);
            expect(scoresMock.update).toHaveBeenCalledWith(0, originalMockScores[0]);
            expect(scoresMock.save).toHaveBeenCalled();
        });
    });

    describe('pollSheets',function() {
        xit('should call pollSheets of scores',function() {
            $scope.pollSheets();
            expect(scoresMock.pollSheets).toHaveBeenCalled();
        });

        it('should alert on fail',function() {
            scoresMock.pollSheets.and.returnValue($q.reject(new Error('foo')));
            $scope.pollSheets();
            expect(scoresMock.pollSheets).toHaveBeenCalled();
            $scope.$digest();
            expect($window.alert).toHaveBeenCalledWith('failed to poll sheets: Error: foo');
        });
    });

    describe('refresh',function() {
        it('should call load of scores',function() {
            $scope.refresh();
            expect(scoresMock.load).toHaveBeenCalled();
        });
    });
});
