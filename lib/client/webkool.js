var module = module || {};
var gHTTPServer = gHTTPServer || null;
var globals;
(function() { globals = this; })();



var template1 = function(it0) {
	var constructor = this;
	var result;
	if (it0 instanceof Function) {
		result = function(it1) {
			var self = this == globals ? Object.create(constructor.prototype) : this;
			var it = it0.call(self, $);
			if (it1) {
				for (var i in it1) {
					it[i] = it1[i];
				}
			}
			constructor.call(self, it);
			return self;
		};
		result.prototype = this.prototype;
		result.template = template1;
	}
	else if (it0) {
		result = function(it1) {
			var self = this == globals ? Object.create(constructor.prototype) : this;
			var it = {};
			for (var i in it0)
				it[i] = it0[i];
			if (it1) {
				for (i in it1) {
					it[i] = it1[i];
				}
			}
			constructor.call(self, it);
			return self;
		};
		result.prototype = this.prototype;
		result.template = template1;
	}
	else {
		result = constructor;
	}
	return result;
};

var template2 = function(it0) {
	var constructor = this;
	var result;
	if (it0 instanceof Function) {
		result = function(name, it1) {
			var self = this == globals ? Object.create(constructor.prototype) : this;
			var it = it0.call(self, $);
			if (it1) {
				for (var i in it1) {
					it[i] = it1[i];
				}
			}
			constructor.call(self, name, it);
			return self;
		};
		result.prototype = this.prototype;
		result.template = template2;
	}
	else if (it0) {
		result = function(name, it1) {
			var self = this == globals ? Object.create(constructor.prototype) : this;
			var it = {};
			for (var i in it0)
				it[i] = it0[i];
			if (it1) {
				for (i in it1) {
					it[i] = it1[i];
				}
			}
			constructor.call(self, name, it);
			return self;
		};
		result.prototype = this.prototype;
		result.template = template2;
	}
	else {
		result = constructor;
	}
	return result;
};

var template3 = function(it0) {
	var constructor = this;
	var result;
	if (it0 instanceof Function) {
		result = function(parent, url, it1) {
			var self = this == globals ? Object.create(constructor.prototype) : this;
			var it = it0.call(self, $);
			if (it1) {
				for (var i in it1) {
					it[i] = it1[i];
				}
			}
			constructor.call(self, parent, url, it);
			return self;
		};
		result.prototype = this.prototype;
		result.template = template3;
	}
	else if (it0) {
		result = function(parent, url, it1) {
			var self = this == globals ? Object.create(constructor.prototype) : this;
			var it = {};
			for (var i in it0)
				it[i] = it0[i];
			if (it1) {
				for (i in it1) {
					it[i] = it1[i];
				}
			}
			constructor.call(self, parent, url, it);
			return self;
		};
		result.prototype = this.prototype;
		result.template = template3;
	}
	else {
		result = constructor;
	}
	return result;
};



