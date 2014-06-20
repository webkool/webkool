/*
	Webkool parser

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

	var version = '0.4.3'; 						//current version

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
	var terminal = require('color-terminal');
	var expat 	= require('node-expat'); 		//parser
	var sm 		= require('source-map');	 	//source mapping
	var sbuff 	= require('stream-buffers'); 	//utils buffers
	var jshint	= require('jshint').JSHINT; 	//output syntax validation
	var fs 		= require('fs');				//filesystem access
	var pathm 	= require('path');
	var async	= require('async');
	var stream 	= require('stream');

	var simApp;
	var logger;

	var outputJS,
		outputCSS,
		pr,
		options = { 							//command line options
			client:		false,
			server: 	false,
			color: 		true,
			target: 	{},
			includes: 	[__dirname + '/../lib/client/', ''],
			inputs: 	[],
			output: 	'',
			jshint: 	''
		};

	enum	SideType { 							//compilation sides
		BOTH, 									// CLIENT & SERVER
		SERVER,
		CLIENT
	};


	function printHintErrors(errors, sourceMap, output) {
		var smc = new sm.SourceMapConsumer(sourceMap);

		var feedback = {
			error: 		0,
			warning:	0
		};

		errors.forEach(function (itm) {
			if (itm == null)
				logger.error('to many Errors, please fix your code');
			else {
				var location = smc.originalPositionFor({
		  			line: 	itm.line,
			  		column: itm.character
				});
				var dirname = pathm.dirname(output);
				var fullPath = pathm.resolve(pathm.dirname(output));

				if (location.line != null) {
					var path = pathm.resolve(fullPath, pathm.relative(fullPath, location.source));
					if (itm.code[0] === 'W') {
						logger.warning(path, location.line, location.column, itm.code + ' ' + itm.reason);
						feedback.warning++;
					}
					else {
						logger.error(path, location.line, location.column, itm.code + ' ' + itm.reason);
						feedback.error++;
					}
				}
				else {
					var path = pathm.resolve(fullPath, pathm.relative(fullPath, sourceMap.file));
					if (itm.code[0] === 'W') {
						logger.warning(path, itm.line, itm.character, itm.code + ' ' + itm.reason);
						feedback.warning++;
					}
					else {
						logger.error(path, itm.line, itm.character, itm.code + ' ' + itm.reason);
						feedback.error++;
					}
				}
			}
		});
		return (feedback.error === 0);
	}



	/*
	**	Logger
	*/

	class	Logger {
		stream;

		constructor(outputStream) {
			this.stream = outputStream;
		}

		error(file, line, column, message) {
			var msg;

			if (typeof line === 'undefined' && typeof column === 'undefined' && typeof message === 'undefined')
				msg = '# ERROR in file ' + file + '\n';
			else {
				msg = '# ERROR in file ' + file + ':' + line + ':' + column + ': ' + message + '\n';
			}
			if (options.color) {
				terminal.color('red').write(msg).reset();
			}
			else {
				terminal.write(msg);
			}
		}

		warning(file, line, column, message) {
			var msg = '# ' + 'WARNING in file ' + file + ':' + line + ':' + column + ': ' + message + '\n';
			if (options.color) {
				terminal.color('green').write(msg).reset();
			}
			else {
				terminal.write(msg);
			}
		}

		info(message) {
			var msg = '# ' + message + '\n';
			terminal.write(msg);
		}
	}

	/*
	**	BufferManager
	*/

	class PathRes {
		output:string;
		root:string;
		file:string;
		sm:string;
		side:SideType;
		currentFolder:string;

		constructor(output) {
			this.output = output;
			this.root = this.getDirFromPath(output);
			this.file = this.getFileFromPath(output);
			this.sm = this.root + 'source-map/';
			this.currentFolder = pathm.resolve() + '/';
		}

		public getRoot() {
			return (this.root);
		}

		public getSide(client:boolean, server:boolean) {
			return ((client && server) || (!client && !server)) ?
				(SideType.BOTH) :
				((client) ? (SideType.CLIENT) : (SideType.SERVER));
		}

		public getFile() {
			return (this.file);
		}

		public getOutputFile(side) {
			var filename = this.file;
			var client = null;
			var server = null;

			if (side == SideType.CLIENT)
				client = filename + ((filename[filename.length - 1] == '/') ? ('client') : (''));
			if (side == SideType.SERVER)
				server = filename + ((filename[filename.length - 1] == '/') ? ('server') : (''));
			if (side == SideType.BOTH) {
				client = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'client';
				server = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'server';
			}
			return ([client, server]);
		}

		public getSourceMap() {
			return (this.sm);
		}
		public getCurrentFolder() {
			return (this.currentFolder);
		}

		public getSourceMapName(side) {
			var filename = this.sm + this.file;
			var client = null;
			var server = null;

			if (side == SideType.CLIENT)
				client = filename + ((filename[filename.length - 1] == '/') ? ('client') : (''));
			if (side == SideType.SERVER)
				server = filename + ((filename[filename.length - 1] == '/') ? ('server') : (''));
			if (side == SideType.BOTH) {
				client = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'client';
				server = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'server';
			}
			return ([client, server]);
		}

		public getOutputName(side) {
			var filename = this.root + this.file;
			var client = null;
			var server = null;

			if (side == SideType.CLIENT)
				client = filename + ((filename[filename.length - 1] == '/') ? ('client') : (''));
			if (side == SideType.SERVER)
				server = filename + ((filename[filename.length - 1] == '/') ? ('server') : (''));
			if (side == SideType.BOTH) {
				client = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'client';
				server = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'server';
			}
			return ([client, server]);
		}

		public resolve(that, path) {
			var res = pathm.resolve(that + path);
			if (path.length === 0)
				return (this.root);

			else if (path[path.length - 1] == '/')
				return (res + '/');
			return (res);
		}

		public resolveCheck(file, inc) {
			var np = '';
			for (var i = 0; i < inc.length; i++) {
				np = pathm.resolve(inc[i] + file);
				if (fs.existsSync(np))
					return (np);
			}
			return (null);
		}

		public 	getRelative(p1, p2) {
			return (pathm.relative(p1, p2));
		}

		public getDirFromPath(path) {
			var res = pathm.resolve(path) + (path == '' ? '/' : '');
			if (path.length > 0 && res[res.length - 1] != '/' && path[path.length - 1] == '/')
				res += '/';
			if (path.length > 0 && path[path.length - 1] != '/')
				res = res.substr(0, res.lastIndexOf('/')) + '/';
			return (res);
		}

		public getFileFromPath(path) {
			var file = '';
			var res = pathm.resolve(path) + (path == '' ? '/' : '');
			if (path.length > 0 && path[path.length - 1] != '/')
				file = res.substr(res.lastIndexOf('/') + 1);
			return (file);
		}

	}

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
							line:		info.line + idx,
							col: 		info.col,
							file: 		info.file,
							fullPath: 	info.fullPath
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
							'source': 		itm.info.fullPath,
							'original': {
								'line': 	itm.info.line,
								'column': 	itm.info.col
							}
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
			var map = new sm.SourceMapGenerator({ file: filename });
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
								source: 	elm.info.fullPath,
								original: 	{
									line: 	elm.info.line,
									column: elm.info.col
								}
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
	}

	class Router {
		client;
		server;

		constructor() {
			this.client = {};
			this.server = {};
		}

		addHandler(side, method, url, file, line, column) {
			var sideHandler = side == SideType.CLIENT ? this.client : this.server;
			if (!sideHandler.hasOwnProperty(url))
				sideHandler[url] = {};
			if (sideHandler[url].hasOwnProperty(method)) {
				var info = sideHandler[url][method];
				var filename = pr.resolveCheck(file, options.includes);
				var filenamePrev = pr.resolveCheck(info.file, options.includes);

				logger.warning(filename, line, column, 'handler "' + url + '"');
				logger.warning(filenamePrev, info.line, info.column, 'previously defined here.');
			}
			sideHandler[url][method] = {
				file:	file,
				line:	line,
				column:	column
			};
		}
	}

	/*
	**	Nodes
	*/

	function 	loadExternFile(context, parser, filename, putInBuffer) {
		var found 		= false;
		var element 	= context;
		var extension 	=  '.' + filename.split('.').pop();
		var content 	= '';
		var readIncludeFile = function (parser, element, filename, extension) {
			try {
				var res = '';
				if (putInBuffer == true)
					res += '/* include ' + filename + ' */\n';
				res += fs.readFileSync(filename, 'utf-8');
				if (putInBuffer == true)
					element.preparedBuffers.write(SideType.BOTH, extension, res, null, false);
				else
					content = res;
				parser.dequeue(element);
				return (true);
			}
			catch (e) {
				return (false);
			}
		}

		parser.wait(context);
		context.outputType = extension;

		if (!readIncludeFile(parser, element, filename, extension)) {
			for (var i = 0; i < options.includes.length; i++) {
				var newName = options.includes[i] + context.attrs.href;
				if (readIncludeFile(parser, element, newName, extension)) {
					found = true;
					break;
				}
			}
		}
		else 						{ found = true; }
		if (found === false) 		{ throw Error('file not found <' + context.attrs.href + '>'); }
		if (putInBuffer == false)	{ return (content); }
	}


	class Element {
		elementAttrs;
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
				line:		parser.getCurrentLineNumber(),
				col:		parser.getCurrentColumnNumber(),
				file:		filename,
				fullPath:   parser.fullPath
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

		public checkAttrs(attrs, location, tagName) {
			for (var name in attrs) {
				if (this.elementAttrs.indexOf(name) == -1) {
					throw Error('invalid attribute <' + name + '> (' + tagName + ') in file ' + location.file + ' (' + location.line + ':' + location.col + ')');
				}
			}
		}

		public stop(parser, name) {
			this.processText(parser);
			parser.currentElement = this.parent;
		}

		public prepare(parser) {
			this.checkAttrs(this.attrs, this.location, this.name);
			this.children.forEach(function(item) {
				item.prepare(parser);
			});
		}

		public processElement(parser, name, attrs) {
			if (this.elementRules.hasOwnProperty(name)) {
				return new (this.elementRules[name])(parser, name, attrs, this.location.file);
			}
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
		elementAttrs = ['href'];
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
			this.checkAttrs(this.attrs, this.location, this.name);
			var element = this;
			var filename = pr.resolveCheck(this.attrs.href, options.includes);

			var extension = pathm.extname(filename);
			if (filename !== null) {
				logger.info('including ' + filename);
				parser.wait(this);
				this.outputType = '.wk'
				doParseDocument(this.attrs.href, function (buffers) {
					element.preparedBuffers = buffers;
					parser.dequeue(element);
				});
			}
			else
				logger.error(this.location.file, this.location.line, this.location.col, '<' + this.attrs.href + '> file not found')
		}

		printBody(buffers: BufferManager, side: SideType) {
			buffers.merge(side, this.preparedBuffers, this.location.line);
		}
	}

	class On extends Element {
		elementRules = {};
		elementAttrs = ['id'];
		name = 'on';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}

		printBody(buffers: BufferManager, side: SideType) {
			if (this.attrs.id!='filter') {
				var begin 	= '\t\ton_' + this.attrs.id + ': function(handler, model, query) {'; //'
				var middle 	= this.text;
				var end 	= '\t\t},\n';

				var newLocation = {
					line: 	this.location.line,
					col: 	this.location.col,
					file: 	this.location.file,
					fullPath: 	this.location.fullPath
				};

				buffers.write(side, this.outputType, begin, null, false);
				buffers.write(side, this.outputType, middle, this.location, true);
				buffers.write(side, this.outputType, end, null, false);
			}
		}

	}

	class Property extends Element {
		elementRules = {};
		elementAttrs = ['id'];
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
		elementAttrs = ['href'];
		preparedBuffers;
		name = 'script';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
			this.preparedBuffers = new BufferManager();
		}

		public prepare(parser) {
			this.checkAttrs(this.attrs, this.location, this.name);
			if (this.attrs.hasOwnProperty('href'))
				loadExternFile(this, parser, this.attrs.href, true);
			this.outputType = '.js';
		}

		printBody(buffers: BufferManager, side: SideType) {
			if (this.attrs.hasOwnProperty('href'))
				buffers.merge(side, this.preparedBuffers, this.location.line);
			else {
				var data = this.text;

				var newLocation = {
					line: 		this.location.line,
					col: 		this.location.col,
					file: 		this.location.file,
					fullPath:	this.location.fullPath
				};
				buffers.write(side, this.outputType, data, newLocation, true);
			}
		}
	}

	class Stylesheet extends Element {
		elementRules = {};
		elementAttrs = ['system', 'href'];
		name = 'stylesheet';
		outputType = '.css';
		preparedBuffers;

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
			if (this.attrs.hasOwnProperty('system') && styleSheetEngine.hasOwnProperty(this.attrs.system))
				this.outputType = '.' + this.attrs.system;
			this.preparedBuffers = new BufferManager();
		}

		public prepare(parser) {
			this.checkAttrs(this.attrs, this.location, this.name);
			if (this.attrs.hasOwnProperty('href'))
				loadExternFile(this, parser, this.attrs.href, true);
		}


		printBody(buffers: BufferManager, side: SideType) {
			if (this.attrs.hasOwnProperty('href'))
				buffers.merge(side, this.preparedBuffers, this.location.line);
			else {
				var data = '';

				data += this.text;

				buffers.write(side, this.outputType, data, null, false);
			}
		}
	}

	class Template extends Element {
		elementRules = {};
		elementAttrs = ['system', 'id', 'href'];
		name = 'template';
		templateName = 'square';
		templateContent;

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
			if (this.attrs.hasOwnProperty('system') && templateEngine.hasOwnProperty(this.attrs.system))
				this.templateName = this.attrs.system;
		}

		public prepare(parser) {
			this.checkAttrs(this.attrs, this.location, this.name);
			if (this.attrs.hasOwnProperty('href'))
				this.templateContent = loadExternFile(this, parser, this.attrs.href, false);
			this.outputType = '.js';
		}

		public printHeader(buffers: BufferManager, side: SideType) {
			if (this.attrs.hasOwnProperty('id')) {
				if (Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Embedded templates have no id!');
				var data = '';

				data += 'application.addTemplate(\"' + this.attrs.id + '\", Template.template({\n';

				buffers.write(side, this.outputType, data, null, false);
			}
			else {
				if (!Handler.prototype.isPrototypeOf(this.parent))
					throw new Error('Stand-alone templates must have an id!');
			}
		}

		printBody(buffers: BufferManager, side: SideType) {
			var data = '';

			data += '\t\ton_render : ';

			var cleaned;

			if (this.attrs.hasOwnProperty('href'))
				cleaned = this.templateContent.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
			else
				cleaned = this.text.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
			cleaned = cleaned.replace(/\"/g, '\\\"');

			var bufferString = new Buffer(cleaned);
			var streamBuff = new sbuff.WritableStreamBuffer();

			var templateCompiler = new templateEngine[this.templateName].parse(bufferString);
			templateCompiler.print(streamBuff, '');	// compile and put the result in bufferTmp

			data += streamBuff.getContentsAsString("utf8");

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
		elementAttrs = [];
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
		elementAttrs = ['url', 'type', 'method', 'Constructor'];
		methodName = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'COPY', 'HEAD',
		'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'ALL'];
		name = 'handler';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);

			if (attrs.method) {
				if (this.methodName.indexOf(attrs.method) == -1)
					logger.warning(this.location.fullPath, this.location.line, 0, '<' + attrs.method + '> unknow method');
			}
		}

		printHeader(buffers: BufferManager, side: SideType) {
			simApp.addHandler(side, this.attrs.method || 'ALL', this.attrs.url, this.location.file, this.location.line, this.location.col);

			var data = 'application.addHandler(\"' + this.attrs.url + '\", '
			if (this.attrs.Constructor)
				data += this.attrs.Constructor + '.template({\n'
			else
				data += 'Handler.template({\n'

			if (this.attrs.type)
				data += '\tcontentType : { value: \"' + this.attrs.type + '\"},\n';
			data += '\tbehavior: Behavior.template({\n';

			buffers.write(side, this.outputType, data, null, false);
		}

		printFooter(buffers: BufferManager, side: SideType) {
			buffers.write(side, this.outputType, '\t})\n', null, false);
			buffers.write(side, this.outputType, '\n})', null, false);
			for (var child in this.children) {
				var element = this.children[child];
				if (element.name=="on" && element.attrs.id=='filter') {
					var begin = ', function(url, query) {';
					var middle = element.text;
					var end 	= '}\n';

					buffers.write(side, element.outputType, begin, null, false);
					buffers.write(side, element.outputType, middle, element.location, true);
					buffers.write(side, element.outputType, end, null, false);
				}
			}
			buffers.write(side, this.outputType, ');\n', null, false);
		}
	}

	class Bind extends Element {
		elementRules = {};
		elementAttrs = ['data', 'with'];
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
		elementAttrs = [];
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
		elementAttrs = ['xmlns'];
		name = 'application';

		constructor(parser, name, attrs, filename) {
			super(parser, name, attrs, filename);
		}
	}

	class Roots extends Element {
		elementRules = {
			application: Application
		};
		elementAttrs = [];
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
				.alias('n', 'nocolor')
				.boolean(['server', 'client', 'version', 'nocolor'])
				.string('o', 'i', 'hint')
				.describe('c', 'compile for client')
				.describe('s', 'compile for server')
				.describe('i', 'include directory')
				.describe('n', 'no terminal color ouptut')
				.describe('v', 'print the current version')
				.describe('o', 'output basename')
				.describe('hint', 'hint configuration')
				.usage('$0' + ' version ' + version)
				.demand('_')
				.argv;

		options.server = argv.server;
		options.client = argv.client;
		options.color = !argv.nocolor;

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
			logger.info('version: ' + version);
		}
		if (argv.o)
			options.output = (argv.o instanceof Array) ? (argv.o.splice(-1)) : (argv.o);

		argv._.forEach(function (elm) { options.inputs.push(elm) });
	}


	/*
	** parsing entry point and utils
	*/

	function loadJsHintFile(file) {
		var _logger = logger;
		var data = '';
		try {
			if (file == null) { throw Error('default file') }
			data = fs.readFileSync(file, 'utf-8')
		}
		catch (err) {
			_logger.info('using default jshint config file');
			try {
				data = fs.readFileSync(__dirname + '/../sources/templates/jshint.json', 'utf-8')
			} catch (e) { data = '' }

		}
		return (JSON.parse(data));
	}

	function hint(chunk, sourceMap, output) {
		if (jshint(chunk, options.jshint) == false) {
			return (printHintErrors(jshint.data().errors, sourceMap, output));
		}
		return (true);
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
		parser.fullPath = pr.resolveCheck(filename, options.includes);
		addFileInSourceMapFolder(parser.fullPath, options.output);
		parser.roots = new Roots(parser, 'roots', null, filename);

		parser.filename = parser.fullPath.substr(parser.fullPath.lastIndexOf('/') + 1);;

		parser.elements = [parser];
		parser.wait = function (element) { //element est un parser
			this.elements.push(element);
		}
		parser.dequeue = function (element) {
			var index = this.elements.indexOf(element);
			if (index < 0)
				logger.error('DEQUEUE UNKNOWN ELEMENT');
			this.elements.splice(index, 1);
			if (this.elements.length == 0) {
				var buffers = new BufferManager();
				this.currentElement.print(buffers, SideType.BOTH);

				if (callback)
					callback(buffers);
				}
		}
		parser.error = function (e) {
			logger.error(parser.filename, parser.getCurrentLineNumber(), 0, e);
		}
		parser.addListener('error', function(e) {
			logger.error(parser.filename, parser.getCurrentLineNumber(), 0, e);
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
			try {
				this.currentElement.prepare(parser);
				parser.dequeue(parser);
			} catch (err) {
				logger.error(filename, 0, 0, err.message);
			}
		});

		logger.info('parsing ' + parser.fullPath);
		parser.input = fs.createReadStream(parser.fullPath);
		parser.input.pipe(parser);
	}


	function checkWebKoolWkFileExistence(filename) {
		try {
			var path = fs.realpathSync(filename);
		} catch (e) {
			var data = fs.readFileSync(__dirname + '/../sources/templates/webkool.wk');
			fs.writeFileSync(filename, data);
		}
	}

	function getDataFromSourceMap(sourceMap, side, type) {
		if (typeof sourceMap[type] === 'undefined' || typeof sourceMap[type][side] === 'undefined')
			return ('');
		return (JSON.stringify(sourceMap[type][side].toStringWithSourceMap({ file: ['webkool.wk'] }).map));
	}

	function getOutputName(side:SideType) {
		var filename = pathm.resolve(options.output);

		if (options.output[options.output.length - 1] == '/')
			filename += '/';

		if (side == SideType.CLIENT) {
			var client = filename + ((filename[filename.length - 1] == '/') ? ('client') : (''));
			return ([client, null]);
		}
		if (side == SideType.SERVER) {
			var server = filename + ((filename[filename.length - 1] == '/') ? ('server') : (''));
			return ([null, server]);
		}
		if (side == SideType.BOTH) {
			var client = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'client';
			var server = filename + ((filename[filename.length - 1] == '/') ? ('') : ('.')) + 'server';
			return ([client, server]);
		}
		else {
			return (null);
		}

	}


	function createFilesForSide(side:SideType, buffers:BufferManager, filename, smfilename) {
		if (side == SideType.BOTH) {
			var rs = createFilesForSide(SideType.SERVER, buffers, filename[1], smfilename[1]);
			var rc = createFilesForSide(SideType.CLIENT, buffers, filename[0], smfilename[0]);
			if (rc && rs) {
				return ([rs[0].concat(rc[0]), rs[1].concat(rc[1])]);
			}
			return (null);
		}
		else {
			if (Array.isArray(filename))
				filename = (side == SideType.CLIENT) ? (filename[0]) : (filename[1]);
			if (Array.isArray(smfilename))
				smfilename = (side == SideType.CLIENT) ? (smfilename[0]) : (smfilename[1]);
			var errorInFile = false;
			var tmpFiles = [];
			var tmpFilesSourceMap = [];
			var buff = buffers.getBuffers();
			for (var i = 0; i < buff.length; i++) {
				if (buff[i].side == side && (buff[i].name == '.js' || buff[i].name == '.css')) {

					var txt 				= buffers.toString(side, buff[i].name);

					var ext 				= buff[i].name + '.tmp';
					var extsm  				= buff[i].name + '.map.tmp';

					var relSource 			= pr.getRelative(pr.getSourceMap(), pr.getRoot()) + '/' + filename.substr(filename.lastIndexOf('/') + 1) + ext;
					var relPath 			= pr.getRelative(pr.getRoot(), pr.getSourceMap()) + '/' + filename.substr(filename.lastIndexOf('/') + 1) + extsm;

					var sourceMap 			= buffers.toSourceMap(side, buff[i].name, relSource);
					var sourceMapGenerated 	= sourceMap.toString();

					var outputPath 			= filename + ext;
					var outputSourceMapPath = smfilename + extsm;


					sourceMap._file 		= sourceMap._file.substr(0, sourceMap._file.length - '.tmp'.length);
					var sources = sourceMap._sources._array;
					for (var j = 0; j < sources.length; j++) {
						var tmpPath = sources[j];
						sources[j] = tmpPath.substr(tmpPath.lastIndexOf('/') + 1);
					}

					txt += '//# sourceMappingURL=' + relPath.substr(0, relPath.length - '.tmp'.length);
					fs.writeFile(outputSourceMapPath, sourceMap.toString());
					fs.writeFile(outputPath, txt);


					logger.info('saving in file ' + outputPath.substr(0, outputPath.length - '.tmp'.length))
					logger.info('saving in file ' + outputSourceMapPath.substr(0, outputSourceMapPath.length - '.tmp'.length))


					if (buff[i].name == '.js') {
						if (hint(txt, JSON.parse(sourceMapGenerated), filename))
							tmpFiles.push(outputPath);
						else
							errorInFile = true;
					}
					else
						tmpFiles.push(outputPath);
					tmpFilesSourceMap.push(outputSourceMapPath);
				}
			}
			if (errorInFile)
				return (null);
			return ([tmpFiles, tmpFilesSourceMap]);
		}
	}

	function joinBuffers(side:SideType, buffers:BufferManager) {
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
						var data = streamBuff.getContentsAsString("utf8");
						buffers.write(side, '.css', data, null, false); //tmp infos
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

	function generateSourceMapFolder(where) {
		var folder = pr.getSourceMap();
		try {
			fs.mkdirSync(folder);
		} catch (ignore) {}
	}

	function addFileInSourceMapFolder(file, where) {
		try {
			var name = file.substr(file.lastIndexOf('/') + 1);
			var sm = pr.getSourceMap() + name;
			var fin = fs.createReadStream(file);
			var fout = fs.createWriteStream(sm);

			fin.pipe(fout);
		}
		catch (e) {
			logger.error('<' + file + '> file not found');
		}
	}

	function  	moveTmp(tmpFiles) {

		tmpFiles.forEach(function (itm) {
			fs.rename(itm, itm.substr(0, itm.length - '.tmp'.length), function (err) {
				if (err)
					throw Error(err);
			});
		});
	}

	export function run() {
		logger 	= new Logger(process.stdout);
		doParseArguments(options);
		pr 		= new PathRes(options.output);
		simApp  = new Router();

		options.includes.push(pr.getRoot());
		var entryFile = pr.resolveCheck(options.inputs.shift(), options.includes);
		var webkoolFile = pr.resolve(pr.getCurrentFolder(), 'webkool.wk');


		checkWebKoolWkFileExistence(webkoolFile);
		generateSourceMapFolder(options.output);
		//begin the parsing of webkool.wk

		doParseDocument(webkoolFile, function (initialBuffers:BufferManager) {
			var _buffers = initialBuffers;
			//parse the entry point (index.wk for example)
			doParseDocument(entryFile, function (buffers:BufferManager) {

				_buffers.merge(SideType.BOTH, buffers, 0);

				//process some operation over buffer
				joinBuffers(SideType.BOTH, _buffers);

				//write in file

				async.waterfall([
					function(callback) {
						var side = pr.getSide(options.client, options.server)
						var tmpFiles = createFilesForSide(side, _buffers, pr.getOutputName(side), pr.getSourceMapName(side));
						callback(null, tmpFiles);
					},
				    function(tmpFiles, callback){
				    	if (tmpFiles != null)
					    	moveTmp(tmpFiles[0].concat(tmpFiles[1]));
				        callback(null);
				    }
				]);
			});
		});
	}
}

Webkool.run()
