#!/usr/bin/env node

var	fs 			= require('fs');
var log 		= require('color-log');
var execSync 	= require('exec-sync');

var bin			= __dirname + '/../bin/wkc';

var error 	= [];
var success = [];

var currentError = '';

function addError(idx, elm) {
	log.error('\tFAILED: ' + currentError + '\n');
	error.push('[' + idx + ']' + ' ' + elm.name);
}

function addSuccess(idx, elm) {
	log.info('\tPASSED\n');
	success.push('[' + idx + ']' + ' ' + elm.name)
}

function recap() {
	log.info('FAILLED');
	error.forEach(function (elm) { log.error('  -' + elm) });
	log.info('SUCCESS');
	success.forEach(function (elm) { log.info('  -' + elm) });
	log.info('\nTOTAL = ' + success.length + '/' + (success.length + error.length));
}

//////

function launchDiffs(idx, nbrTest, elm) {
	for (var i = 0; i < elm.result.length; i++) {
		var command = 'diff ' + elm.result[i].ref + ' ' + elm.result[i].res;

		try {
			var ret = execSync(command);
			return (ret.length == 0);
		} catch (e) {
			currentError = e;
			return (false);
		}
	}
	
}

function launchTest(idx, nbrTest, elm) {
	var command = bin + ' ' + elm.command;

	console.log('-[' + idx + '/' + nbrTest + ']\t' + elm.name);
	console.log(' \\__ ' + command);
	
	try {
		var ret = execSync(command);
		return (launchDiffs(idx, nbrTest, elm));
	} catch (e) {
		currentError = e;
		return (false)
	}
}

function main() {
	var file = fs.readFileSync(__dirname + '/unit.json');
	var unit = JSON.parse(file);
	var nbrTest = unit.tests.length - 1;

	console.log(unit.name);

	unit.tests.forEach(function (elm, idx) {
		(!launchTest(idx, nbrTest, elm)) ? (addError(idx, elm)) : (addSuccess(idx, elm));
	});
	recap();

}


////



main();