var Handler = function(parent, url, it) {
	if (parent) {
		if (parent._first) {
			this._previous = parent._last;
			parent._last._next = this;
		}
		else
			parent._first = this;
		parent._last = this;
		this.parent = parent;
		if ("model" in it)
			this.model = it.model;
		else
			this.model = parent.model;
	}
	else {
		if ("model" in it)
			this.model = it.model;
		else
			this.model = application.getModel();
	}
	this.url = url;
	this.it = it;
	if ("behavior" in it) {
		this.behavior = new it.behavior();
	}
	if ("event" in it) {
		this.event = it.event;
	}
	if ("query" in it) {
		this.query = it.query;
	}
	if ("request" in it) {
		this._request = it.request;
	}
	if ("response" in it) {
		this._response = it.response;
	}
	if ("status" in it) {
		this.status = it.status;
	}
	if ("target" in it) {
		this._target = it.target;
	}
};
Handler.template = template3;
Handler.prototype = Object.create(Object.prototype, {
	contentType: { value: 'text/html', writable: true, },
	event: { value: null, writable: true, },
	parent: { value: null, writable: true, },
	model: { value: null, writable: true, },
	query: { value: null, writable: true, },
	status: { value: 200, writable: true, },
	_error: { value: null, writable: true, },
	_first: { value: null, writable: true, },
	_last: { value: null, writable: true, },
	_next: { value: null, writable: true, },
	_previous: { value: null, writable: true, },
	_request: { value: null, writable: true, },
	_response: { value: null, writable: true, },
	_target: { value: null, writable: true, },
	cancel: { value:
		function() {
			this._error = new Error('Canceled');
			this.synchronize();
		}
	},
	dequeue: { value:
		function(child) {
			if (!child._error) {
				var event = child.event;
				var behavior = this.behavior;
				if (event && behavior && (event in behavior))
					behavior[event].call(behavior, this, this.model, this.query);
			}
			var previous = child._previous;
			var next = child._next;
			if (previous)
				previous._next = next;
			else
				this._first = next;
			if (next)
				next._previous = previous;
			else
				this._last = previous;

			if (child._error && !this._error)
				this.doError(child._error);

			this.synchronize();
		}
	},
	doError: { value:
		function(error) {
			this._error = error;
		}
	},
	doRender: { value:
		function() {
			var buffer, text, behavior = this.behavior;
			if (this._response) {
					text = behavior.on_render.call(behavior, this, this.model, this.query);
					if (text) {
						buffer = new Buffer(text);
						this._response.writeHead(this.status, { 'Content-Type': this.contentType, 'Content-Length': buffer.length });
						this._response.end(buffer);
					}
			}
			else if (this._target) {
				text = behavior.on_render.call(behavior, this, this.model, this.query);
				if (text) {
					this._target.innerHTML = text;
					behavior.on_load.call(behavior, this, this.model, this.query);
				}
			}
		}
	},
	doRequest: { value:
		function() {
			setTimeout(this.doRequestTimeout.bind(this), 1);
		}
	},
	doRequestTimeout: { value:
		function() {
			try {
				try {
					this.behavior.on_request(this, this.model, this.query);
				}
				catch(error) {
					this.doError(error);
				}
				this.synchronize();
			}
			catch (error) {
				application.reportError(this, error);
			}
		}
	},
	getFilter: { value:
		function() {
		}
	},
	redirect: { value:
		function(url, it) {
			if (!it) it = {};
			if ("_request" in this) {
				it.request = this._request;
				delete this._request;
			}
			if ("_response" in this) {
				it.response = this._response;
				delete this._response;
			}
			if ("_target" in this) {
				it.target = this._target;
				delete this._target;
			}
			if (!it.query) it.query = {};
			var constructor = application.findHandler(url, it.query);
			var handler = new constructor(this.parent, url, it);
			handler.doRequest();
			return handler;
		}
	},
	request: { value:
		function(url, it) {
			if (!it) it = {};
			if (!it.query) it.query = {};
			var constructor = application.findHandler(url, it.query);
			var handler = new constructor(this, url, it);
			handler.doRequest();
			return handler;
		}
	},
	synchronize: { value:
		function() {
			if (!this._last) {

				if (!this._error)
					this.behavior.on_complete(this, this.model, this.query);
				else
					this.behavior.on_error(this, this._error);

				if (this.parent)
					this.parent.dequeue(this);
				else {
					if (!this._error)
						this.doRender();
					else
						throw this._error;
				}
			}
		}
	},
	valueOf: { value:
		function() {
			return this.result;
		}
	},
});



