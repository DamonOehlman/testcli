var assert = require('assert'),
    async = require('async'),
    debug = require('debug')('testcli'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf'),
    reExpected = /(\/|\\)expected\-/ig;
    
function checkGeneratedPaths(targetPath, callback) {
    debug('checking generated paths matches expected for: ' + targetPath);
    
    // find expected folders in the target path and rimraf their generated equivalents
    fs.readdir(targetPath, function(err, files) {
        var expectedPaths = (files || []).filter(isExpected).map(path.join.bind(path, targetPath));
        
        async.forEach(expectedPaths, validateContents, callback);
    });
    
}
    
function isExpected(name) {
    // ensure name is lowercase
    name = (name || '').toLowerCase();
    
    return name !== 'expected-stdout' && name.indexOf('expected-') === 0;
}
    
function blitzExpected(targetPath, callback) {
    debug('looking to blitz generated paths in path: ' + targetPath);
    
    // find expected folders in the target path and rimraf their generated equivalents
    fs.readdir(targetPath, function(err, files) {
        var generatedPaths = (files || [])
                                .filter(isExpected)
                                .map(path.join.bind(null, targetPath))
                                .map(function(filename) {
                                    return filename.replace(reExpected, '$1');
                                });
        
        debug('blitzing expected paths', generatedPaths);
        async.forEach(generatedPaths, validateContents, callback);
    });
}
    
function runCommand(targetPath, command, callback) {
    fs.readFile(path.join(targetPath, 'expected-STDOUT'), 'utf8', function(err, expectedContent) {
        debug('running command: "' + command + '" in dir: ', targetPath);
        exec(command, { cwd: targetPath }, function(err, output) {
            callback(err, output, expectedContent);
        });
    });
    
}

function validateContents(targetPath, callback) {
    debug('validating: ' + targetPath);
    fs.stat(targetPath, function(err, stats) {
        if (stats.isDirectory()) {
            // read the contents of the directory
            fs.readdir(targetPath, function(err, files) {
                // join the target path to the files
                files = 

                async.forEach(
                    (files || []).map(path.join.bind(null, targetPath)),
                    validateContents,
                    callback
                );
            });
        }
        else {
            // generate the name of it's test counterpart
            var testTargetFile = targetPath.replace(reExpected, '$1');
            
            async.map([testTargetFile, targetPath], fs.readFile, function(err, results) {
                assert.ifError(err, 'Cannot validate expected vs actual for: ' + targetPath);
                
                assert.equal(results[0].toString(), results[1].toString(), 'Actual does not match expected for : ' + targetPath);
                callback();
            });
        }
    });
}

function testcli(basePath) {
    return function(folder) {
        var targetPath = path.resolve(basePath, folder),
            tasks = [
                blitzExpected.bind(null, targetPath),
                fs.readFile.bind(fs, path.join(targetPath, 'command'), 'utf8'),
                runCommand.bind(null, targetPath)
            ];

        return function(done) {
            async.waterfall(tasks, function(err, output, expectedOutput) {
                // assert we don't have an error
                assert.ifError(err);
                
                // if we have expected output, check that we have a match
                if (typeof expectedOutput != 'undefined') {
                    assert.equal(output, expectedOutput);
                }
                
                // now check the expected paths vs generated paths contents
                checkGeneratedPaths(targetPath, done);
            });
        };
    };
}

module.exports = testcli;