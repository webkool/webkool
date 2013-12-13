/* include webkool.js*/
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
        var handler, query, buffer, text;
        if (this.handlers.length > 0) {
            if (this.queries[this.queries.length - 1]) {
                handler = this.handlers.pop();
                query = this.queries.pop();
                handler.on_complete(this, this.model, query);
                if (this.response) {
                    try  {
                        text = handler.on_render(this, this.model);
                        if (text) {
                            buffer = new Buffer(text);
                            this.response.writeHead(200, { 'Content-Type': handler.contentType, 'Content-Length': buffer.length });
                            this.response.end(buffer);
                        }
                    } catch (e) {
                        console.log(e.toString());
                    }
                } else {
                    text = handler.on_render(this, this.model);
                    if (text) {
                        document.body.innerHTML = handler.on_render(this, this.model);
                        handler.on_load(this, this.model, query);
                    }
                }
                this.synchronize();
            }
        }
    };

    Context.prototype.wait = function (handler, query) {
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
        return this.url == context.url;
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
            console.log(target);
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
        this.handlers = {};
        this.properties = {};
        this.templates = {};
    }
    Application.prototype.addHandler = function (name, handler) {
        this.handlers[name] = handler;
    };

    Application.prototype.addObserver = function (name, selector) {
        var model = this.getModel();
        if (model[name] == undefined)
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
        console.log('Internal error\r' + error.toString() + '\r' + error.stack);
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
        var handler, handlers, offset, clone = {};
        try  {
            if (query) {
                for (var attr in query) {
                    clone[attr] = query[attr];
                }
                query = clone;
            }

            offset = url.indexOf('?');
            if (offset > 0) {
                context.url = url.substring(0, offset);
                query = query || this.parseQuery(url.substring(offset + 1));
            } else {
                context.url = url;
                query = query || {};
            }

            handlers = this.handlers;
            if (handlers.hasOwnProperty(context.url) && (!external || (external && handlers[context.url].contentType))) {
                handler = handlers[context.url];
            } else {
                for (handler in handlers) {
                    handler = handlers[handler];
                    if ((!external || (external && handler.contentType)) && handler.on_filter(context, context.model, query)) {
                        break;
                    }
                    handler = null;
                }
            }
            if (handler) {
                context.wait(handler, query);
                handler.on_request(context, context.model, query);
                context.synchronize();
            } else {
                this.handlerNotFound(context, url);
            }
        } catch (e) {
            if (handler) {
                handler.on_error(context, context.model, query, e);
            } else {
                this.internalError(context, e);
            }
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
            opml: 'text/xml',
            png: 'image/png',
            rss: 'application/rss+xml',
            ttf: 'application/octet-stream',
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
/* include square_lib.js*/


Model.prototype.print0block = function	print0block(stream, script) {
	with (model) {
		try {
			return (script);
		}
		catch (e) {}
	}
}
/* include hogan-2.0.0.js*/
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */



var Hogan = {};

(function (Hogan, useArrayBuffer) {
  Hogan.Template = function (renderFunc, text, compiler, options) {
    this.r = renderFunc || this.r;
    this.c = compiler;
    this.options = options;
    this.text = text || '';
    this.buf = (useArrayBuffer) ? [] : '';
  }

  Hogan.Template.prototype = {
    // render: replaced by generated code.
    r: function (context, partials, indent) { return ''; },

    // variable escaping
    v: hoganEscape,

    // triple stache
    t: coerceToString,

    render: function render(context, partials, indent) {
      return this.ri([context], partials || {}, indent);
    },

    // render internal -- a hook for overrides that catches partials too
    ri: function (context, partials, indent) {
      return this.r(context, partials, indent);
    },

    // tries to find a partial in the curent scope and render it
    rp: function(name, context, partials, indent) {
      var partial = partials[name];

      if (!partial) {
        return '';
      }

      if (this.c && typeof partial == 'string') {
        partial = this.c.compile(partial, this.options);
      }

      return partial.ri(context, partials, indent);
    },

    // render a section
    rs: function(context, partials, section) {
      var tail = context[context.length - 1];

      if (!isArray(tail)) {
        section(context, partials, this);
        return;
      }

      for (var i = 0; i < tail.length; i++) {
        context.push(tail[i]);
        section(context, partials, this);
        context.pop();
      }
    },

    // maybe start a section
    s: function(val, ctx, partials, inverted, start, end, tags) {
      var pass;

      if (isArray(val) && val.length === 0) {
        return false;
      }

      if (typeof val == 'function') {
        val = this.ls(val, ctx, partials, inverted, start, end, tags);
      }

      pass = (val === '') || !!val;

      if (!inverted && pass && ctx) {
        ctx.push((typeof val == 'object') ? val : ctx[ctx.length - 1]);
      }

      return pass;
    },

    // find values with dotted names
    d: function(key, ctx, partials, returnFound) {
      var names = key.split('.'),
          val = this.f(names[0], ctx, partials, returnFound),
          cx = null;

      if (key === '.' && isArray(ctx[ctx.length - 2])) {
        return ctx[ctx.length - 1];
      }

      for (var i = 1; i < names.length; i++) {
        if (val && typeof val == 'object' && names[i] in val) {
          cx = val;
          val = val[names[i]];
        } else {
          val = '';
        }
      }

      if (returnFound && !val) {
        return false;
      }

      if (!returnFound && typeof val == 'function') {
        ctx.push(cx);
        val = this.lv(val, ctx, partials);
        ctx.pop();
      }

      return val;
    },

    // find values with normal names
    f: function(key, ctx, partials, returnFound) {
      var val = false,
          v = null,
          found = false;

      for (var i = ctx.length - 1; i >= 0; i--) {
        v = ctx[i];
        if (v && typeof v == 'object' && key in v) {
          val = v[key];
          found = true;
          break;
        }
      }

      if (!found) {
        return (returnFound) ? false : "";
      }

      if (!returnFound && typeof val == 'function') {
        val = this.lv(val, ctx, partials);
      }

      return val;
    },

    // higher order templates
    ho: function(val, cx, partials, text, tags) {
      var compiler = this.c;
      var options = this.options;
      options.delimiters = tags;
      var text = val.call(cx, text);
      text = (text == null) ? String(text) : text.toString();
      this.b(compiler.compile(text, options).render(cx, partials));
      return false;
    },

    // template result buffering
    b: (useArrayBuffer) ? function(s) { this.buf.push(s); } :
                          function(s) { this.buf += s; },
    fl: (useArrayBuffer) ? function() { var r = this.buf.join(''); this.buf = []; return r; } :
                           function() { var r = this.buf; this.buf = ''; return r; },

    // lambda replace section
    ls: function(val, ctx, partials, inverted, start, end, tags) {
      var cx = ctx[ctx.length - 1],
          t = null;

      if (!inverted && this.c && val.length > 0) {
        return this.ho(val, cx, partials, this.text.substring(start, end), tags);
      }

      t = val.call(cx);

      if (typeof t == 'function') {
        if (inverted) {
          return true;
        } else if (this.c) {
          return this.ho(t, cx, partials, this.text.substring(start, end), tags);
        }
      }

      return t;
    },

    // lambda replace variable
    lv: function(val, ctx, partials) {
      var cx = ctx[ctx.length - 1];
      var result = val.call(cx);

      if (typeof result == 'function') {
        result = coerceToString(result.call(cx));
        if (this.c && ~result.indexOf("{\u007B")) {
          return this.c.compile(result, this.options).render(cx, partials);
        }
      }

      return coerceToString(result);
    }

  };

  var rAmp = /&/g,
      rLt = /</g,
      rGt = />/g,
      rApos =/\'/g,
      rQuot = /\"/g,
      hChars =/[&<>\"\']/;


  function coerceToString(val) {
    return String((val === null || val === undefined) ? '' : val);
  }

  function hoganEscape(str) {
    str = coerceToString(str);
    return hChars.test(str) ?
      str
        .replace(rAmp,'&amp;')
        .replace(rLt,'&lt;')
        .replace(rGt,'&gt;')
        .replace(rApos,'&#39;')
        .replace(rQuot, '&quot;') :
      str;
  }

  var isArray = Array.isArray || function(a) {
    return Object.prototype.toString.call(a) === '[object Array]';
  };

})(typeof exports !== 'undefined' ? exports : Hogan);




(function (Hogan) {
  // Setup regex  assignments
  // remove whitespace according to Mustache spec
  var rIsWhitespace = /\S/,
      rQuot = /\"/g,
      rNewline =  /\n/g,
      rCr = /\r/g,
      rSlash = /\\/g,
      tagTypes = {
        '#': 1, '^': 2, '/': 3,  '!': 4, '>': 5,
        '<': 6, '=': 7, '_v': 8, '{': 9, '&': 10
      };

  Hogan.scan = function scan(text, delimiters) {
    var len = text.length,
        IN_TEXT = 0,
        IN_TAG_TYPE = 1,
        IN_TAG = 2,
        state = IN_TEXT,
        tagType = null,
        tag = null,
        buf = '',
        tokens = [],
        seenTag = false,
        i = 0,
        lineStart = 0,
        otag = '{{',
        ctag = '}}';

    function addBuf() {
      if (buf.length > 0) {
        tokens.push(new String(buf));
        buf = '';
      }
    }

    function lineIsWhitespace() {
      var isAllWhitespace = true;
      for (var j = lineStart; j < tokens.length; j++) {
        isAllWhitespace =
          (tokens[j].tag && tagTypes[tokens[j].tag] < tagTypes['_v']) ||
          (!tokens[j].tag && tokens[j].match(rIsWhitespace) === null);
        if (!isAllWhitespace) {
          return false;
        }
      }

      return isAllWhitespace;
    }

    function filterLine(haveSeenTag, noNewLine) {
      addBuf();

      if (haveSeenTag && lineIsWhitespace()) {
        for (var j = lineStart, next; j < tokens.length; j++) {
          if (!tokens[j].tag) {
            if ((next = tokens[j+1]) && next.tag == '>') {
              // set indent to token value
              next.indent = tokens[j].toString()
            }
            tokens.splice(j, 1);
          }
        }
      } else if (!noNewLine) {
        tokens.push({tag:'\n'});
      }

      seenTag = false;
      lineStart = tokens.length;
    }

    function changeDelimiters(text, index) {
      var close = '=' + ctag,
          closeIndex = text.indexOf(close, index),
          delimiters = trim(
            text.substring(text.indexOf('=', index) + 1, closeIndex)
          ).split(' ');

      otag = delimiters[0];
      ctag = delimiters[1];

      return closeIndex + close.length - 1;
    }

    if (delimiters) {
      delimiters = delimiters.split(' ');
      otag = delimiters[0];
      ctag = delimiters[1];
    }

    for (i = 0; i < len; i++) {
      if (state == IN_TEXT) {
        if (tagChange(otag, text, i)) {
          --i;
          addBuf();
          state = IN_TAG_TYPE;
        } else {
          if (text.charAt(i) == '\n') {
            filterLine(seenTag);
          } else {
            buf += text.charAt(i);
          }
        }
      } else if (state == IN_TAG_TYPE) {
        i += otag.length - 1;
        tag = tagTypes[text.charAt(i + 1)];
        tagType = tag ? text.charAt(i + 1) : '_v';
        if (tagType == '=') {
          i = changeDelimiters(text, i);
          state = IN_TEXT;
        } else {
          if (tag) {
            i++;
          }
          state = IN_TAG;
        }
        seenTag = i;
      } else {
        if (tagChange(ctag, text, i)) {
          tokens.push({tag: tagType, n: trim(buf), otag: otag, ctag: ctag,
                       i: (tagType == '/') ? seenTag - ctag.length : i + otag.length});
          buf = '';
          i += ctag.length - 1;
          state = IN_TEXT;
          if (tagType == '{') {
            if (ctag == '}}') {
              i++;
            } else {
              cleanTripleStache(tokens[tokens.length - 1]);
            }
          }
        } else {
          buf += text.charAt(i);
        }
      }
    }

    filterLine(seenTag, true);

    return tokens;
  }

  function cleanTripleStache(token) {
    if (token.n.substr(token.n.length - 1) === '}') {
      token.n = token.n.substring(0, token.n.length - 1);
    }
  }

  function trim(s) {
    if (s.trim) {
      return s.trim();
    }

    return s.replace(/^\s*|\s*$/g, '');
  }

  function tagChange(tag, text, index) {
    if (text.charAt(index) != tag.charAt(0)) {
      return false;
    }

    for (var i = 1, l = tag.length; i < l; i++) {
      if (text.charAt(index + i) != tag.charAt(i)) {
        return false;
      }
    }

    return true;
  }

  function buildTree(tokens, kind, stack, customTags) {
    var instructions = [],
        opener = null,
        token = null;

    while (tokens.length > 0) {
      token = tokens.shift();
      if (token.tag == '#' || token.tag == '^' || isOpener(token, customTags)) {
        stack.push(token);
        token.nodes = buildTree(tokens, token.tag, stack, customTags);
        instructions.push(token);
      } else if (token.tag == '/') {
        if (stack.length === 0) {
          throw new Error('Closing tag without opener: /' + token.n);
        }
        opener = stack.pop();
        if (token.n != opener.n && !isCloser(token.n, opener.n, customTags)) {
          throw new Error('Nesting error: ' + opener.n + ' vs. ' + token.n);
        }
        opener.end = token.i;
        return instructions;
      } else {
        instructions.push(token);
      }
    }

    if (stack.length > 0) {
      throw new Error('missing closing tag: ' + stack.pop().n);
    }

    return instructions;
  }

  function isOpener(token, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].o == token.n) {
        token.tag = '#';
        return true;
      }
    }
  }

  function isCloser(close, open, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].c == close && tags[i].o == open) {
        return true;
      }
    }
  }

  Hogan.generate = function (tree, text, options) {
    var code = 'var _=this;_.b(i=i||"");' + walk(tree) + 'return _.fl();';
    if (options.asString) {
      return 'function(c,p,i){' + code + ';}';
    }

    return new Hogan.Template(new Function('c', 'p', 'i', code), text, Hogan, options);
  }

  function esc(s) {
    return s.replace(rSlash, '\\\\')
            .replace(rQuot, '\\\"')
            .replace(rNewline, '\\n')
            .replace(rCr, '\\r');
  }

  function chooseMethod(s) {
    return (~s.indexOf('.')) ? 'd' : 'f';
  }

  function walk(tree) {
    var code = '';
    for (var i = 0, l = tree.length; i < l; i++) {
      var tag = tree[i].tag;
      if (tag == '#') {
        code += section(tree[i].nodes, tree[i].n, chooseMethod(tree[i].n),
                        tree[i].i, tree[i].end, tree[i].otag + " " + tree[i].ctag);
      } else if (tag == '^') {
        code += invertedSection(tree[i].nodes, tree[i].n,
                                chooseMethod(tree[i].n));
      } else if (tag == '<' || tag == '>') {
        code += partial(tree[i]);
      } else if (tag == '{' || tag == '&') {
        code += tripleStache(tree[i].n, chooseMethod(tree[i].n));
      } else if (tag == '\n') {
        code += text('"\\n"' + (tree.length-1 == i ? '' : ' + i'));
      } else if (tag == '_v') {
        code += variable(tree[i].n, chooseMethod(tree[i].n));
      } else if (tag === undefined) {
        code += text('"' + esc(tree[i]) + '"');
      }
    }
    return code;
  }

  function section(nodes, id, method, start, end, tags) {
    return 'if(_.s(_.' + method + '("' + esc(id) + '",c,p,1),' +
           'c,p,0,' + start + ',' + end + ',"' + tags + '")){' +
           '_.rs(c,p,' +
           'function(c,p,_){' +
           walk(nodes) +
           '});c.pop();}';
  }

  function invertedSection(nodes, id, method) {
    return 'if(!_.s(_.' + method + '("' + esc(id) + '",c,p,1),c,p,1,0,0,"")){' +
           walk(nodes) +
           '};';
  }

  function partial(tok) {
    return '_.b(_.rp("' +  esc(tok.n) + '",c,p,"' + (tok.indent || '') + '"));';
  }

  function tripleStache(id, method) {
    return '_.b(_.t(_.' + method + '("' + esc(id) + '",c,p,0)));';
  }

  function variable(id, method) {
    return '_.b(_.v(_.' + method + '("' + esc(id) + '",c,p,0)));';
  }

  function text(id) {
    return '_.b(' + id + ');';
  }

  Hogan.parse = function(tokens, text, options) {
    options = options || {};
    return buildTree(tokens, '', [], options.sectionTags || []);
  },

  Hogan.cache = {};

  Hogan.compile = function(text, options) {
    // options
    //
    // asString: false (default)
    //
    // sectionTags: [{o: '_foo', c: 'foo'}]
    // An array of object with o and c fields that indicate names for custom
    // section tags. The example above allows parsing of {{_foo}}{{/foo}}.
    //
    // delimiters: A string that overrides the default delimiters.
    // Example: "<% %>"
    //
    options = options || {};

    var key = text + '||' + !!options.asString;

    var t = this.cache[key];

    if (t) {
      return t;
    }

    t = this.generate(this.parse(this.scan(text, options.delimiters), text, options), text, options);
    return this.cache[key] = t;
  };
})(typeof exports !== 'undefined' ? exports : Hogan);


		var application = new Application();
		
