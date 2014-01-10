declare var Buffer;
declare var application;
declare var require;

module httpDate {
	var asctime = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (..| .) (..):(..):(..) (....)$/, // Sun Nov  6 08:49:37 1994 ; ANSI C asctime() format
	rfc1123 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (..) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (....) (..):(..):(..) (.*)$/, //Sun, 06 Nov 1994 08:49:37 GMT  ; RFC 822, updated by RFC 1123
	rfc850 = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (..)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(..) (..):(..):(..) GMT$/, //Sunday, 06-Nov-94 08:49:37 GMT ; RFC 850, obsoleted by RFC 1036
	month = {Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11};

	export function parse(d) {
		if (d) {
			var match = d.match(rfc1123);
			if (match) {
				if (!isNaN(parseInt(match[8], 10)))
					match[5] = Math.floor(parseInt(match[5], 10) - parseInt(match[8], 10) / 100);

				return new Date(Date.UTC(match[4], month[match[3]], match[2], match[5], match[6], match[7]))
			}

			match = d.match(rfc850)
			if (match)
				return new Date(Date.UTC(match[4], month[match[3]], match[2], match[5], match[6], match[7]))

			match = d.match(asctime)
			if (match)
				return new Date(Date.UTC(match[7], month[match[2]], match[3], match[4], match[5], match[6]))

			console.log('# Date format was not recognize: ' + d + '\n');
		}
		return new Date()
	}
}

class Model {

	include(url) {
		return application.renderWithModel(this, url);
	}

	json(target) {
		var result;
		if (target) {
			result = JSON.stringify(target, null, 4);
		}
		else {
			result = JSON.stringify(this, null, 4);
		}
		return result;
	}
}

class Context {
  handlers;
  queries;
  model;
  request;
  response;
  url;

	constructor(request,response) {
		this.request = request;
		this.response = response;
		this.handlers = [];
		this.queries = [];
		this.model = application.getModel();
	}

	dequeue(handler) {
		var index = this.handlers.indexOf(handler);
		if (index < 0) console.log('>>>> DEQUEUE UNKNOWN HANDLER');
		this.handlers.splice(index,1);
		this.queries.splice(index,1);
		this.synchronize();
	}

	queue(handler, query) {
		var index = this.queries.indexOf(query);
		this.queries[index] = null;
	}

	synchronize() {
		var handler, query, buffer, text;
		if (this.handlers.length>0) {
			if (this.queries[this.queries.length-1]) {
				handler = this.handlers.pop();
				query = this.queries.pop();
				handler.on_complete(this, this.model, query);
				if (this.response) {
					try {
						text = handler.on_render(this, this.model);
						if (text) {
							buffer = new Buffer(text);
							this.response.writeHead(200, {'Content-Type': handler.contentType, 'Content-Length': buffer.length});
							this.response.end(buffer);
						}
					}
					catch (e) {
						throw e;
					}
				}
				else {
					text = handler.on_render(this, this.model);
					if (text) {
						document.body.innerHTML = handler.on_render(this, this.model);
						handler.on_load(this, this.model, query);
					}
				}
				this.synchronize();
			}
		}
	}

	wait(handler, query) {
		this.handlers.push(handler);
		this.queries.push(query);
	}
}

class Handler {
	url;
	contentType = 'text/html';

	on_checkAccess(context, model, query) {
		return true;
	}

	on_complete(context, model, query) {
		return;
	}

	on_error(context, model, query, error) {
		application.internalError(context, error);
	}

	on_filter(context, model, query) {
		return this.url == context.url;
	}

	on_load(context, model, query) {
		return;
	}

	on_request(context, model, query) {
		return;
	}

	on_render(context, model, query) {
		return '';
	}

	on_sqlResult(context, model, query, result) {
		return result;
	}

	request(context, url, query) {
		application.requestWithContext(context, url, query, false);
	}
}

class Observer {
	value;
	targets;
	observables;

	constructor() {
		this.targets = [];
		this.observables = [];
		this.value = '';
		return (this);
	}

	attach(selector) {
		var target = document.getElementById(selector);
		this.applyListeners(target);
		this.targets.push(target);
		return (this);
	}

	bind(observable) {
		this.observables.push(observable);
	}

	set(value) {
		for (var i = 0; i < this.targets.length || i < this.observables.length; i++) {
			if (i < this.targets.length) { this.targets[i].setValue(value) }
			if (i < this.observables.length) { this.observables[i].value = value }
		}
		return (this);
	}

	get() {
		return (this.value);
	}

	applyListeners(target) {
		var _this = this;

		if (target.is('input')) {
			target.getValue = function () { return (this.value) };
			target.setValue = function (value) { this.value = value };
			target.addEventListener('input', function () { _this.set(target.getValue()) });
		}
		else if (target.is('select')) {
			target.getValue = function () { return (this.innerHTML) };
			target.setValue = function (value) { this.innerHTML = value };
			target.addEventListener('change', function () { _this.set(target.getValue()) });
		}
		else {
			console.log(target);
			target.getValue = function () { return (this.text()) };
			target.setValue = function (value) { this.text(value) };
		}
	}
}

class Observable {
	initialValue;
	value;
	observer;

	constructor(value) {
		this.initialValue = value;
		this.value = value;
		this.observer = new Observer();
		this.observer.bind(this);
	}

	attach(selector) {
		this.observer.attach(selector);
		this.value = this.observer.get();
	}

	get() {
		return (this.value);
	}

	set(value) {
		this.observer.set(value);
		this.value = value;
	}
}

class Template {
	on_render(context, model, query) {
		return '';
	}
}

class Application {
  handlers;
  model;
  properties;
  templates;

