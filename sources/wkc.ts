/*
	Webkool parser
	depend:
		- node-expat
		- fs
		- ./square.js

	ce qui est fait:
		-source map fonctionnel mais pas assez precise
		-la fonction builSOurceNode produit des object qui semble faux (le nom des attr devrai etre '.js' mais pas 32)
		-la fonction de print de ON a ete modifie pour faire des tests/

	todo:
		-patcher builSourceNode
		-etre plus precis sur le sourcemap

*/


declare var Buffer;
declare var process;
declare var require;
declare var __dirname;


function printTabs(nbr) {
	var str = '';
	for (var i = 0; i < nbr; i++)
		str += '\t';
	return (str);
}


function epurString(str) {
	return str.replace(/^\s*$/, '');
}

function sanitize(str) {
	var res = '';
	
	str.split('\n').forEach(function (itm, idx, col) {
		if (!((idx == 0 || idx == col.length - 1) && epurString(itm) == ''))
			res += itm + '\n';
	});
	return (res);
}




module Webkool {
	'use strict';
	
	/*
	** Template and Css Engine
	*/
	
	var version = '0.1.7'; 						//current version

	var templateEngine = {
		'square':	require('../lib/square'), 	//internal square templating module
		'mustache':	require('../lib/mustache') 	//internal mustache(hogan.js) templating module
	};
	
	var styleSheetEngine = {
		'css':		'',
		'less':		require('../lib/less'), 	//internal less module
		'sass':		require('../lib/sass') 		//internal sass module
	};
	
	/*
	**	require
	*/
	
	var expat 	= require('node-expat'); 		//parser
	var sm 		= require('source-map');	 	//source mapping
	var sbuff 	= require('stream-buffers'); 	//utils buffers
	var jshint	= require('jshint').JSHINT; 	//output syntax validation
	var fs 		= require('fs'); 				//filesystem access

	var outputJS,
		outputCSS,
		options = { 							//command line options
			client:		false,
			server: 	false,
			target: 	{},
			includes: 	[__dirname + '/../lib/client/', './'],
			inputs: 	[],
			output: 	'',
			jshint: 	''
		};

	enum	SideType { 							//compilation sides
		BOTH, 									// CLIENT & SERVER
		SERVER,
		CLIENT
	};


	function printHintErrors(errors, sourceMap) {
		var smc = new sm.SourceMapConsumer(sourceMap);

		errors.forEach(function (itm) {
			if (itm == null)
				console.log('to many Errors, please fix your code');
			else {
				var location = smc.originalPositionFor({
		  			line: 	itm.line,
			  		column: itm.character
				});
				if (location.line != null)
					console.log(itm.id, itm.code, itm.reason, 'in file', '<' + location.source + '>', '(' + location.line + ', ' + location.column + ')');
			}
		});

	}

	/*
	**	BufferManager
	*/


	class BufferManager { 						//Manage all output soure code using a buffer system (one pass system)
		private 		buffers;

		constructor() {
			this.buffers = [];
		}

