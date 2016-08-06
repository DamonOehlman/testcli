/* jshint node: true */

/**
  # TestCLI

  This is a small test helper that is designed to be used with
  [Mocha](http://visionmedia.github.com/mocha/) and provides the ability to
  test that a command-line tool (that generally creates files, generates
  output, etc) is behaving as expected.  I've written a few node command-line
  applications and testing them has proven to be tedious, so this tool has
  been written to assist with the process.

  ## Writing Tests

  A test for TestCLI starts with a directory.  In that directory is a
  `command` file which contains the command that will be passed to
  [child_process.exec](http://nodejs.org/docs/latest/api/child_process.html#child_process_child_process_exec_command_options_callback)
  and run.

  Once the command has completed, TestCLI will then proceed to check that
  expected results match the actual results.  How does it do this?  Well it
  looks for files / folders that start with the word `expected-`.  For
  instance, the following is an example folder structure that is used in the
  [Interleave](/DamonOehlman/interleave) tests:

      - simple-build
      |- command
      |- src/
      |- expected-dist/

  Now, Interleave is a build tool that typically creates a `dist` folder
  with a number of files that have been "built".  The `expected-dist` folder
  in the directory indicates to TestCLI that it should expect to find a
  `dist` folder after the command has completed.  In fact TestCLI is pretty
  aggressive in this regard, and if you specify an `expected-foo` folder
  in your test directory, it will [rimraf](https://github.com/isaacs/rimraf)
  any existing `foo` directory out of there before running the command
  (so don't put anything important in there, and ideally exclude them from
  version control).

  If a file in the `expected-foo` folder does not exist (deep nesting
  supported) in the generated `foo` folder output, then this will result in
  an error condition.  Unexpected files in the `foo` folder will not
  constitute a failure but a warning will be reported.

  For some samples, have a look in the `test` folder of this repo.
**/

var assert = require('assert');
var async = require('async');
var debug = require('debug')('testcli');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var reExpected = /(\/|\\)expected\-/ig;
var reLineBreak = /\r?\n/g;

function checkGeneratedPaths(targetPath, callback) {
  debug('checking generated paths matches expected for: ' + targetPath);

  // find expected folders in the target path and rimraf their generated equivalents
  fs.readdir(targetPath, function(err, files) {
    var expectedPaths = (files || []).filter(isExpected).map(function(child) {
      return path.join(targetPath, child);
    });
    
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
          .map(function(child) {
            return path.join(targetPath, child);
          })
          .map(function(filename) {
            return filename.replace(reExpected, '$1');
          });

    debug('blitzing expected paths', generatedPaths);
    async.forEach(generatedPaths, rimraf, callback);
  });
}
    
function runCommand(targetPath, command, callback) {
  fs.readFile(path.join(targetPath, 'expected-STDOUT'), 'utf8', function(err, expectedContent) {
    // make the command win32 friendly
    // TODO: needs test cases
    if (process.platform == 'win32') {
      command = 'node ' + command.replace(/\//g, '\\');
    }

    debug('running command: "' + command + '" in dir: ', targetPath);
    exec(command, { cwd: targetPath }, function(err, output) {
      callback(err, output, expectedContent);
    });
  });
}

function validateContents(targetPath, callback) {
  debug('validating: ' + targetPath);
  fs.stat(targetPath, function(err, stats) {
    if (err) return callback(err);
    
    if (stats.isDirectory()) {
      // read the contents of the directory
      fs.readdir(targetPath, function(err, files) {
        async.forEach(
          (files || []).map(function(child) {
            return path.join(targetPath, child);
          }),
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

        // normalize the test files
        results = results.map(function(buffer) {
          var lines = buffer.toString().split(reLineBreak);

          // remove any trailing newlines
          while (lines.slice(0, -1) === '') {
            lines.pop();
          }

          return lines.join('\n');
        });
        
        assert.equal(results[0], results[1], 'Actual does not match expected for : ' + targetPath);
        callback();
      });
    }
  });
}

module.exports = function(basePath) {
  return function(folder) {
    var targetPath = path.resolve(basePath, folder);
    var tasks = [
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
};