	constructor() {
		this.handlers = {};
		this.properties = {};
		this.templates = {};
	}

	addHandler(name, handler) {
		this.handlers[name] = handler;
	}

	addObserver(name, selector) {
		var model = this.getModel();
		if (model[name] === undefined)
			model[name] = new Observable('');
		model[name].attach(selector);
	}

	addProperty(name, property) {
		this.properties[name] = property;
	}

	addTemplate(name, template) {
		this.templates[name] = template;
	}

	getModel() {
		if (!this.model) {
			this.model = new Model();
		}
		return this.model;
	}

	handlerNotFound(context, url) {
		console.log('Handler "' + url + '" not found!');
	}

	internalError(context, error) {
		console.log('Internal error\r' + error.toString() + '\r' + error.stack);
	}

	parseQuery(url) {
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
	}

	request(url, query) {
		var context = new Context(undefined, undefined);
		this.requestWithContext(context, url, query, false);
	}


	requestWithContext(context, url, query, external) {
		var handler, handlers, offset, clone = {};
		try {
		
			//copy des attrs (pour eviter les modification par references);
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
			}
			else {
				context.url = url;
				query = query || {};
			}

			handlers = this.handlers;
			if (handlers.hasOwnProperty(context.url) && (!external || (external && handlers[context.url].contentType))) {
				handler = handlers[context.url];
			}
			else {
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
			}
			else {
				this.handlerNotFound(context, url);
			}
		}
		catch (e) {
			if (handler) {
				handler.on_error(context, context.model, query, e);
			}
			else {
				this.internalError(context, e);
			}
		}
	}

	render(url) {
		var model = this.getModel();
		return this.renderWithModel(model, url);
	}

	renderWithModel(model, url) {
		var path = url.split('?'), template = path[0], result;

		if (this.templates.hasOwnProperty(template)) {
			result = this.templates[template].on_render(undefined, model);
		}
		else {
			console.log('Template "' + url + '" not found!');
			throw 'Template "' + url + '" not found!';
		}
		return result;
	}

	serializeQuery(query) {
		var items = [], name;
		for (name in query) {
			items.push(name + '=' + encodeURIComponent(query[name]));
		}
		return items.join('&');
	}

}
/*jshint -W004 */
class Server extends Application {
	mime = {
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
	}

	getMIME(path) {
		var dot = path.lastIndexOf('.'), extension;
		if (dot) {
			extension = (path.substring(dot + 1)).toLowerCase();
			if (this.mime.hasOwnProperty(extension))
				return this.mime[extension];
			console.log('# mime not found!' + path + '\n');
		}
		return '';
	}

	getModel() {
		return new Model();
	}

	httpRequest(request, response) {
		var formidable = require('formidable');

		try {
			var context = new Context(request, response), query = {}, body = '', server = this;
			if (request.method === 'POST') {

				if (request.headers['content-type'] == 'text/plain;charset=UTF-8') {
					request.headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
				}

				var form = new formidable.IncomingForm();
				form.on('error', function(e) {
					server.internalError(context, e);
				});
				form.on('field', function(field, value) {
					query[field] = value;
				})
				form.onPart = function(part) {
					if (!part.filename)
						return form.handlePart(part);

					var buffer = new Buffer(0);
					part.on('data', function(data) {
						buffer = Buffer.concat([buffer, data]);
					});
					part.on('end', function() {
						query['data'] = buffer;
					});
					part.on('error', function(e) {
						server.internalError(context, e);
					});
				}
				form.on('end', function() {
					server.requestWithContext(context, request.url, query, true);
				});
				form.parse(request);
			}
			else {
				this.requestWithContext(context, request.url, undefined, true);
			}
		}
		catch (ignore) {
		}
	}

	start() {
		var http = require('http'), server = this, httpServer;
		httpServer = http.createServer(
			function (request, response) {
				server.httpRequest(request, response);
			}
		);
		console.log('server listening on port: ' + this.properties.port);
		httpServer.listen(this.properties.port);
	}

	handlerNotFound(context, url) {
		var fs = require('fs'), headers, ifModifiedSince, text, stats, path = this.properties.root + context.url;
		if (fs.existsSync(path)) {
			stats = fs.statSync(path);
			if (stats.isFile()) {
				headers = {'Content-Length': stats.size};
				headers['Content-Type'] = this.getMIME(context.url);

				ifModifiedSince = context.request.headers['If-Modified-Since'];
				if (ifModifiedSince)
					ifModifiedSince = httpDate.parse(ifModifiedSince);

				headers['Last-Modified'] = stats.mtime.toUTCString();
				if (ifModifiedSince && (ifModifiedSince > stats.mtime)) {
					context.response.writeHead(304, headers);
					context.response.end();
				}
				else {
					context.response.writeHead(200, headers);
					text = fs.readFileSync(path);
					context.response.end(text);
				}
				return;
			}
		}
		text = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL "'
		text += url + '" was not found on this server.</p></body></html>';
		context.response.writeHead(404, {'Content-Type': 'text/html', 'Content-Length': text.length});
		context.response.end(text);
	}

	internalError(context, error) {
		var text = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>500 Internal Server Error</title></head><body><h1>Internal Server Error</h1><p>The requested URL "'
		text += context.request.url + '" encounter the following error : <b>' + error.toString() + '</b></p>'
		text += '<p>' + (error.stack.toString()).replace(/\n/g, '<br/>') + '</p></body></html>';
		context.response.writeHead(500, {'Content-Type': 'text/html', 'Content-Length': text.length});
		context.response.end(text);

		console.log('Internal error\r' + error.toString() + '\r' + error.stack);
	}
}
