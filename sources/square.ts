

declare var exports;
declare var Buffer;
declare var encodeHTML;

module Square {
	'use strict';

	class Block {
		container;
		contents;

		constructor(container) {
			this.container = container;
			this.contents = [];
		}

		prepare(buffer) {
			var contents = this.contents, c = contents.length, i;
			for (i = 0; i < c; i += 1) {
				contents[i].prepare(buffer);
			}
		}

		print(stream, carriageReturn) {
			var contents = this.contents, c = contents.length, i;
			if (c > 0) {
				contents[0].print(stream, carriageReturn);
				for (i = 1; i < c; i += 1) {
					carriageReturn(stream, 0);
					contents[i].print(stream, carriageReturn);
				}
			}
		}
	}

	class Text {
		buffer;
		container;
		start = 0;
		stop = 0;

		constructor(container, offset) {
			this.container = container;
			this.start = offset;
			this.stop = offset;
		}

		prepare(buffer) {
			this.buffer = buffer.toString(null, this.start, this.stop);
		}

		print(stream, carriageReturn) {
			var text = this.buffer;
			text = text.replace(/\\n/g, '');
			text = text.replace(/\\t/g, '');
			text = text.replace(/\s+/g, ' ');
			if (text) {
				stream.write('result += \"')
				stream.write(text);
				stream.write('\";');
			}
		}
	}

	class Variable {
		container;
		contents;
		line;
		path;
		script;
		start = 0;
		stop = 0;

		constructor(container, start, stop, path, line) {
			this.container = container;
			this.start = start;
			this.stop = stop;
			this.path = path;
			this.line = line;
			this.contents = [];
		}

		prepare(buffer) {
			this.script = buffer.toString(null, this.start, this.stop);
			this.script = this.script.replace(/\\"/g, '"');
			var contents = this.contents, c = contents.length, i;
			for (i = 0; i < c; i += 1) {
				contents[i].prepare(buffer);
			}
		}

		print(stream, carriageReturn) {
			var blocks = this.contents;
			switch (blocks.length) {
				case 0:
					stream.write('result += ' + this.script + ';');
					break;
				case 1:
				case 2:
					stream.write('if (');
					stream.write(this.script);
					stream.write(') {');
					carriageReturn(stream, 1);
					blocks[0].print(stream, carriageReturn);
					carriageReturn(stream, -1);
					stream.write('}');
					if (blocks.length>1) {
						carriageReturn(stream, 0);
						stream.write('else {');
						carriageReturn(stream, 1);
						blocks[1].print(stream, carriageReturn);
						carriageReturn(stream, -1);
						stream.write('}');
					}
				break;
				case 3:
					blocks[0].print(stream, carriageReturn);
					carriageReturn(stream, 0);

					stream.write(this.script);
					stream.write('.forEach(function ($, $i, $$) {');
					carriageReturn(stream, 1);
					stream.write('var $c = $$.length;');
					carriageReturn(stream, 0);
					blocks[1].print(stream, carriageReturn);
					carriageReturn(stream, -1);
					stream.write('});');

					carriageReturn(stream, 0);
					blocks[2].print(stream, carriageReturn);
				break;
			}
		}
	}

	class Parser {
		contents;
		currentBlock;
		currentText;
		line = 0;
		path = '';
		cache;

		constructor(buffer, path) {
			this.contents = [];
			this.currentBlock = this;
			this.currentText = null;
			this.line = 1;
			this.path = path;
			this.parse(buffer);
			this.prepare(buffer);
		}

