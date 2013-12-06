/*
	Webkool parser
	depend:
		- node-expat
		- fs
		- ./square.js
*/


declare var Buffer;
declare var process;
declare var require;
declare var __dirname;

module Webkool {
	'use strict';
	
	
	/*
	** Template and Css Engine
	*/
	
	var templateEngine = {
		'square':	require('../lib/square'),
		'mustache':	require('../lib/mustache')
	};
	
	var styleSheetEngine = {
		'css':		'',
		'less':		require('../lib/less'),
		'sass':		require('../lib/sass')
	};
	
	/*
	**	require
	*/
	
	var expat = require('node-expat');
	var fs = require('fs');
	
	console.log(__dirname + '../lib/client/');
	
	var outputJS,
		outputCSS,
		options = {
			client: false,
			server: false,
			target: {},
			includes: [__dirname + '/../lib/client/', './'],
			inputs: [],
			output: '',
		};

	/*
	**	Nodes
	*/
		
	class Element {
		elementRules;

		parent;
		children;
		name;
		attrs;
		text;

		constructor(parser, name, attrs) {
			this.start(parser, name, attrs);
		}

		start(parser, name, attrs) {
			if (parser.currentElement) {
				parser.currentElement.processText(parser);
				parser.currentElement.children.push(this);
			}
			this.parent = parser.currentElement;
			this.children = [];
			this.name = name;
			this.attrs = attrs;
			this.text = '';
			parser.currentElement = this;
		}

		stop(parser, name) {
			this.processText(parser);
			parser.currentElement = this.parent;
		}

		prepare(parser) {
			this.children.forEach(function(item) {
				item.prepare(parser);
			});
		}

		processElement(parser, name, attrs) {
			if (this.elementRules.hasOwnProperty(name))
				return new (this.elementRules[name])(parser, name, attrs);
			parser.error('Element not found <' + name + '>');
		}

		processText(parser) {
			this.text += parser.currentText;
			parser.currentText = '';
		}

		print(js, css) {
			this.printHeader(js, css);
			this.printBody(js, css);
			this.printFooter(js, css);
		}

		printHeader(js, css) {
			return;
		}

		printBody(js, css) {
			this.children.forEach(function(item) {
				item.print(js, css);
			});
		}

		printFooter(js, css) {
			return;
		}
	}

	class Include extends Element {
		elementRules = {};
		name = 'include';
		parser;
		js;
		css;

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
			this.parser = parser;
		}

		prepare(parser) {
			var element = this;
			var filename = getPath(this.attrs.href), 
				filestream;
			
			if (!filename) {
				console.log('// include ' + this.attrs.href + ' not found!');
			}
			else {
				if (filename.substring(filename.length-3) === '.js') {
					console.log('# including ' + this.attrs.href);
					parser.wait(this);
					fs.readFile(filename, function (err, data) {
						element.js = data;
						parser.dequeue(element);
					});
				}
				else if (filename.substring(filename.length-4) === '.css') {
					console.log('# including ' + this.attrs.href);
					parser.wait(this);
					fs.readFile(filename, function (err, data) {
						element.css = data;
						parser.dequeue(element);
					});
				}
				else if (filename.substring(filename.length-3) === '.wk') {
					parser.wait(this);
					doParseDocument(filename, function (js, css) {
						element.js = js;
						element.css = css;
						parser.dequeue(element);
					});
				}
				else {
					console.log('// include ' + this.attrs.href + ' extension not found!');
				}
			}
		}

