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
	var sbuff = require('stream-buffers');
	var fs = require('fs');
	
	var outputJS,
		outputCSS,
		options = {
			client:		false,
			server: 	false,
			target: 	{},
			includes: 	[__dirname + '/../lib/client/', './'],
			inputs: 	[],
			output: 	'untitled',
		};

	enum	SideType {
		BOTH,
		SERVER,
		CLIENT
	};

	/*
	**	BufferManager
	*/


	class BufferManager {
		private 		buffers

		constructor() {
			this.buffers = [];
		}

		private newBuffer(neededSide:SideType, name:string) {
			this.buffers.push({
				'name': 	name,
				'side': 	neededSide,
				'data': 	""
			});
		}

		public get(side:SideType, name:string, create:boolean) {
			for (var i = 0; i < this.buffers.length; i++) {
				if (this.buffers[i].name == name && this.buffers[i].side == side)
					return (this.buffers[i]);
			}
			if (create) {
				this.newBuffer(side, name);
				return (this.get(side, name, false));
			}
			return (undefined);
		}

		public write(side:SideType, name:string, data:string) {
			this.get(side, name, true).data += data;
		}

		public getBuffers() {
			return (this.buffers);
		}

		public exec(side:SideType, name:string, callback:Function) {
			callback(this.get(side, name, false));
		}

		public copy(other:BufferManager) {
			this.buffers = other.getBuffers();
		}

		public merge(side:SideType, other:BufferManager) {
			var buff = other.getBuffers();

			for (var i = 0; i < buff.length; i++) {
				if (side == buff[i].side || buff[i].side == SideType.BOTH)
					this.write(side, buff[i].name, buff[i].data);
			}
		}

		public dump() {
			console.log('##################################');
			for (var i = 0; i < this.buffers.length; i++) {
				console.log('[' + this.buffers[i].name + ']['+ this.buffers[i].side +'] = ' + this.buffers[i].data);
				console.log('------------------------------');
			}
			console.log('##################################\n');
		}
	}	


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

		public start(parser, name, attrs) {
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

		public stop(parser, name) {
			this.processText(parser);
			parser.currentElement = this.parent;
		}

		public prepare(parser) {
			this.children.forEach(function(item) {
				item.prepare(parser);
			});
		}

		public processElement(parser, name, attrs) {
			if (this.elementRules.hasOwnProperty(name))
				return new (this.elementRules[name])(parser, name, attrs);
			parser.error('Element not found <' + name + '>');
		}

		public processText(parser) {
			this.text += parser.currentText;
			parser.currentText = '';
		}

		public		print(buffers: BufferManager, side: SideType) {
			this.printHeader(buffers, side);
			this.printBody(buffers, side);
			this.printFooter(buffers, side);
		}

		public	printHeader(buffers: BufferManager, side: SideType) {
			return;
		}

		public	printBody(buffers: BufferManager, side: SideType) {
			this.children.forEach(function(item) {
				item.print(buffers, side);
			});
		}

		public	printFooter(buffers: BufferManager, side: SideType) {
			return;
		}
	}

	class Include extends Element {
		elementRules = {};
		name = 'include';
		parser;
		preparedBuffers;
		js;
		css;


		constructor(parser, name, attrs) {
			super(parser, name, attrs);
			this.parser = parser;
			this.preparedBuffers = new BufferManager();
		}

		public prepare(parser) {
			var element = this;
			var filename = getPath(this.attrs.href);
			var extension = filename.substring(filename.length - 3);

			console.log('# including ' + this.attrs.href);
			if (!filename) {
				console.log('// include ' + this.attrs.href + ' not found!');
			}
			else {
				if (extension == '.wk') {
					console.log('parsing wk file');
					parser.wait(this);
					doParseDocument(filename, function (buffers) {
						element.preparedBuffers.copy(buffers);
						parser.dequeue(element);
					});
				}
				else {
					console.log('parsing other ' + this.attrs.href);
					parser.wait(this);
					fs.readFile(filename, function (err, data) {
						element.preparedBuffers.write(SideType.BOTH, extension, '/* include ' + element.attrs.href + '*/\n');
						element.preparedBuffers.write(SideType.BOTH, extension, data);
						parser.dequeue(element);
					});
				}
			}
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.merge(side, this.preparedBuffers);
		}
	}

	class On extends Element {
		elementRules = {};
		name = 'on';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.js', 'on_');
			buffers.write(side, '.js', this.attrs.id);
			buffers.write(side, '.js', ': { value: function(context, model, query, result) {');
			buffers.write(side, '.js', this.text);
			buffers.write(side, '.js', '}},\n');
		}
	}

	class Property extends Element {
		elementRules = {};
		name = 'property';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(buffers: BufferManager, side: SideType) {
			if (!this.attrs.hasOwnProperty('id'))
				throw new Error('properties must have an id!');
			buffers.write(side, '.js', 'application.addProperty(\"');
			buffers.write(side, '.js', this.attrs.id);
			buffers.write(side, '.js', '\", \"');
			buffers.write(side, '.js', this.text);
			buffers.write(side, '.js', '\");\n');
		}
	}

	class Script extends Element {
		elementRules = {};
		name = 'script';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.js', this.text);
			buffers.write(side, '.js', '\n');
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
		
		//styleSheetEngine[this.type].compile(this.text, css);

		print(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.' + this.type, this.text)
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

		printHeader(buffers: BufferManager, side: SideType) {
			if (this.attrs.hasOwnProperty('id')) {
				if (Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Embedded templates have no id!');
				buffers.write(side, '.js', 'application.addTemplate(\"');
				buffers.write(side, '.js', this.attrs.id);
				buffers.write(side, '.js', '\", Object.create(Template.prototype, {\n');
			}
			else {
				if (!Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Stand-alone templates must have an id!');
			}
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.js', 'on_render');
			buffers.write(side, '.js', ': { value:\n');

			var cleaned = this.text.replace(/\s+/g, ' ');	//for a pretty indentation
			cleaned = cleaned.replace(/\"/g, '\\\"'); 		//keep \ in file;

			var bufferString = new Buffer(cleaned);
			var streamBuff = new sbuff.WritableStreamBuffer();

			var templateCompiler = new templateEngine[this.templateName].parse(bufferString);
			templateCompiler.print(streamBuff, '');	// compile and put the result in bufferTmp
			
			buffers.write(side, '.js', streamBuff.getContentsAsString("utf8"));
			buffers.write(side, '.js', '},\n');
		}

		printFooter(buffers: BufferManager, side: SideType) {
			if (this.attrs.hasOwnProperty('id')) {
				buffers.write(side, '.js', '\n}));\n\n');
			}
		}
	}

	class Client extends Element {
		elementRules = {
			handler: 	Handler,
			include:	Include,
			on: 		On,
			property: 	Property,
			script: 	Script,
			stylesheet: Stylesheet,
			template: 	Template
		};
		name = 'client';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		print(buffers: BufferManager, side: SideType) {
			console.log(buffers);
			if (options.client)
				Element.prototype.print.call(this, buffers, SideType.CLIENT);
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

		printHeader(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.js', 'application.addHandler(\"');
			buffers.write(side, '.js', this.attrs.url);
			buffers.write(side, '.js', '\", Object.create(Handler.prototype, {\n');
			buffers.write(side, '.js', 'url : { value: \"');
			buffers.write(side, '.js', this.attrs.url);
			buffers.write(side, '.js', '\"},\n');
			if (this.attrs.type) {
				buffers.write(side, '.js', 'contentType : { value: \"');
				buffers.write(side, '.js', this.attrs.type);
				buffers.write(side, '.js', '\"},\n');
			}
		}

		printFooter(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.js', '\n}));\n\n');
		}
	}

	class Bind extends Element {
		elementRules = {};
		name = 'bind';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.write(side, '.js', 'application.addObserver(' + this.attrs.data + ', ' + this.attrs.with + ');\n');
		}

	}

	class Server extends Element {
		elementRules = {
			handler:	Handler,
			include:	Include,
			on:			On,
			property:	Property,
			script: 	Script,
			stylesheet: Stylesheet,
			template: 	Template,
		};
		name = 'server';

		constructor(parser, name, attrs) {
			super(parser, name, attrs);
		}

		print(buffers: BufferManager, side: SideType) {
			if (options.server)
				Element.prototype.print.call(this, buffers, SideType.SERVER);
		}
	}

	class Application extends Element {
		elementRules = {
			client: 	Client,
			handler: 	Handler,
			include: 	Include,
			property: 	Property,
			server: 	Server,
			script: 	Script,
			stylesheet: Stylesheet,
			template: 	Template,
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

	/*
	** Parse Arguments
	*/


	function doParseArguments (options) {
		var argv = require('optimist')
				.alias('c', 'client')
				.alias('s', 'server')
				.boolean(['server', 'client'])
				.string('o', 'i')
				.describe('c', 'compile for client')
				.describe('s', 'compile for server')
				.describe('i', 'include directory')
				.describe('o', 'output basename')
				.usage('$0')
				.demand('_')
				.argv;

		options.server = argv.server;
		options.client = argv.client;

		if (argv.i) {
			if (argv.i instanceof Array)
				argv.i.forEach(function (elm) { options.includes.push(elm)});
			else
				options.includes.push(argv.i);
		}

		if (argv.o)
			options.output = (argv.o instanceof Array) ? (argv.o.splice(-1)) : (argv.o);

		argv._.forEach(function (elm) { options.inputs.push(elm) });
	}

	/*
	** parsing entry point and utils
	*/


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
				var buffers = new BufferManager();
				this.currentElement.print(buffers, SideType.BOTH);
				if (callback)
					callback(buffers);
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

	function checkWebKoolWkFileExistence() {
		try {
			var path = fs.realpathSync('./.webkool.wk');
		} catch (e) {
			var data = fs.readFileSync(__dirname + '/../sources/templates/webkool.wk');
			fs.writeFileSync('./.webkool.wk', data);
		}
	}

	function createFilesForSide(side:SideType, buffers:BufferManager) {
		// a retravailler, il reste des probleme avec les BOTH

		var buff = buffers.getBuffers();
		for (var i = 0; i < buff.length; i++) {
			console.log('i wnat buffer ' + buff[i].name + 'with side ' + side.toString());

			if (buff[i].side == side || side == SideType.BOTH) {
				var name = options.output + '.' + ((side == SideType.SERVER) ? ('server') : ('client')) + buff[i].name;
				console.log('#saving in file ' + name);

				var outputStream = fs.createWriteStream(name);
				outputStream.write(buff[i].data);
			}
		}
	}

//pas encore teste.

	export function run() {
		doParseArguments(options);

		checkWebKoolWkFileExistence();

		doParseDocument('.webkool.wk', function (initialBuffers:BufferManager) {
			var _buffers = initialBuffers;
			doParseDocument(options.inputs.shift(), function (buffers:BufferManager) {
				_buffers.merge(SideType.CLIENT, buffers);
				_buffers.merge(SideType.SERVER, buffers);
				//buffers.dump();
				//_buffers.dump();

				if (options.client)
					createFilesForSide(SideType.CLIENT, _buffers);
				if (options.server)
					createFilesForSide(SideType.SERVER, _buffers);
				if (options.server && options.client)
					createFilesForSide(SideType.BOTH, _buffers);


		//			jsStream.write(js);
		//			if (options.server == true)
		//				jsStream.write('\napplication.start()\n');
		//			if (options.client)
		//				cssStream.write(css)
			});
		});
	}
}

Webkool.run()