		parse(buffer) {
			var c, head, tail, offset = 0, former, start, stop;
			this.startText(offset);
			while ((c = buffer[offset])) {
				switch (c) {
				case 10:
					this.line += 1;
					offset += 1;
					break;
				case 13:
					this.line += 1;
					offset += 1;
					c = buffer[offset];
					if (c === 10)
						offset += 1;
					break;
				case 35: // #
					former = offset;
					offset += 1;
					start = offset;
					c = buffer[offset];
					if (c === 123) { // {
						offset += 1;
						start = offset;
						for (;;) {
							c = buffer[offset];
							if (c === 10) {
								this.line += 1;
								offset += 1;
							}
							else if (c === 13) {
								this.line += 1;
								offset += 1;
								c = buffer[offset];
								if (c === 10)
									offset += 1;
							}
							else if ((c === 125) && ((buffer[offset+1]===35) || (buffer[offset+1]===91))) // }# }[
								break;
							else
								offset += 1;
						}
						stop = offset;
						offset += 1;
						c = buffer[offset];
					}
					else {
						for (;;) {
							c = buffer[offset];
							if (((48 <= c) && (c <= 57)) || ((65 <= c) && (c <= 90)) || ((97 <= c) && (c <= 122)) || (c === 36) || (c === 95) || (c === 46))
								offset += 1;
							else
								break;
						}
						stop = offset;
					}
					if (c === 35) { // #
						this.stopText(former);
						if (start === stop)
							this.reportError('missing variable');
						else {
							this.pushVariable(start, stop);
							this.popVariable();
						}
						offset += 1;
						this.startText(offset);
					}
					else if (c === 91) { // [
						this.stopText(former);
						if (start === stop)
							this.reportError('missing id');
						else {
							this.pushVariable(start, stop);
							this.pushBlock();
						}
						offset += 1;
						this.startText(offset);
					}
					break;
				case 93: // ]
					former = offset;
					offset += 1;
					c = buffer[offset];
					if (c === 35) { // #
						this.stopText(former);
						this.popBlock();
						this.popVariable();
						offset += 1;
						this.startText(offset);
					}
					else if (c === 91) { // [
						this.stopText(former);
						this.popBlock();
						this.pushBlock();
						offset += 1;
						this.startText(offset);
					}
					break;
				case 60: // <
					former = offset;
					head = buffer.toString(null, offset, offset + 9);
					if (head.indexOf('<![CDATA[') === 0) {
						head = buffer.toString(null, offset + 9);
						tail = head.indexOf(']]>');
						if (tail >= 0)
							former = offset + 9 + tail + 3;
						else
							this.reportError('missing ]]>');
					}
					else if (head.indexOf('<!--') === 0) {
						head = buffer.toString(null, offset + 4);
						tail = head.indexOf('-->');
						if (tail >= 0)
							former = offset + 4 + tail + 3;
						else
							this.reportError('missing -->');
					}
					offset += 1;
					while (offset < former) {
						c = buffer[offset];
						switch (c) {
						case 10:
							this.line += 1;
							offset += 1;
							break;
						case 13:
							this.line += 1;
							offset += 1;
							c = buffer[offset];
							if (c === 10)
								offset += 1;
							break;
						default:
							offset += 1;
							break;
						}
					}
					break;
				default:
					offset += 1;
					break;

				}
			}
			this.stopText(offset);
		}

		popBlock() {
			if (this.currentBlock.container) {
				this.currentBlock = this.currentBlock.container;
			}
			else
				this.reportError('unexpected ]');
		}

		popVariable() {
			if (this.currentBlock.container) {
				this.currentBlock = this.currentBlock.container;
			}
			else
				this.reportError('unexpected ]]');
		}

		prepare(buffer) {
			var contents = this.contents, c = contents.length, i;
			for (i = 0; i < c; i += 1) {
				contents[i].prepare(buffer);
			}
		}

		pushBlock() {
			var block = new Block(this.currentBlock);
			this.currentBlock.contents.push(block);
			this.currentBlock = block;
		}

		pushVariable(start, stop) {
			var variable = new Variable(this.currentBlock, start, stop, this.path, this.line);
			this.currentBlock.contents.push(variable);
			this.currentBlock = variable;
		}

		reportError(message) {
			console.log(this.path + ':' + this.line + ': error:' + message);
		}

		startText(offset) {
			var text = new Text(this.currentBlock, offset);
			this.currentBlock.contents.push(text);
			this.currentText = text;
		}

		stopText(offset) {
			if (this.currentText.start < offset)
				this.currentText.stop = offset;
			else
				this.currentBlock.contents.pop();
			this.currentText = null;
		}

		print(stream) {
			var contents = this.contents, c = contents.length, i, tab = 0;

			function carriageReturn (stream, delta) {
				stream.write("\n");
				tab += delta;
				var c = tab;
				while (c > 0) {
					stream.write("\t");
					c--;
				}
			}
			carriageReturn(stream, 1);
			stream.write('function (handler, scope) {');
			//
			carriageReturn(stream, 1);
			stream.write('/*jshint -W085 */');


			stream.write('with (scope) {');
			carriageReturn(stream, 1);
			stream.write("try {");
			//
			carriageReturn(stream, 1);

			stream.write('var result = \'\';');
			for (i = 0; i < c; i += 1) {
				carriageReturn(stream, 0);
				contents[i].print(stream, carriageReturn);
			}
			carriageReturn(stream, 0);
			stream.write('return result;');
			carriageReturn(stream, -1);
			//

			stream.write('}');
			stream.write('catch (e) {');
			stream.write('throw e; }');
			carriageReturn(stream, -1);
			stream.write('}');
			stream.write('/*jshint +W085 */');
			carriageReturn(stream, -1);
			//
			stream.write('},');
			carriageReturn(stream, -1);
		}
	}

	exports.parse = function parse(buffer, path) {
		return new Parser(buffer, path);
	};
}