		printBody(js, css) {
			if (this.attrs.href.substring(this.attrs.href.length-3) === '.js') {
				js.write('// include ' + this.attrs.href + '\n');
				js.write(this.js);
			}
			else if (this.attrs.href.substring(this.attrs.href.length-4) === '.css') {
				css.write('/* include ' + this.attrs.href + '*/\n');
				css.write(this.css);
			}
			else if (this.attrs.href.substring(this.attrs.href.length-3) === '.wk') {
				js.write('// include ' + this.attrs.href + '\n');
				js.write(this.js);
				css.write('/* include ' + this.attrs.href + '*/\n');
				css.write(this.css);
			}
		}
	}

	class On extends Element {
		elementRules = {};
		name = 'on';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(js, css) {
			js.write('on_');
			js.write(this.attrs.id);
			js.write(': { value: function(context, model, query, result) {');
			js.write(this.text);
			js.write('}},\n');
		}
	}

	class Property extends Element {
		elementRules = {};
		name = 'property';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(js, css) {
			if (!this.attrs.hasOwnProperty('id')) {
			 throw new Error('properties must have an id!');
			}
			js.write('application.addProperty(\"');
			js.write(this.attrs.id);
			js.write('\", \"');
			js.write(this.text);
			js.write('\");\n');
		}
	}

	class Script extends Element {
		elementRules = {};
		name = 'script';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(js, css) {
			js.write(this.text);
			js.write('\n');
		}
	}

	class Stylesheet extends Element {
		elementRules = {};
		name = 'stylesheet';
		type = 'css';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
			if (this.attrs.hasOwnProperty('type') && styleSheetEngine.hasOwnProperty(this.attrs.type))
				this.type = this.attrs.type;
		}
		
		print(js, css) {
			if (this.type != 'css')
				styleSheetEngine[this.type].compile(this.text, css);
			else
				css.write(this.text);
		}
	}

	class Template extends Element {
		elementRules = {};
		name = 'template';
		templateName = 'square';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
			if (this.attrs.hasOwnProperty('system') && templateEngine.hasOwnProperty(this.attrs.system))
				this.templateName = this.attrs.system;
			
		}

		printHeader(js, css) {
			if (this.attrs.hasOwnProperty('id')) {
				if (Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Embedded templates have no id!');
				js.write('application.addTemplate(\"');
				js.write(this.attrs.id);
				js.write('\", Object.create(Template.prototype, {\n');
			}
			else {
				if (!Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Stand-alone templates must have an id!');
			}
		}

		printBody(js, css) {
			js.write('on_render');
			js.write(': { value:\n');

			var string = this.text.replace(/\s+/g, ' '), buffer, templateCompiler;
			string = string.replace(/\"/g, '\\\"');
			buffer = new Buffer(string);
			templateCompiler = new templateEngine[this.templateName].parse(buffer);
			templateCompiler.print(js, '');
			js.write('},\n');
		}

		printFooter(js, css) {
			if (this.attrs.hasOwnProperty('id')) {
				js.write('\n}));\n\n');
			}
		}
	}

	class Client extends Element {
		elementRules = {
			handler: Handler,
			include: Include,
			on: On,
			property: Property,
			script: Script,
			stylesheet: Stylesheet,
			template: Template
		};
		name = 'client';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		print(js, css) {
			if (options.client) {
				var flag = true;
				if (this.attrs.hasOwnProperty('target')) {
					/*
					with (options.target) {
						flag = this.attrs.target;
					}
					*/
					return;
				}
				if (flag)
					Element.prototype.print.call(this, js, css);
			}
		}
	}

	class Handler extends Element {
		elementRules = {
			on: On,
			bind: Bind,
			template: Template
		};
		name = 'handler';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printHeader(js, css) {
			js.write('application.addHandler(\"');
			js.write(this.attrs.url);
			js.write('\", Object.create(Handler.prototype, {\n');
			js.write('url : { value: \"');
			js.write(this.attrs.url);
			js.write('\"},\n');
			if (this.attrs.type) {
				js.write('contentType : { value: \"');
				js.write(this.attrs.type);
				js.write('\"},\n');
			}
		}

		printFooter(js, css) {
			js.write('\n}));\n\n');
		}
	}

	class Bind extends Element {
		elementRules = {};
		name = 'bind';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(js, css) {
			js.write('application.addObserver(' + this.attrs.data + ', ' + this.attrs.with + ');\n');
		}

	}

	class Server extends Element {
		elementRules = {
			handler: Handler,
			include: Include,
			on: On,
			property: Property,
			script: Script,
			stylesheet: Stylesheet,
			template: Template,
		};
		name = 'server';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		print(js, css) {
			if (options.server) {
				var flag = true;
				if (this.attrs.hasOwnProperty('target')) {
					/*
						with (options.target) {
						flag = this.attrs.target;
					}
					*/
					return;
				}
				if (flag)
					Element.prototype.print.call(this, js, css);
			}
		}
	}

	class Application extends Element {
		elementRules = {
			client: Client,
			handler: Handler,
			include: Include,
			property: Property,
			server: Server,
			script: Script,
			stylesheet: Stylesheet,
			template: Template,
		};
		name = 'application';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}
	}

	class Roots extends Element {
		elementRules = {
			application: Application
		};
		name = 'roots';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}
	}

	class StreamBuffer {
		buffers;

		constructor() {
			this.buffers = [];
		}

		write(data) {
			if (data) {
				if (typeof data  === "string")
					this.buffers.push(new Buffer(data));
				else
					this.buffers.push(data);
			}
		}

		toString() {
			if (this.buffers.length) {
				return Buffer.concat(this.buffers);
			}
			else {
				return "";
			}
		}
	}

	function doParseArguments (options) {
		var args = process.argv, c = args.length, i;
		for (i = 2; i < c; i += 1) {
			switch (args[i]) {
			case '-client':
				options.client = true;
				options.server = false;
				break;
			case '-server':
				options.client = false;
				options.server = true;
				break;
			case '-target':
				i += 1;
				options.target[args[i]] = true;
				break;
			case '-i':
				i += 1;
				options.includes.push(args[i]);
				break;
			case '-o':
				i += 1;
				options.output = args[i];
				break;
			default:
				options.inputs.push(args[i]);
				break;
			}
		}
	}
