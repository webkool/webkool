var Less;
(function (Less) {
    'use strict';

    var less = require('less');

    exports.compile = function compile(buffer) {
        var m = less.render(buffer, function (e, css) {
            if (e)
                throw Error(e);
            return (css);
        });
        console.log("res");
        console.log(m);
        return (m);
    };
})(Less || (Less = {}));