		private newBuffer(neededSide:SideType, name:string) {
			this.buffers.push({
				'name': 		name,
				'side': 		neededSide,
				'data': 		[],
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

		public write(side:SideType, name:string, data:string, info:any, split) {
			if (side == SideType.BOTH) {
				this.write(SideType.SERVER, name, data, info, split);
				this.write(SideType.CLIENT, name, data, info, split);
			}
			else {
				// if info == null, the chunk will be not add to the source map

				var buff = this.get(side, name, true);

				//split chunk line by line and insert them with there real line number (source map tricks)
				if (split == true) {
					data.split('\n').forEach(function (itm, idx, col) {
						
						var infoTmp = {
							line:	info.line + idx,
							col: 	info.col,
							file: 	info.file
						};
						//filter used because expat already return 2 blank lines
						if ((idx == 0 || idx == col.length - 1) && epurString(itm) == '')
							infoTmp = null;

						buff.data.push({
							data: itm + '\n',
							info: infoTmp
						});
					});
				}
				else {
					buff.data.push({
						data: 	data,
						info: 	info
					});
				}
			}
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

		public insert(side:SideType, name:string, elm, info) {
			var buff = this.get(side, name, true)
			buff.data.push({
				data: 	elm,
				info:	info
			});
		}

		public merge(side:SideType, other:BufferManager, info) {
			if (side == SideType.BOTH) {
				this.merge(SideType.SERVER, other, info.line);
				this.merge(SideType.CLIENT, other, info.line);
			}
			else {
				var buff = other.getBuffers();

				for (var i = 0; i < buff.length; i++) {
					if (buff[i].side == side || buff[i].side == SideType.BOTH) {
						this.insert(side, buff[i].name, buff[i].data, info)
					}
				}
			}
		}

		public profoundToSourceMap(map, line, elm) {
			for (var i = 0; i < elm.length; i++) {
				var itm = elm[i]
				if (itm.data instanceof Array)
					line = this.profoundToSourceMap(map, line, itm.data)
				else {
					if (itm.info != null) {
						map.addMapping({
							'generated':  {
								'line': 	line,
								'column': 	0
							},
							'source': 		itm.info.file,
							'original': {
								'line': 	itm.info.line,
								'column': 	itm.info.col
							},
							'name': 		'plop'
						});
					}
					else {
						map.addMapping({
							generated:  {
								line: 	line,
								column: 0
							}
						});
					}
					line += itm.data.split('\n').length - 1;
				}
			}
			return (line);
		}

		public toSourceMap(side:SideType, name:string, filename:string) {
			var map = new sm.SourceMapGenerator({ file: 'out.js' });
			var generatedLine = 1;
			var buff = this.get(side, name, false);

			if (typeof buff !== 'undefined') {
				for (var i = 0; i < buff.data.length; i++) {
					var elm = buff.data[i];

					if (elm.data instanceof Array) {
						generatedLine = this.profoundToSourceMap(map, generatedLine, elm.data);
					}
					else {
						if (elm.info != null) {
							map.addMapping({
								generated:  {
									line: 	generatedLine,
									column: 0
								},
								source: 	elm.info.file,
								original: 	{
									line: 	elm.info.line,
									column: elm.info.col
								},
								name: 	'plop'

							});
							
						}
						else {
							map.addMapping({
								generated:  {
									line: 	generatedLine,
									column: 0
								}
							});
						}
						generatedLine += elm.data.split('\n').length - 1;
					}

				}
			}
			return (map)
		}


		//output generation
		public profoundToString(data) {
			var output = ''

			var _this = this;
			data.forEach(function (elm) {
				if (elm.data instanceof Array)
					output += _this.profoundToString(elm.data);
				else
					output += elm.data;
			});
			return (output)
		}

		public toString(side:SideType, name:string) {
			var output = '';
			var buff = this.get(side, name, false);
			var _this = this;

			if (typeof buff !== 'undefined') {
				buff.data.forEach(function (elm) {
					if (elm.data instanceof Array)
						output += _this.profoundToString(elm.data);
					else
						output += elm.data;
				});
			}
			return (output);
		}



		public dump() {
			console.log('##################################');
			for (var i = 0; i < this.buffers.length; i++) {
				console.log('[' + this.buffers[i].name + ']['+ this.buffers[i].side +'] = ');
				for (var j = 0; j < this.buffers[i].data.length; j++) {
					console.log('\t\t[' + j + ']', this.buffers[i].data[j]);
				}
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
		location;
		parent;
		children;
		name;
		attrs;
		text;
		line;
		outputType;

		constructor(parser, name, attrs, filename) {
			this.line = parser.getCurrentLineNumber();
			this.location = {
				line:	parser.getCurrentLineNumber(),
				col:	parser.getCurrentColumnNumber(),
				file:	filename
			};
			this.start(parser, name, attrs);
		}

		public start(parser, name, attrs) {
			if (parser.currentElement) {
				parser.currentElement.processText(parser);
				parser.currentElement.children.push(this);
			}
			this.parent 			= parser.currentElement;
			this.children 			= [];
			this.name 				= name;
			this.attrs 				= attrs;
			this.text 				= '';
			this.outputType 		= '.js';
			parser.currentElement 	= this;
			
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
				return new (this.elementRules[name])(parser, name, attrs, this.location.file);
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
		}

		public	printBody(buffers: BufferManager, side: SideType) {
			this.children.forEach(function(item) {
				item.print(buffers, side);
			});
		}

		public	printFooter(buffers: BufferManager, side: SideType) {
		}

		public getLocation(offsetLine, offsetColumn) {
			var location = this.location;

			location.line 	+= offsetLine;
			location.col 	+= offsetColumn;
			return (location);
		}
	}

	class Include extends Element {
		elementRules = {};
		name = 'include';
		parser;
		preparedBuffers;
		preparedSourceMap;
		js;
		css;


		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
			this.parser = parser;
			this.preparedBuffers = new BufferManager();
		}

		public prepare(parser) {
			var element = this;
			var filename = getPath(this.attrs.href);

			var extension = '.' + filename.split('.').pop();

			console.log('# including ' + this.attrs.href);
			if (!filename) {
				console.log('// include ' + this.attrs.href + ' not found!');
			}
			else {
				if (extension == '.wk') {
					parser.wait(this);
					this.outputType = '.wk'
					doParseDocument(filename, function (buffers) {
						element.preparedBuffers = buffers;
						parser.dequeue(element);
					});
				}
				else {
					parser.wait(this);
					this.outputType = extension;
					var _this = this;
					fs.readFile(filename, function (err, data) {
						var res = '';
						
						res += '/* include ' + element.attrs.href + '*/\n';
						res += data.toString();

						element.preparedBuffers.write(SideType.BOTH, extension, res, null, false);

						parser.dequeue(element);

					});
				}
			}
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.merge(side, this.preparedBuffers, this.location.line);
		}
	}

	class On extends Element {
		elementRules = {};
		name = 'on';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		printBody(buffers: BufferManager, side: SideType) {
			var begin 	= 'on_' + this.attrs.id + ': { value: function(context, model, query, result) {';
			var middle 	= this.text;
			var end 	= '}},\n';


//			hint(sanitize(middle), this.location)
			
			buffers.write(side, this.outputType, begin, null, false);
			buffers.write(side, this.outputType, middle, this.location, true);
			buffers.write(side, this.outputType, end, null, false);
		}

	}

	class Property extends Element {
		elementRules = {};
		name = 'property';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		printBody(buffers: BufferManager, side: SideType) {
			if (!this.attrs.hasOwnProperty('id'))
				throw new Error('properties must have an id!');

			var data = '';

			data += 'application.addProperty(\"';
			data += this.attrs.id;
			data += '\", \"';
			data += this.text;
			data += '\");\n';

			buffers.write(side, this.outputType, data, null, false);
		}
	}

	class Script extends Element {
		elementRules = {};
		name = 'script';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		printBody(buffers: BufferManager, side: SideType) {
			var data = this.text;

//			hint(sanitize(data), this.location)

			buffers.write(side, this.outputType, data, this.location, true);
		}
	}

	class Stylesheet extends Element {
		elementRules = {};
		name = 'stylesheet';
		type = 'css';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
			if (this.attrs.hasOwnProperty('system') && styleSheetEngine.hasOwnProperty(this.attrs.system))
				this.outputType = '.' + this.attrs.system;
		}
		
		printBody(buffers: BufferManager, side: SideType) {
			var data = '';
		
			data += this.text;

			buffers.write(side, this.outputType, data, null, false);
		}
	}

	class Template extends Element {
		elementRules = {};
		name = 'template';
		templateName = 'square';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
			if (this.attrs.hasOwnProperty('system') && templateEngine.hasOwnProperty(this.attrs.system))
				this.templateName = this.attrs.system;
			
		}

		public printHeader(buffers: BufferManager, side: SideType) {
			if (this.attrs.hasOwnProperty('id')) {
				if (Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Embedded templates have no id!');
				var data = '';

				data += 'application.addTemplate(\"';
				data += this.attrs.id;
				data += '\", Object.create(Template.prototype, {\n';

				buffers.write(side, this.outputType, data, null, false);
			}
			else {
				if (!Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Stand-alone templates must have an id!');
			}
		}

		printBody(buffers: BufferManager, side: SideType) {
			var data = '';

			data += 'on_render';
			data += ': { value:\n';

			var cleaned = this.text.replace(/\s+/g, ' ');	//for a pretty indentation
			cleaned = cleaned.replace(/\"/g, '\\\"'); 		//keep \ in file;

			var bufferString = new Buffer(cleaned);
			var streamBuff = new sbuff.WritableStreamBuffer();

			var templateCompiler = new templateEngine[this.templateName].parse(bufferString);
			templateCompiler.print(streamBuff, '');	// compile and put the result in bufferTmp
		
			data += streamBuff.getContentsAsString("utf8");
			data += '},\n';


			buffers.write(side, this.outputType, data, null, false);
		}

		printFooter(buffers: BufferManager, side: SideType) {
			var data = '';
			if (this.attrs.hasOwnProperty('id')) {
				data += '\n}));\n\n';

				buffers.write(side, this.outputType, data, null, false);
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

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		print(buffers: BufferManager, side: SideType) {
			if (options.client || (!options.client && !options.server))
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

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		printHeader(buffers: BufferManager, side: SideType) {
			var data = '';

			data += 'application.addHandler(\"';
			data += this.attrs.url;
			data += '\", Object.create(Handler.prototype, {\n';
			data += 'url : { value: \"';
			data += this.attrs.url;
			data += '\"},\n';

			if (this.attrs.type) {
				data += 'contentType : { value: \"';
				data += this.attrs.type;
				data += '\"},\n';
			}

			buffers.write(side, this.outputType, data, null, false);
		}

		printFooter(buffers: BufferManager, side: SideType) {
			var data = '';

			data += '\n}));\n\n';
	
			buffers.write(side, this.outputType, data, null, false);
		}
	}

	class Bind extends Element {
		elementRules = {};
		name = 'bind';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		printBody(buffers: BufferManager, side: SideType) {
			var data = '';

			data += 'application.addObserver(' + this.attrs.data + ', ' + this.attrs.with + ');\n';

			buffers.write(side, this.outputType, data, null, false);
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

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		print(buffers: BufferManager, side: SideType) {
			if (options.server || (!options.client && !options.server))
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

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}
	}

	class Roots extends Element {
		elementRules = {
			application: Application
		};
		name = 'roots';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}
	}

	/*
	** Parse Arguments
	*/


	function doParseArguments (options) {
		var argv = require('optimist')
				.alias('c', 'client')
				.alias('s', 'server')
				.alias('v', 'version')
				.boolean(['server', 'client', 'version'])
				.string('o', 'i', 'hint')
				.describe('c', 'compile for client')
				.describe('s', 'compile for server')
				.describe('i', 'include directory')
				.describe('v', 'print the current version')
				.describe('o', 'output basename')
				.describe('hint', 'hint configuration')
				.usage('$0' + ' version ' + version)
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
		if (argv.hint) {
			if (argv.hint instanceof Array)
				options.jshint = loadJsHintFile(argv.hint[0]);
			else
				options.jshint = loadJsHintFile(argv.hint);
		}
		else
			options.jshint = loadJsHintFile(null);
		if (argv.v) {
			console.log('version: ' + version);
		}
		if (argv.o)
			options.output = (argv.o instanceof Array) ? (argv.o.splice(-1)) : (argv.o);


		argv._.forEach(function (elm) { options.inputs.push(elm) });
	}


	/*
	** parsing entry point and utils
	*/

	function loadJsHintFile(file) {
		var data = '';
		try {
			if (file == null) { throw Error('default file') }
			data = fs.readFileSync(file, 'utf-8')
		}
		catch (err) {
			console.log('using default jshint config file');
			try {
				data = fs.readFileSync(__dirname + '/../sources/templates/jshint.json', 'utf-8')
			} catch (e) { data = '' }

		}
		return (JSON.parse(data));
	}

	function hint(chunk, sourceMap) {
		if (jshint(chunk, options.jshint) == false) {
			console.log('###################');
			printHintErrors(jshint.data().errors, sourceMap);
			console.log('###################');
		}
	}


	function doNextDocument() {		
		if (options.inputs.length) {
			doParseDocument(options.inputs.shift(), doNextDocument);
		}
	}

	function doParseDocument(filename, callback) {
		var parser = new expat.Parser('UTF-8');
		parser.currentElement = null;
		parser.currentText = '';

		parser.roots = new Roots(parser, 'roots', null, filename);

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
			this.currentElement.processElement(parser, name, attrs, filename);
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
		
		console.log('# parsing ' + parser.filename.split('/').pop());
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

	function getDataFromSourceMap(sourceMap, side, type) {
		if (typeof sourceMap[type] === 'undefined' || typeof sourceMap[type][side] === 'undefined')
			return ('');
		return (JSON.stringify(sourceMap[type][side].toStringWithSourceMap({ file: ['.webkool.wk'] }).map));
	}

	function createFilesForSide(side:SideType, buffers:BufferManager, name) {
		if (side == SideType.BOTH) {
			createFilesForSide(SideType.SERVER, buffers, ((name.length == 0) ? ('') : (name + '.')) + 'server');
			createFilesForSide(SideType.CLIENT, buffers, ((name.length == 0) ? ('') : (name + '.')) + 'client');
		}
		else {
			var buff = buffers.getBuffers();
			for (var i = 0; i < buff.length; i++) {
				if (buff[i].side == side && (buff[i].name == '.js' || buff[i].name == '.css')) {
					var fileName  		= name + buff[i].name;
					var outputStream  	= fs.createWriteStream(fileName);
					var outputStreamMap = fs.createWriteStream(fileName + '.map');

					var txt 		= buffers.toString(side, buff[i].name);
					var sourceMap 	= buffers.toSourceMap(side, buff[i].name, 'index.wk');

					console.log('#saving in file ' + fileName);
					console.log('#saving in file ' + fileName + '.map');
					outputStream.write(txt);
					outputStream.write('//# sourceMappingURL=' + fileName + '.map');

					var sourceMapGenerated = sourceMap.toString();
					outputStreamMap.write(sourceMapGenerated);

					//jshint step
					if (buff[i].name == '.js') {
						hint(txt, JSON.parse(sourceMapGenerated));
					}
				}
			}
		}
	}

	function  joinBuffers(side:SideType, buffers:BufferManager) {
		if (side == SideType.BOTH) {
			joinBuffers(SideType.SERVER, buffers);
			joinBuffers(SideType.CLIENT, buffers);
		}
		else {
			//.less and .sass append at the end of .css buffer
			for (var eng in styleSheetEngine) {
				if (eng != 'css') {
					var streamBuff = new sbuff.WritableStreamBuffer();
					var inp = buffers.toString(side, '.' + eng);

					if (inp != '') {
						styleSheetEngine[eng].compile(inp, streamBuff);
						var line = buffers.get(side, '.css', true).data.length;
						buffers.write(side, '.css', streamBuff.getContentsAsString("utf8"), null, false); //tmp infos
					}
				}
			}
			//append application start at the end of .js

			if (side == SideType.SERVER) {
				var line = buffers.get(SideType.SERVER, '.js', true).data.length;
				buffers.write(SideType.SERVER, '.js', '\napplication.start();\n', null, false); //tmp infos
			}
		}
	}



	export function run() {
		//feed the option object with the command line;
		doParseArguments(options);
		//create a .webkool.wk file if it doesn't exist.
		checkWebKoolWkFileExistence();
		//begin the parsing of .webkool.wk
		doParseDocument('.webkool.wk', function (initialBuffers:BufferManager) {
			var _buffers = initialBuffers;
			//parse the entry point (index.wk for example)
			doParseDocument(options.inputs.shift(), function (buffers:BufferManager) {

				_buffers.merge(SideType.BOTH, buffers, 0);
				
				//process some operation over buffer
				joinBuffers(SideType.BOTH, _buffers);

				//write in file
				if (options.client)
					createFilesForSide(SideType.CLIENT, _buffers, (options.output.length == 0 ? 'client' : options.output));
				if (options.server)
					createFilesForSide(SideType.SERVER, _buffers, (options.output.length == 0 ? 'server' : options.output));
				if ((options.server && options.client) || (!options.server && !options.client))
					createFilesForSide(SideType.BOTH, _buffers, options.output);
			});
		});
	}
}

Webkool.run()