//historique:  a 
	function doNextDocument() {
		
		if (options.inputs.length) {
			doParseDocument(options.inputs.shift(), doNextDocument);
		}
	}
	
	function doParseDocument(filename, callback) {
		var parser = new expat.Parser('UTF-8');
		parser.currentElement = null;
		parser.currentText = '';

		parser.roots = new Roots(parser, 'roots', null);

		parser.filename = filename;
		parser.elements = [parser];		
		parser.wait = function (element) { //element est un parser
			this.elements.push(element);
		}
		parser.dequeue = function (element) {
			var index = this.elements.indexOf(element);
			if (index < 0) console.log('>>>> DEQUEUE UNKNOWN ELEMENT');
			this.elements.splice(index, 1);
			if (this.elements.length == 0) {
				var js = new StreamBuffer();
				var css = new StreamBuffer();
				this.currentElement.print(js, css);
				if (callback)
					callback(js.toString(), css.toString());
				}
		}
		parser.error = function (e) {
			console.log(parser.filename + ':' + parser.getCurrentLineNumber() + ': error:' + e);
		}
		parser.addListener('error', function(e) {
			console.log(parser.filename + ':' + parser.getCurrentLineNumber() + ': error:' + e);
		});
		parser.addListener('startElement', function(name, attrs) {
			this.currentElement.processElement(parser, name, attrs);
		});
		parser.addListener('endElement', function(name) {
			this.currentElement.stop(parser, name);
		});
		parser.addListener('text', function(s) { 															// concatenation du text
			this.currentText += s;
		});
		parser.addListener('end', function() {
			this.currentElement.prepare(parser);
			parser.dequeue(parser);
		});
		console.log('# parsing ' + parser.filename);
		parser.input = fs.createReadStream(parser.filename);
		parser.input.pipe(parser);
	}

	function getPath(filename) {
		var i, c = options.includes.length, path, folder;
		for (i = 0; i < c; i+= 1) {
			folder = options.includes[i];
			try {
				path = makePath(folder, filename);
				if (path) {
					return path;
				}
			}
			catch (unused) {
				continue;
			}
		}
	}

	function makePath(rootpath, filename) {
		var length = rootpath.length, 
			path = filename;
		if (length) {
			if (rootpath.charAt(length - 1) != '/') {
				path = rootpath + '/' + filename;
			}
			else {
				path = rootpath + filename;
			}
		}
		return fs.realpathSync(path);
	}

	export function run() {
		doParseArguments(options);

		doParseDocument(options.inputs.shift(),
			function (js, css) {
				var jsStream = fs.createWriteStream(options.output + '.js');
				if (options.server == true)
					js += '\napplication.start()\n';
				jsStream.write(js);

				if (options.client) {
					var cssStream = fs.createWriteStream(options.output + '.css');
					cssStream.write(css);
				}
		});
	}
}

Webkool.run()