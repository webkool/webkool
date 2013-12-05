
declare var exports;
declare var require;
	
module Sass {
	'use strict';
	
	var sass = require('node-sass');

	exports.compile = function compile(buffer, stream) {
		stream.write(sass.renderSync({
			data:		buffer,
			error:		function (e) {
				throw Error(e);
			}
		}));
	};
}