var HTTPHandler = function(parent, url, it) {
	Handler.call(this, parent, url, it);
};
HTTPHandler.template = template3;
HTTPHandler.prototype = Object.create(Handler.prototype, {
	doRequest: { value:
		function() {
			var it = this.it;
			var client = this.getXMLHttpRequest();
			if ("method" in it)
				method = it.method;
			else
				method = "GET";
			var url = this.url;
			if ("host" in it)
				url = it.host + url;
			var params;
			if ("query" in it) {
				if (method == "GET")
					url += "?" + this.serializeQuery(it.query);
				else
					params = this.serializeQuery(it.query);
			}
			client.open(method, url);
			if (method == "GET")
				client.send();
			else {
				client.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
				client.send(params);
			}
		}
	},
	getXMLHttpRequest: { value:
		function() {
			var client;
			if (typeof XDomainRequest === "undefined") {
				client = new XMLHttpRequest();
				client.onreadystatechange = this.onreadystatechange.bind(client, this);
			}
			else {
				client = new XDomainRequest();
				client.setRequestHeader = function () {return;};
				client.onload = this.onload.bind(client, this);
				client.ontimeout = this.ontimeout.bind(client, this);
			}
			return client;
		}
	},
	onload: { value:
		function(handler) {
			try {
				try {
					handler.result = JSON.parse(this.responseText);
				}
				catch (error) {
					handler.doError(error);
				}
				handler.synchronize();
			}
			catch (error) {
				application.reportError(handler, error);
			}
		}
	},
	onreadystatechange: { value:
		function(handler) {
			try {
				if (this.readyState === this.DONE) {
					if (this.status === 200) {
						try {
							handler.result = JSON.parse(this.responseText);
						}
						catch (error) {
							handler.doError(error);
						}
						handler.synchronize();
					}
					else if (this.status === 0) {
						handler.doError(new Error('Could not reach Server'));
						handler.synchronize();
					}
					else if (this.status) {
						handler.responseText = this.responseText;
						handler.doError(new Error('Server error ('+this.status+')'));
						handler.synchronize();
					}
				}
			}
			catch (error) {
				application.reportError(handler, error);
			}
		}
	},
	ontimeout: { value:
		function(handler) {
			try {
				handler.doError(new Error('La connexion Internet semble interrompue.'));
				handler.synchronize();
			}
			catch (error) {
				application.reportError(handler, error);
			}
		}
	},
	serializeQuery: { value:
		function(query) {
			var items = [], name;
			for (name in query) {
				items.push(name + '=' + encodeURIComponent(query[name]));
			}
			return items.join('&');
		}
	},
});


var Behavior = function(it) {
	for (var i in it) {
		this[i] = it[i];
	}
};
Behavior.template = template1;
Behavior.prototype = Object.create(Object.prototype, {
	on_complete: { value:
		function(handler, model, query) {
		}, writable: true,
	},
	on_error: { value:
		function(handler, error) {
			application.log("Error in " + handler.url + ": " + error.toString());
		}, writable: true,
	},
	on_load: { value:
		function(handler, model, query) {
		}, writable: true,
	},
	on_render: { value:
		function(handler, model, query) {
		}, writable: true,
	},
	on_request: { value:
		function(handler, model, query) {
		}, writable: true,
	},
});



var Model = function() {
};
Model.prototype = Object.create(Object.prototype, {
	anchor: { value: '', writable : true, },
	include: { value:
		function(url) {
			return application.renderWithModel(this, url);
		}
	},
	json: { value:
		function (target) {
			var result;
			if (target) {
				result = JSON.stringify(target, null, 4);
			} else {
				result = JSON.stringify(this, null, 4);
			}
			return result;
		}
	},
	escapeHTML: { value:
		function (s) {
			return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		}
	},
});



var Template = function(name, it) {
	this.name = name;
	this.it = it;
	if ("on_render" in it) {
		this.on_render = it.on_render;
	}
};
Template.template = template2;
Template.prototype = Object.create(Object.prototype, {
	on_render: { value:
		function(handler, model, query) {
			return '';
		}, writable: true,
	},
});



