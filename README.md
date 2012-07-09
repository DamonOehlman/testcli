# TestCLI

This is a small test helper that is designed to be used with [Mocha](http://visionmedia.github.com/mocha/) and provides the ability to test that a command-line tool (that generally creates files, generates output, etc) is behaving as expected.  I've written a few node command-line applications and testing them has proven to be tedious, so this tool has been written to assist with the process.

## Writing Tests

A test for TestCLI starts with a directory.  In that directory is a `command` file which contains the command that will be passed to [child_process.exec](http://nodejs.org/docs/latest/api/child_process.html#child_process_child_process_exec_command_options_callback) and run.

Once the command has completed, TestCLI will then proceed to check that expected results match the actual results.  How does it do this?  Well it looks for files / folders that start with the word `expected-`.  For instance, the following is an example folder structure that is used in the [Interleave](/DamonOehlman/interleave) tests:

    - simple-build
    |- command
    |- src/
    |- expected-dist/

Now, Interleave is a build tool that typically creates a `dist` folder with a number of files that have been "built".  The `expected-dist` folder in the directory indicates to TestCLI that it should expect to find a `dist` folder after the command has completed.  In fact TestCLI is pretty aggressive in this regard, and if you specify an `expected-foo` folder in your test directory, it will [rimraf](https://github.com/isaacs/rimraf) any existing `foo` directory out of there before running the command (so don't put anything important in there, and ideally exclude them from version control).

If a file in the `expected-foo` folder does not exist (deep nesting supported) in the generated `foo` folder output, then this will result in an error condition.  Unexpected files in the `foo` folder will not constitute a failure but a warning will be reported.

For some samples, have a look in the `test` folder of this repo.