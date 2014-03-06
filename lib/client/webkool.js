/*
on_render ---> doRender using model.json()
include dans model un access au dom (notre propre getElementById)
*/
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var httpDate;
(function (httpDate) {
    var asctime = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (..| .) (..):(..):(..) (....)$/, rfc1123 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (..) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (....) (..):(..):(..) (.*)$/, rfc850 = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (..)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(..) (..):(..):(..) GMT$/, month = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

    function parse(d) {
        if (d) {
            var match = d.match(rfc1123);
            if (match) {
                if (!isNaN(parseInt(match[8], 10)))
                    match[5] = Math.floor(parseInt(match[5], 10) - parseInt(match[8], 10) / 100);

                return new Date(Date.UTC(match[4], month[match[3]], match[2], match[5], match[6], match[7]));
            }

            match = d.match(rfc850);
            if (match)
                return new Date(Date.UTC(match[4], month[match[3]], match[2], match[5], match[6], match[7]));

            match = d.match(asctime);
            if (match)
                return new Date(Date.UTC(match[7], month[match[2]], match[3], match[4], match[5], match[6]));

            console.log('# Date format was not recognize: ' + d + '\n');
        }
        return new Date();
    }
    httpDate.parse = parse;
})(httpDate || (httpDate = {}));

var Model = (function () {
    function Model() {
    }
    Model.prototype.include = function (url) {
        return application.renderWithModel(this, url);
    };

    Model.prototype.json = function (target) {
        var result;
        if (target) {
            result = JSON.stringify(target, null, 4);
        } else {
            result = JSON.stringify(this, null, 4);
        }
        return result;
    };

    Model.prototype.escapeHTML = function (s) {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    return Model;
})();

var Context = (function () {
    function Context(request, response) {
        this.request = request;
        this.response = response;
        this.handlers = [];
        this.queries = [];
        this.model = application.getModel();
    }
    Context.prototype.dequeue = function (handler) {
        var index = this.handlers.indexOf(handler);
        if (index < 0)
            console.log('>>>> DEQUEUE UNKNOWN HANDLER');
        this.handlers.splice(index, 1);
        this.queries.splice(index, 1);
        this.synchronize();
    };

    Context.prototype.queue = function (handler, query) {
        var index = this.queries.indexOf(query);
        this.queries[index] = null;
    };

    Context.prototype.synchronize = function () {
        var handler, query;
        if (this.handlers.length > 0) {
            if (this.queries[this.queries.length - 1]) {
                handler = this.handlers.pop();
                query = this.queries.pop();
                handler.on_complete(this, this.model, query);
                this.synchronize();
            }
        } else {
            handler = this.rootHandler;
            query = this.rootQuery;
            if (handler) {
                var buffer, text;
                if (this.response) {
                    try  {
                        text = handler.on_render(this, this.model, query);
                        if (text) {
                            buffer = new Buffer(text);
                            this.response.writeHead(200, { 'Content-Type': handler.contentType, 'Content-Length': buffer.length });
                            this.response.end(buffer);
                        }
                    } catch (e) {
                        throw e;
                    }
                } else {
                    text = handler.on_render(this, this.model, query);
                    if (text) {
                        document.body.innerHTML = handler.on_render(this, this.model);
                        handler.on_load(this, this.model, query);
                    }
                }
            }
            this.rootHandler = this.rootQuery = undefined;
        }
    };

    Context.prototype.wait = function (handler, query) {
        if (!this.rootHandler && handler.contentType) {
            this.rootHandler = handler;
            this.rootQuery = query;
        }
        this.handlers.push(handler);
        this.queries.push(query);
    };
    return Context;
})();

var Handler = (function () {
    function Handler() {
        this.contentType = 'text/html';
    }
    Handler.prototype.on_checkAccess = function (context, model, query) {
        return true;
    };

    Handler.prototype.on_complete = function (context, model, query) {
        return;
    };

    Handler.prototype.on_error = function (context, model, query, error) {
        application.internalError(context, error);
    };

    Handler.prototype.on_filter = function (context, model, query) {
        return false;
    };

    Handler.prototype.on_load = function (context, model, query) {
        return;
    };

    Handler.prototype.on_request = function (context, model, query) {
        return;
    };

    Handler.prototype.on_render = function (context, model, query) {
        return '';
    };

    Handler.prototype.on_sqlResult = function (context, model, query, result) {
        return result;
    };

    Handler.prototype.redirect = function (context, url, query) {
        context.rootHandler = context.rootQuery = undefined;
        application.requestWithContext(context, url, query, false);
    };

    Handler.prototype.request = function (context, url, query) {
        application.requestWithContext(context, url, query, false);
    };
    return Handler;
})();

var Observer = (function () {
    function Observer() {
        this.targets = [];
        this.observables = [];
        this.value = '';
        return (this);
    }
    Observer.prototype.attach = function (selector) {
        var target = document.getElementById(selector);
        this.applyListeners(target);
        this.targets.push(target);
        return (this);
    };

    Observer.prototype.bind = function (observable) {
        this.observables.push(observable);
    };

    Observer.prototype.set = function (value) {
        for (var i = 0; i < this.targets.length || i < this.observables.length; i++) {
            if (i < this.targets.length) {
                this.targets[i].setValue(value);
            }
            if (i < this.observables.length) {
                this.observables[i].value = value;
            }
        }
        return (this);
    };

    Observer.prototype.get = function () {
        return (this.value);
    };

    Observer.prototype.applyListeners = function (target) {
        var _this = this;

        if (target.is('input')) {
            target.getValue = function () {
                return (this.value);
            };
            target.setValue = function (value) {
                this.value = value;
            };
            target.addEventListener('input', function () {
                _this.set(target.getValue());
            });
        } else if (target.is('select')) {
            target.getValue = function () {
                return (this.innerHTML);
            };
            target.setValue = function (value) {
                this.innerHTML = value;
            };
            target.addEventListener('change', function () {
                _this.set(target.getValue());
            });
        } else {
            target.getValue = function () {
                return (this.text());
            };
            target.setValue = function (value) {
                this.text(value);
            };
        }
    };
    return Observer;
})();

var Observable = (function () {
    function Observable(value) {
        this.initialValue = value;
        this.value = value;
        this.observer = new Observer();
        this.observer.bind(this);
    }
    Observable.prototype.attach = function (selector) {
        this.observer.attach(selector);
        this.value = this.observer.get();
    };

    Observable.prototype.get = function () {
        return (this.value);
    };

    Observable.prototype.set = function (value) {
        this.observer.set(value);
        this.value = value;
    };
    return Observable;
})();

var Template = (function () {
    function Template() {
    }
    Template.prototype.on_render = function (context, model, query) {
        return '';
    };
    return Template;
})();

var Application = (function () {
    function Application() {
        this.static_handlers = {};
        this.dynamic_handlers = {};
        this.properties = {};
        this.templates = {};
    }
    Application.prototype.addHandler = function (method, url, handler) {
        var isDynamic = /:([^\/]+)/g;

        if (isDynamic.test(url)) {
            handler.compiled_route = this.compileRoute(url);
            if (!this.dynamic_handlers.hasOwnProperty(url))
                this.dynamic_handlers[url] = {};
            if (this.dynamic_handlers[url].hasOwnProperty(method))
                return (false);
            this.dynamic_handlers[url][method] = handler;
        } else {
            if (!this.static_handlers.hasOwnProperty(url))
                this.static_handlers[url] = {};
            if (this.static_handlers[url].hasOwnProperty(method))
                return (false);
            this.static_handlers[url][method] = handler;
        }
        return (true);
    };

    Application.prototype.addObserver = function (name, selector) {
        var model = this.getModel();
        if (model[name] === undefined)
            model[name] = new Observable('');
        model[name].attach(selector);
    };

    Application.prototype.addProperty = function (name, property) {
        this.properties[name] = property;
    };

    Application.prototype.addTemplate = function (name, template) {
        this.templates[name] = template;
    };

    Application.prototype.getModel = function () {
        if (!this.model) {
            this.model = new Model();
        }
        return this.model;
    };

    Application.prototype.handlerNotFound = function (context, url) {
        console.log('Handler "' + url + '" not found!');
    };

    Application.prototype.internalError = function (context, error) {
        throw (error);
    };

    Application.prototype.compileRoute = function (route) {
        var attrs = [];
        var reg_replace = /:([^\/]+)/gi;

        var compiled_route = route.replace(reg_replace, function (match, select) {
            attrs.push(select);
            return ('([^\/]+)');
        });
        compiled_route = '^' + compiled_route.replace(/\//gi, '\\/') + '$';
        var regexp = new RegExp(compiled_route, 'i');
        return ({
            regexp: regexp,
            fields: attrs
        });
    };

    Application.prototype.matchWithDynamicHandler = function (method, url, query) {
        var extract;
        var params = {};
        var handlers = this.dynamic_handlers;
        var route;
        var methodName;

        for (route in handlers) {
            methodName = null;
            if (handlers[route].hasOwnProperty(method))
                methodName = method;
            else if (handlers[route].hasOwnProperty('ALL'))
                methodName = 'ALL';
            if (methodName) {
                extract = handlers[route][methodName].compiled_route.regexp.exec(url);
                if (extract) {
                    for (var i = 1; i < extract.length; i++) {
                        query[handlers[route][methodName].compiled_route.fields[i - 1]] = extract[i];
                    }
                    return (handlers[route][methodName]);
                }
            }
        }
        return (null);
    };

    Application.prototype.parseQuery = function (url) {
        var query = {}, param, params, i, l;
        if (url) {
            params = url.split('&');
            l = params.length;
            for (i = 0; i < l; i += 1) {
                param = params[i].split('=');
                if (param.length == 2)
                    query[param[0]] = decodeURIComponent(param[1]);
            }
        }
        return query;
    };

    Application.prototype.request = function (url, query) {
        var context = new Context(undefined, undefined);
        this.requestWithContext(context, url, query, false);
    };

    Application.prototype.requestWithContext = function (context, url, query, external) {
        var static_handlers, dynamic_handlers, concat_handler = {};
        var attrname;
        var route;
        var tmp;
        var handler;
        var offset;
        var method;
        var methodName;
        var clone = {};

        try  {
            //copy query
            if (query) {
                for (var attr in query) {
                    clone[attr] = query[attr];
                }
                query = clone;
            }

            //add in query
            url = decodeURIComponent(url);
            offset = url.indexOf('?');
            if (offset > 0) {
                context.url = url.substring(0, offset);
                query = query || this.parseQuery(url.substring(offset + 1));
            } else {
                context.url = url;
                query = query || {};
            }

            //select handler
            if (context.request)
                method = context.request.method;
            else
                method = 'GET';

            static_handlers = this.static_handlers;
            dynamic_handlers = this.dynamic_handlers;
            if (static_handlers.hasOwnProperty(context.url) && ((static_handlers[context.url].hasOwnProperty(method) && (!external || (external && static_handlers[context.url][method].contentType))) || (static_handlers[context.url].hasOwnProperty('ALL')) && (!external || (external && static_handlers[context.url]['ALL'].contentType)))) {
                handler = static_handlers[context.url][method] || static_handlers[context.url]['ALL'];
            } else if ((tmp = this.matchWithDynamicHandler(method, context.url, query))) {
                handler = tmp;
            } else {
                for (route in static_handlers) {
                    methodName = null;
                    if (static_handlers[route].hasOwnProperty(method))
                        methodName = method;
                    else if (static_handlers[route].hasOwnProperty('ALL'))
                        methodName = 'ALL';
                    if (methodName) {
                        handler = static_handlers[route][methodName];
                        if ((!external || (external && handler.contentType)) && handler.on_filter(context, context.model, query)) {
                            break;
                        }
                    }
                    handler = null;
                }
            }

            //sync
            if (handler) {
                context.wait(handler, query);
                handler.on_request(context, context.model, query);
                context.synchronize();
            } else {
                this.handlerNotFound(context, url);
            }
        } catch (err) {
            if (handler)
                handler.on_error(context, context.model, query, err);
            else
                this.internalError(context, err);
        }
    };

    Application.prototype.render = function (url) {
        var model = this.getModel();
        return this.renderWithModel(model, url);
    };

    Application.prototype.renderWithModel = function (model, url) {
        var path = url.split('?'), template = path[0], result;

        if (this.templates.hasOwnProperty(template)) {
            result = this.templates[template].on_render(undefined, model);
        } else {
            console.log('Template "' + url + '" not found!');
            throw 'Template "' + url + '" not found!';
        }
        return result;
    };

    Application.prototype.serializeQuery = function (query) {
        var items = [], name;
        for (name in query) {
            items.push(name + '=' + encodeURIComponent(query[name]));
        }
        return items.join('&');
    };
    return Application;
})();

/*jshint -W004 */
var Server = (function (_super) {
    __extends(Server, _super);
    function Server() {
        _super.apply(this, arguments);
        this.mime = {
            css: 'text/css',
            eot: 'application/vnd.ms-fontobject',
            gif: 'image/gif',
            htm: 'text/html',
            html: 'text/html',
            ico: 'image/x-icon',
            jpeg: 'image/jpeg',
            jpg: 'image/jpeg',
            js: 'application/x-javascript',
            mov: 'video/quicktime',
            m4a: 'audio/mp4',
            m4p: 'audio/mp4',
            m4v: 'video/mp4',
            mp3: 'audio/mp3',
            mp4: 'video/mp4',
            map: 'application/json',
            opml: 'text/xml',
            png: 'image/png',
            rss: 'application/rss+xml',
            ttf: 'application/octet-stream',
            wk: 'application/xml',
            xml: 'application/xml'
        };
    }
    Server.prototype.getMIME = function (path) {
        var dot = path.lastIndexOf('.'), extension;
        if (dot) {
            extension = (path.substring(dot + 1)).toLowerCase();
            if (this.mime.hasOwnProperty(extension))
                return this.mime[extension];
            console.log('# mime not found!' + path + '\n');
        }
        return '';
    };

    Server.prototype.getModel = function () {
        return new Model();
    };

    Server.prototype.httpRequest = function (request, response) {
        var formidable = require('formidable');

        try  {
            var context = new Context(request, response), query = {}, body = '', server = this;
            if (request.method === 'POST') {
                if (request.headers['content-type'] == 'text/plain;charset=UTF-8') {
                    request.headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
                }

                var form = new formidable.IncomingForm();
                form.on('error', function (e) {
                    server.internalError(context, e);
                });
                form.on('field', function (field, value) {
                    query[field] = value;
                });
                form.onPart = function (part) {
                    if (!part.filename)
                        return form.handlePart(part);

                    var buffer = new Buffer(0);
                    part.on('data', function (data) {
                        buffer = Buffer.concat([buffer, data]);
                    });
                    part.on('end', function () {
                        query['data'] = buffer;
                    });
                    part.on('error', function (e) {
                        server.internalError(context, e);
                    });
                };
                form.on('end', function () {
                    server.requestWithContext(context, request.url, query, true);
                });
                form.parse(request);
            } else {
                this.requestWithContext(context, request.url, undefined, true);
            }
        } catch (ignore) {
            throw ignore;
        }
    };

    Server.prototype.start = function () {
        var http = require('http'), server = this, httpServer;
        httpServer = http.createServer(function (request, response) {
            server.httpRequest(request, response);
        });
        console.log('server listening on port: ' + this.properties.port);
        httpServer.listen(this.properties.port);
    };

    Server.prototype.handlerNotFound = function (context, url) {
        var fs = require('fs'), headers, ifModifiedSince, text, stats, path = this.properties.root + context.url;
        if (fs.existsSync(path)) {
            stats = fs.statSync(path);
            if (stats.isFile()) {
                headers = { 'Content-Length': stats.size };
                headers['Content-Type'] = this.getMIME(context.url);

                ifModifiedSince = context.request.headers['If-Modified-Since'];
                if (ifModifiedSince)
                    ifModifiedSince = httpDate.parse(ifModifiedSince);

                headers['Last-Modified'] = stats.mtime.toUTCString();
                if (ifModifiedSince && (ifModifiedSince > stats.mtime)) {
                    context.response.writeHead(304, headers);
                    context.response.end();
                } else {
                    context.response.writeHead(200, headers);
                    text = fs.readFileSync(path);
                    context.response.end(text);
                }
                return;
            }
        }
        text = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL "';
        text += url + '" was not found on this server.</p></body></html>';
        context.response.writeHead(404, { 'Content-Type': 'text/html', 'Content-Length': text.length });
        context.response.end(text);
    };

    Server.prototype.internalError = function (context, error) {
        var text = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>500 Internal Server Error</title></head><body><h1>Internal Server Error</h1><p>The requested URL "';
        text += context.request.url + '" encounter the following error : <b>' + error.toString() + '</b></p>';
        text += '<p>' + (error.stack.toString()).replace(/\n/g, '<br/>') + '</p></body></html>';
        context.response.writeHead(500, { 'Content-Type': 'text/html', 'Content-Length': text.length });
        context.response.end(text);

        console.log('Internal error\r' + error.toString() + '\r' + error.stack);
    };
    return Server;
})(Application);