var Application = function () {
	this.addHandler("/error404", Error404Handler);
};
Application.prototype = Object.create(Object.prototype, {
	filters: { value: {}, writable: true, },
	handlerConstructors: { value: {}, writable: true, },
	properties: { value: {}, writable: true, },
	templateConstructors: { value: {}, writable: true, },

	addHandler: { value:
		function(url, handler, filter) {
			this.handlerConstructors[url] = handler;
			if (filter)
				this.filters[url] = filter;
			else {
				filter = handler.prototype.getFilter();
				if (filter)
					this.filters[url] = filter;
			}
		}
	},
	addProperty: { value:
		function(name, property) {
			this.properties[name] = property;
		}
	},
	addTemplate: { value:
		function(name, template) {
			this.templateConstructors[name] = template;
		}
	},
	findHandler: { value:
		function(url, query) {
			var offset = url.indexOf('?');
			if (offset > 0) {
				query = this.parseQuery(url.substring(offset + 1), query);
				url = url.substring(0, offset);
			}
			else
				query = query || {};

			var filters = this.filters;
			var constructor = this.handlerConstructors[url];
			if (constructor) {
				var filter = filters[url];
				if (filter && !(filter)(url, query))
					constructor = undefined;
			}
			if (!constructor) {
				for (var url1 in this.filters)
					if ((filters[url1])(url, query))
						constructor = this.handlerConstructors[url1];
			}
			if (!constructor)
				constructor = this.handlerConstructors['/error404'];

			return constructor;
		}
	},
	findTemplate: { value:
		function(name) {
			return this.templateConstructors[name];
		}
	},
	getModel: { value:
		function() {
			if (!this.model) {
				this.model = new Model();
				this.model.anchor = "/#";
			}
			return this.model;
		}
	},
	landing: { value:
		function(url) {
			if (window.location.hash) {
				this.request(window.location.hash.substring(1));
			}
			else {
				window.location = window.location.href + "#" + url;
			}
		}
	},
	log: { value:
		function() {
			console.log.apply(console, arguments);
		}
	},
	parseQuery: { value:
		function(url, query) {
			var param, params, i, l;
			query = query || {};
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
	},
	render: { value:
		function(url) {
			var model = this.getModel();
			return this.renderWithModel(model, url);
		}
	},
	renderWithModel: { value:
		function(model, url) {
			var path = url.split('?'), name = path[0], result;

			var constructor = application.findTemplate(name);
			if (constructor) {
				var template = new constructor(name, {});
				result = template.on_render(undefined, model, {});
			}
			else {
				throw 'Template "' + url + '" not found!';
			}
			return result;
		}
	},
	reportError: { value:
		function(handler, error) {
			var message;
			if (error.stack)
				message = error.stack.toString();
			else
				message = error.toString();

			while (handler.parent)
				handler = handler.parent;

			if (handler) {
				if (handler._response)
					this.sendErrorToResponse(handler._response, handler.url, message);
				else if (handler._target) {
					var body = '<h1>Internal Server Error</h1><p>The requested URL "' + handler.url + '" encounter the following error : ' + message.replace(/\n/g, '<br/>');
					body += '</p></body></html>';
					document.title = "500 Internal error";
					handler._target.innerHTML = body;
				}
			}
			this.log(message);
		}
	},
	sendErrorToResponse: { value:
		function(response, url, message) {
			var html = '<!DOCTYPE HTML><html><head><title>500 Internal Server Error</title></head><body>';
			html += '<h1>Internal Server Error</h1><p>The requested URL "' + url + '" encounter and error : ' + message.replace(/\n/g, '<br/>');
			html += '</p></body></html>';
			response.writeHead(500, { 'Content-Type': 'text/html', 'Content-Length': html.length });
			response.end(html);
		}
	},
	request: { value:
		function(url, it) {
			if (!it) it = {};
			if (!it.query) it.query = {};
			var constructor = application.findHandler(url, it.query);
			var handler = new constructor(null, url, it);
			handler.doRequest();
		}
	},
});



var Server = function () {
	Application.call(this);
};
Server.prototype = Object.create(Application.prototype, {
	httpServer: {value: null, writable: true,},

	getModel: { value:
		function() {
			return new Model();
		}
	},
	httpRequest: { value:
		function(request, response) {
			var formidable = require('formidable');
			var it = {request: request, response: response};

			try	{
				if (request.method === 'POST') {
					if (request.url.indexOf('?') > 0)
						throw new Error("POST request should not have a query: " + request.url);

					var query = it.query = {}, server = this;
					if (request.headers['content-type'] == 'text/plain;charset=UTF-8') {
						request.headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
					}

					var form = new formidable.IncomingForm();
					form.on('error', function (error) {
						throw error;
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
							query.data = buffer;
						});
						part.on('error', function (error) {
							throw error;
						});
					};
					form.on('end', function () {
						server.request(request.url, it);
					});
					form.parse(request);
				}
				else
					this.request(request.url, it);
			}
			catch (error) {
				var message;
				if (error.stack)
					message = error.stack.toString();
				else
					message = error.toString();
				this.log(message);
				this.sendErrorToResponse(response, request.url, message);
			}
		}
	},
	start: { value:
		function() {
			if (gHTTPServer) {
				this.httpServer = gHTTPServer;
			} else {
				var http = require('http'), server = this;
				this.httpServer = http.createServer(function (request, response) {
					server.httpRequest(request, response);
				});
				application.log('server listening on port: ' + this.properties.port);
				this.httpServer.listen(this.properties.port);
			}
		}
	},
	stop: { value:
		function() {
			if (!gHTTPServer && this.httpServer) {
				application.log('stop listening on port: ' + this.properties.port);
				this.httpServer.close();
			}
			this.httpServer = undefined;
		}
	},
});



