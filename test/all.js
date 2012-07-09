var testcli = require('../')(__dirname);

describe('testcli checking output tests', function() {
    it('should be able to check compare STDOUT', testcli('test-echo'));
});

describe('testcli checking generated files', function() {
    it('should be able to check that a file is generated in a specified directory', testcli('test-echo-tofile'));
});