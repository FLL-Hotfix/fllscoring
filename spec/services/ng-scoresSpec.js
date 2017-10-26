describe('ng-scores',function() {
    "use strict";
    var module;
    var $scores;
    var $stages;
    var $teams;
    var $q;
    var dummyTeam =  {
        number: 123,
        name: 'foo'
    };
    var rawMockStage = { id: "test", rounds: 3, name: "Test stage" };
    var rawMockScore = {
        file: 'somescore.json',
        teamNumber: 123,
        stageId: "test",
        round: 1,
        score: 150,
        originalScore: 150,
        published: false,
        edited: undefined,
        table: undefined
    };
    var mockStage;
    var mockScore;
    var mockTeam;
    var fsMock;

    beforeEach(function() {
        module = factory('services/ng-scores',{
            'services/log': logMock,
            'services/fs': {},
        });
        fsMock = createFsMock({
            "scores.json": { version: 2, scores: [rawMockScore], sheets: [] },
            "stages.json": [rawMockStage],
            "teams.json": [dummyTeam]
        });
        angular.mock.module(module.name);
        angular.mock.module(function($provide) {
            $provide.value('$fs', fsMock);
        });
        angular.mock.inject(["$scores", "$stages", "$teams", "$q", function(_$scores_, _$stages_, _$teams_,_$q_) {
            $scores = _$scores_;
            $stages = _$stages_;
            $teams = _$teams_;
            $q = _$q_;
        }]);

        return $stages.init().then(function() {
            mockStage = $stages.get(rawMockStage.id);
            return $teams.init();
        }).then(function() {
            mockTeam = $teams.get(dummyTeam.number);
            mockScore = {
                file: 'somescore.json',
                team: mockTeam,
                stage: mockStage,
                round: 1,
                score: 150,
                originalScore: 150
            };
            return $scores.init();
        });
    });

    // Strip autogenerated properties to (hopefully ;)) arrive at the same
    // object as what was used as input to $scores.add().
    function filteredScores() {
        return $scores.scores.map(function(score) {
            return {
                file: score.file,
                team: score.team,
                stage: score.stage,
                round: score.round,
                score: score.score,
                originalScore: score.originalScore
            };
        });
    }

    describe('init',function() {
        it('should load mock score initially',function() {
            expect(filteredScores()).toEqual([mockScore]);
        });
    });

    describe('clear',function() {
        it('should clear the scores',function() {
            expect(filteredScores()).toEqual([mockScore]);
            $scores.clear();
            expect(filteredScores()).toEqual([]);
        });
    });

    describe('save',function() {
        it('should write scores to scores.json',function() {
            return $scores.save().then(function() {
                expect(fsMock.write).toHaveBeenCalledWith(
                    'scores.json',
                    {
                        version: 2,
                        scores: [rawMockScore],
                        sheets: []
                    }
                );
            });
        });

        it('should log an error if writing fails',function() {
            fsMock.write.and.returnValue(Q.reject('write err'));
            return $scores.save().then(function() {
                expect(logMock).toHaveBeenCalledWith('scores write error','write err');
            });
        });
    });

    describe('load',function() {
        it('should load from scores.json',function() {
            return $scores.load().then(function() {
                expect(fsMock.read).toHaveBeenCalledWith('scores.json');
                expect(filteredScores()).toEqual([mockScore]);
            });
        });

        it('should log an error if loading fails',function() {
            fsMock.read.and.returnValue(Q.reject('read err'));
            return $scores.load().then(function() {
                expect(logMock).toHaveBeenCalledWith('scores read error','read err');
            });
        });
    });

    describe('remove',function() {
        it('should remove the provided index', function() {
            expect(filteredScores()).toEqual([mockScore]);
            $scores.remove(0);
            expect(filteredScores()).toEqual([]);
        });
    });

    describe('add',function() {
        beforeEach(function() {
            $scores.clear();
            expect(filteredScores()).toEqual([]);
        });
        it('should add a score to the list', function() {
            $scores.add(mockScore);
            expect(filteredScores()).toEqual([mockScore]);
        });
        it('should allow duplicates', function() {
            // Duplicate scores are 'allowed' during adding, but
            // are rejected in scoreboard computation.
            $scores.add(mockScore);
            $scores.add(mockScore);
            expect(filteredScores()).toEqual([mockScore, mockScore]);
            expect($scores.validationErrors.length).toBeGreaterThan(0);
        });
        it('should accept numeric scores as strings', function() {
            var tmp = angular.copy(mockScore);
            tmp.score = String(tmp.score);
            $scores.add(tmp);
            // Note: the 'accepted' score should really be a number, not a string
            expect($scores.scores[0].score).toEqual(150);
            expect($scores.validationErrors.length).toEqual(0);
        });
        it('should accept and convert different casing for DNC', function() {
            var tmp = angular.copy(mockScore);
            tmp.score = "DnC";
            $scores.add(tmp);
            expect($scores.scores[0].score).toEqual("dnc");
            expect($scores.validationErrors.length).toEqual(0);
        });
        it('should accept and convert different casing for DSQ', function() {
            var tmp = angular.copy(mockScore);
            tmp.score = "DsQ";
            $scores.add(tmp);
            expect($scores.scores[0].score).toEqual("dsq");
            expect($scores.validationErrors.length).toEqual(0);
        });
        it('should reject but convert an empty score', function() {
            var tmp = angular.copy(mockScore);
            tmp.score = "";
            $scores.add(tmp);
            expect($scores.scores[0].score).toEqual(null);
            expect($scores.validationErrors.length).toEqual(1);
        });
        it('should store the edited date of a score as string',function() {
            var tmp = angular.copy(mockScore);
            tmp.edited = new Date(2015,1,7);
            $scores.add(tmp);
            expect(typeof $scores.scores[0].edited).toBe('string');
        });
    });

    describe('update', function() {
        beforeEach(function() {
            $scores.clear();
            $scores.add(mockScore);
        });
        it('should mark modified scores', function() {
            mockScore.score++;
            // Simply changing the added score shouldn't matter...
            expect($scores.scores[0].score).toEqual(150);
            // ... but updating it should
            $scores.update(0, mockScore);
            expect($scores.scores[0].originalScore).toEqual(150);
            expect($scores.scores[0].score).toEqual(151);
            expect($scores.scores[0].modified).toBeTruthy();
            expect($scores.scores[0].edited).toBeTruthy();
        });
        it('should accept numeric scores as strings',function() {
            mockScore.score = "151";
            $scores.update(0, mockScore);
            // Note: the 'accepted' score should really be a number, not a string
            expect($scores.scores[0].originalScore).toEqual(150);
            expect($scores.scores[0].score).toEqual(151);
        });
        it('should throw an error if a score out of range is edited',function() {
            var f = function() {
                $scores.update(-1,mockScore);
            };
            expect(f).toThrowError('unknown score index: -1');
        });
        it('should throw an error if a score out of range is edited',function() {
            var f = function() {
                $scores.update(1,mockScore);
            };
            expect(f).toThrowError('unknown score index: 1');
        });
    });

    describe('isValidScore', function () {
        it('should accept valid scores', function () {
            expect($scores.isValidScore(0)).toBe(true);
            expect($scores.isValidScore(-1)).toBe(true);
            expect($scores.isValidScore(1000)).toBe(true);
            expect($scores.isValidScore("dnc")).toBe(true); // Did Not Compete
            expect($scores.isValidScore("dsq")).toBe(true); // DiSQualified
        });

        it('should reject invalid scores', function () {
            expect($scores.isValidScore(undefined)).toBe(false);
            expect($scores.isValidScore(null)).toBe(false);
            expect($scores.isValidScore(NaN)).toBe(false);
            expect($scores.isValidScore(Infinity)).toBe(false);
            expect($scores.isValidScore(-Infinity)).toBe(false);
            expect($scores.isValidScore("dnq")).toBe(false);
            expect($scores.isValidScore("foo")).toBe(false);
            expect($scores.isValidScore(true)).toBe(false);
            expect($scores.isValidScore(false)).toBe(false);
            expect($scores.isValidScore({})).toBe(false);
            expect($scores.isValidScore([])).toBe(false);
        });
    });

    describe('scoreboard', function() {
        var board;
        beforeEach(function() {
            board = $scores.scoreboard;
        });
        function fillScores(input, allowErrors) {
            $scores.beginupdate();
            $scores.clear();
            input.map(function(score) {
                score.published = true;
                $scores.add(score);
            });
            $scores.endupdate();
            if (!allowErrors) {
                $scores.scores.forEach(function(score) {
                    expect(score.error).toBeFalsy();
                });
            }
        }
        var team1 = { number: 1, name: "Fleppie 1" };
        var team2 = { number: 2, name: "Fleppie 2" };
        var team3 = { number: 3, name: "Fleppie 3" };
        var team4 = { number: 4, name: "Fleppie 4" };

        beforeEach(function() {
            $teams.clear();
            $teams.add(team1);
            $teams.add(team2);
            $teams.add(team3);
            $teams.add(team4);
        });

        it('should output used stages', function() {
            fillScores([]);
            expect(Object.keys(board)).toEqual(["test"]);
        });

        it('should fill in all rounds for a team', function() {
            // If a team has played at all (i.e., they have a score for that stage)
            // then all other rounds for that team need to have an entry (which can
            // be null).
            fillScores([
                { team: team1, stage: mockStage, round: 2, score: 10 }
            ]);
            expect(board["test"][0].scores).toEqual([null, 10, null]);
        });

        it('should rank number > dnc > dsq > null', function() {
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: 'dsq' },
                { team: team2, stage: mockStage, round: 1, score: 'dnc' },
                { team: team3, stage: mockStage, round: 1, score: -1 },
                { team: team4, stage: mockStage, round: 1, score: 1 },
            ]);
            var result = board["test"].map(function(entry) {
                return {
                    rank: entry.rank,
                    teamNumber: entry.team.number,
                    highest: entry.highest
                };
            });
            expect(result).toEqual([
                { rank: 1, teamNumber: team4.number, highest: 1 },
                { rank: 2, teamNumber: team3.number, highest: -1 },
                { rank: 3, teamNumber: team2.number, highest: 'dnc' },
                { rank: 4, teamNumber: team1.number, highest: 'dsq' },
            ]);

        });

        it("should assign equal rank to equal scores", function() {
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: 10 },
                { team: team1, stage: mockStage, round: 2, score: 20 },
                { team: team1, stage: mockStage, round: 3, score: 30 },
                { team: team2, stage: mockStage, round: 1, score: 30 },
                { team: team2, stage: mockStage, round: 2, score: 10 },
                { team: team2, stage: mockStage, round: 3, score: 20 },
                { team: team3, stage: mockStage, round: 1, score: 30 },
                { team: team3, stage: mockStage, round: 2, score: 0 },
                { team: team3, stage: mockStage, round: 3, score: 20 },
            ]);
            var result = board["test"].map(function(entry) {
                return {
                    rank: entry.rank,
                    teamNumber: entry.team.number,
                    highest: entry.highest
                };
            });
            // Note: for equal ranks, teams are sorted according
            // to (ascending) team id
            expect(result).toEqual([
                { rank: 1, teamNumber: team1.number, highest: 30 },
                { rank: 1, teamNumber: team2.number, highest: 30 },
                { rank: 2, teamNumber: team3.number, highest: 30 },
            ]);
        });

        it("should allow filtering rounds", function() {
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: 10 },
                { team: team1, stage: mockStage, round: 2, score: 20 },
                { team: team1, stage: mockStage, round: 3, score: 30 },
                { team: team2, stage: mockStage, round: 1, score: 30 },
                { team: team2, stage: mockStage, round: 2, score: 10 },
                { team: team2, stage: mockStage, round: 3, score: 20 },
                { team: team3, stage: mockStage, round: 1, score: 30 },
                { team: team3, stage: mockStage, round: 2, score: 0 },
                { team: team3, stage: mockStage, round: 3, score: 20 },
            ]);
            var scoreboard = $scores.getRankings({
                "test": 2
            });
            var result = scoreboard["test"].map(function(entry) {
                return {
                    rank: entry.rank,
                    teamNumber: entry.team.number,
                    scores: entry.scores
                };
            });
            // Note: for equal ranks, teams are sorted according
            // to (ascending) team id
            expect(result).toEqual([
                { rank: 1, teamNumber: team2.number, scores: [30, 10] },
                { rank: 2, teamNumber: team3.number, scores: [30, 0] },
                { rank: 3, teamNumber: team1.number, scores: [10, 20] },
            ]);
        });

        it("should include but warn about scores for unknown rounds / stages", function() {
            fillScores([
                { team: team1, stage: { id: "foo" }, round: 1, score: 0 },
                { team: team1, stage: mockStage, round: 0, score: 0 },
                { team: team1, stage: mockStage, round: 4, score: 0 },
            ], true);
            expect($scores.scores[0].error).toEqual(jasmine.any($scores.UnknownStageError));
            expect($scores.scores[1].error).toEqual(jasmine.any($scores.UnknownRoundError));
            expect($scores.scores[2].error).toEqual(jasmine.any($scores.UnknownRoundError));
            expect(board["test"].length).toEqual(1);
            expect($scores.validationErrors.length).toEqual(3);
        });

        it("should ignore but warn about invalid score", function() {
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: "foo" },
                { team: team1, stage: mockStage, round: 2, score: NaN },
                { team: team1, stage: mockStage, round: 3, score: Infinity },
                { team: team2, stage: mockStage, round: 1, score: {} },
                { team: team2, stage: mockStage, round: 2, score: true },
            ], true);
            $scores.scores.forEach(function(score) {
                expect(score.error).toEqual(jasmine.any($scores.InvalidScoreError));
            });
            expect(board["test"].length).toEqual(0);
            expect($scores.validationErrors.length).toEqual(5);
        });

        it("should include but warn about duplicate score", function() {
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: 10 },
                { team: team1, stage: mockStage, round: 1, score: 20 },
            ], true);
            expect($scores.validationErrors.length).toBe(2);
            expect($scores.scores[0].error).toEqual(jasmine.any($scores.DuplicateScoreError));
            expect($scores.scores[1].error).toEqual(jasmine.any($scores.DuplicateScoreError));
            // Last score will overwrite any previous entry
            expect(board["test"][0].highest).toEqual(20);
        });

        it("should ignore but warn about invalid team", function() {
            $teams.remove(team1.number);
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: 10 },
            ], true);
            expect($scores.scores[0].error).toEqual(jasmine.any($scores.UnknownTeamError));
            expect($scores.validationErrors.length).toEqual(1);
        });

        it("should allow resolving error", function() {
            fillScores([
                { team: team1, stage: mockStage, round: 1, score: 10 },
                { team: team1, stage: mockStage, round: 1, score: 20 },
            ], true);
            expect($scores.validationErrors.length).toBeGreaterThan(0);
            $scores.update(1, { team: team1, stage: mockStage, round: 2, score: 20 });
            expect($scores.validationErrors.length).toEqual(0);
        });
    });

    describe("pollSheets", function() {
        var importedScore;
        var mockFiles;
        var mockDirs;

        beforeEach(function() {
            importedScore = {
                file: "sheet_1.json",
                team: mockTeam,
                stage: mockStage,
                round: 1,
                score: 456,
                originalScore: 456
            };
            mockFiles = {
                "scores.json": { version: 2, scores: [], sheets: [] },
                "scoresheets/sheet_1.json": { teamNumber: 123, stageId: "test", round: 1, score: 456 }
            };
            mockDirs = {
                "scoresheets": ["sheet_1.json"],
            };
            fsMock._setFiles(mockFiles);
            fsMock._setDirs(mockDirs);
            $scores.clear();
        });

        it("should pick up a new sheet", function() {
            return $scores.pollSheets().then(function() {
                expect(filteredScores()).toEqual([importedScore]);
            });
        });

        it("should ignore already processed sheets", function() {
            return $scores.pollSheets().then(function() {
                expect($scores.scores.length).toEqual(1);
                return $scores.pollSheets();
            }).then(function() {
                expect($scores.scores.length).toEqual(1);
            });
        });

        it("should ignore already processed sheets across loads", function() {
            mockFiles["scores.json"] = { version: 2, scores: [], sheets: ["sheet_1.json"] };
            return $scores.load().then(function() {
                return $scores.pollSheets();
            }).then(function() {
                expect($scores.scores.length).toEqual(0);
            });
        });

        it("should remember processed sheets", function() {
            return $scores.pollSheets().then(function() {
                expect(fsMock.write).toHaveBeenCalledWith(
                    'scores.json',
                    {
                        version: 2,
                        scores: [{
                            file: "sheet_1.json",
                            teamNumber: 123,
                            stageId: "test",
                            round: 1,
                            score: 456,
                            originalScore: 456,
                            published: false,
                            edited: undefined,
                            table: undefined,
                        }],
                        sheets: ["sheet_1.json"]
                    }
                );
            });
        });

        describe('clicking the button twice should not poll twice (#172)',function() {
            it('should not add the same sheet twice',function() {
                return $q.all([
                    $scores.pollSheets(),
                    $scores.pollSheets()
                ]).then(function() {
                    expect($scores.scores.length).toEqual(1);
                });
            });
        });

        describe('error recovery',function() {
            it('should continue with no sheets when a 404 is returned',function() {
                fsMock.list.and.returnValue(Q.reject({status:404}));
                $scores.save = jasmine.createSpy('save');
                return $scores.pollSheets().then(function() {
                    expect(fsMock.write).not.toHaveBeenCalled();
                    expect($scores.save).not.toHaveBeenCalled();
                });
            });

            it('throw an error if an http error is received',function() {
                fsMock.list.and.returnValue(Q.reject({status:500,responseText:'server error',statusText:'foo'}));
                return $scores.pollSheets().catch(function(err) {
                    expect(err.message).toEqual('error 500 (foo): server error');
                });
            });

            it('should rethrow the error if something just goes wrong',function() {
                fsMock.list.and.returnValue(Q.reject(new Error('squeek')));
                return $scores.pollSheets().catch(function(err) {
                    expect(err.message).toEqual('squeek');
                });
            });

            it('should throw an unknown error if strange stuff is returned',function() {
                fsMock.list.and.returnValue(Q.reject('darn'));
                return $scores.pollSheets().catch(function(err) {
                    expect(err.message).toEqual('unknown error: darn');
                });
            });
        });
    });

});