var Client = function () {
	Application.call(this);

	if ("onhashchange" in window) {
		window.onhashchange = function () {
			application.request(window.location.hash.substring(1));
		};
	}
	else {
		var storedHash = window.location.hash;
		window.setInterval(function () {
			if (window.location.hash != storedHash) {
				storedHash = window.location.hash;
				application.request(window.location.hash.substring(1));
			}
		}, 100);
	}
};
Client.prototype = Object.create(Application.prototype, {
	request: { value:
		function(url, it) {
			if (it)
				it.target = document.body;
			else
				it = {target: document.body};
			Application.prototype.request.call(this, url, it);
		}
	},
});



var Error404Handler = Handler.template({
	contentType : { value: "text/html"},
	status : { value: "404"},
	behavior: Behavior.template ({
		on_render: function(handler, model, query) {
			application.log("404 Not found: " + handler.url);
			if (handler._response) {
				var html = '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL "';
				html += handler.url + '" was not found on this server.</p></body></html>';
				handler._response.writeHead(handler.status, { 'Content-Type': 'text/html', 'Content-Length': html.length });
				handler._response.end(html);
			}
			else if (handler._target) {
				document.title = "404 Not Found";
				handler._target.innerHTML = '<body><h1>Not Found</h1><p>The requested URL "' + handler.url + '" was not found on this server.</p>';
			}
		},
	})
});


var FileHandler = function(parent, url, it) {
	Handler.call(this, parent, url, it);
};
FileHandler.template = template3;
FileHandler.prototype = Object.create(Handler.prototype, {
	mime: { value: {
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
		xml: 'application/xml',
	}, writable: true, },
	_asctime: {value: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (..| .) (..):(..):(..) (....)$/, writable: true,},
	_rfc1123: {value: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (..) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (....) (..):(..):(..) (.*)$/, writable: true,},
	_rfc850: {value: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (..)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(..) (..):(..):(..) GMT$/, writable: true,},
	_month: {value: { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }, writable: true,},

	doRender: { value:
		function() {
			if (this._response) {
					var fs = require('fs');

					var headers = { 'Content-Length': this.query.stats.size };
					headers['Content-Type'] = this.getMIME(this.url);

					var ifModifiedSince = this._request.headers['If-Modified-Since'];
					if (ifModifiedSince)
						ifModifiedSince = this.parseDate(ifModifiedSince);

					headers['Last-Modified'] = this.query.stats.mtime.toUTCString();
					if (ifModifiedSince && (ifModifiedSince > this.query.stats.mtime)) {
						this._response.writeHead(304, headers);
						this._response.end();
					}
					else {
						this._response.writeHead(200, headers);
						this._response.end(fs.readFileSync(this.query.path));
					}
			}
		}
	},
	getMIME: { value:
		function (path) {
			var dot = path.lastIndexOf('.'), extension;
			if (dot) {
				extension = (path.substring(dot + 1)).toLowerCase();
				if (this.mime.hasOwnProperty(extension))
					return this.mime[extension];
				application.log('# mime not found!' + path + '\n');
			}
			return '';
		}
	},
	getFilter: { value:
		function() {
			return function(url, query) {
				var fs = require('fs');

				var path = application.properties.root + url;
				if (fs.existsSync(path)) {
					var stats = fs.statSync(path);
					if (stats.isFile()) {
						query.path = path;
						query.stats = stats;
						return true;
					}
				}
				return false;
			};
		}
	},
	parseDate: { value:
		function(d) {
			if (d) {
				var match = d.match(this._rfc1123);
				if (match) {
					if (!isNaN(parseInt(match[8], 10)))
						match[5] = Math.floor(parseInt(match[5], 10) - parseInt(match[8], 10) / 100);

					return new Date(Date.UTC(match[4], this._month[match[3]], match[2], match[5], match[6], match[7]));
				}

				match = d.match(this._rfc850);
				if (match)
					return new Date(Date.UTC(match[4], this._month[match[3]], match[2], match[5], match[6], match[7]));

				match = d.match(this._asctime);
				if (match)
					return new Date(Date.UTC(match[7], this._month[match[2]], match[3], match[4], match[5], match[6]));

				application.log('# Date format was not recognize: ' + d + '\n');
			}
			return new Date();
		}
	},
});
