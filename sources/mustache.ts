
declare var exports;
declare var require;
	
module Mustache {
	'use strict';
	
	var hogan = require('hogan.js');
	
	class 	Parser {
		compiled;
		path = '';
		
		constructor(buffer, p) {
			this.compiled = '';
			this.path = p;
			this.parse(buffer.toString());
		}
		
		parse(buffer) {
			this.compiled = hogan.compile(buffer, {asString: true});
		}
		
		print(stream) {
			stream.write('function (context, model) {');
			stream.write("var result = '';");
			stream.write('var compiled = new Hogan.Template('+ this.compiled + ');');
			stream.write('result += compiled.render(model);');
			stream.write('return result;');
			stream.write('}');
		}
	};
	
	exports.parse = function parse(buffer, path) {
		return new Parser(buffer, path);
	};
}


