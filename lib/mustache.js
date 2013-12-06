var Mustache;
(function (Mustache) {
    'use strict';

    var hogan = require('hogan.js');

    var Parser = (function () {
        function Parser(buffer, p) {
            this.path = '';
            this.compiled = '';
            this.path = p;
            this.parse(buffer.toString());
        }
        Parser.prototype.parse = function (buffer) {
            this.compiled = hogan.compile(buffer, { asString: true });
        };

        Parser.prototype.print = function (stream) {
            stream.write('function (context, model) {');
            stream.write("var result = '';");
            stream.write('var compiled = new Hogan.Template(' + this.compiled + ');');
            stream.write('result += compiled.render(model);');
            stream.write('return result;');
            stream.write('}');
        };
        return Parser;
    })();
    ;

    exports.parse = function parse(buffer, path) {
        return new Parser(buffer, path);
    };
})(Mustache || (Mustache = {}));
