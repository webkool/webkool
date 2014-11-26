var MySQL = Object.create(Object.prototype, {
	_connection: { value: null, writable: true,},
	_mysql: { value: null, writable: true,},
	_onDisconnect: { value:
		function () {
			var MySQL = this;
			this._connection.on('error', function (error) {
				if (!error.fatal) {
					return;
				}
				if (error.code !== 'PROTOCOL_CONNECTION_LOST') {
					throw error;
				}
				application.log('Re-connecting lost connection: ' + error.stack);

				MySQL._connection = MySQL._mysql.createConnection(this._connection.config);
				MySQL._onDisconnect();
				MySQL._connection.connect();
			});
		}
	},
	close: { value:
		function () {
			this._connection.end(function(err) {
			});
		}
	},
	connect: { value:
		function (host, user, database, password) {
			this._mysql = require('mysql');
			this._connection = this._mysql.createConnection({
				host: host,
				user: user,
				database: database,
				password: password,
				timezone: '+00:00'
			});
			this._onDisconnect();
			this._connection.connect();
		}
	},
	escape: { value:
		function (name) {
			return this._connection.escape(name);
		}
	},
});

var SQLHandler = function(parent, url, query) {
	Handler.call(this, parent, url, query);
};
SQLHandler.template = templateHandler;
SQLHandler.prototype = Object.create(Handler.prototype, {
	doPrepare: { value:
		function(data) {
			if (!data || !('statement' in data)) {
				throw new Error('SQLHandler "' + this.url + '" has no statement.');
			}
			if (!data.values) {
				data.values = [];
			}
		}
	},
	doResult: { value:
		function(result) {
			return result;
		}
	},
	doRequest: { value:
		function() {
			try {
				var handler = this, behavior = handler.behavior;
				if (behavior && 'on_construct' in behavior) {
					var data = behavior.on_construct(handler, handler.model, handler.query);
					handler.doPrepare(data);
					MySQL._connection.query(data.statement, data.values, function (error, result) {
						try {
							if (!error)
								handler.result = handler.doResult(result);
							else
								handler.doError(new Error('SQL "' + data.statement + '" ' + error));
							handler.synchronize();
						}
						catch (e) {
							application.reportError(handler, e);
						}
					});
				}
				else
					throw new Error('SQLHandler "' + handler.url + '" has no statement.');
			}
			catch (e) {
				application.reportError(handler, e);
			}
		}
	},
});

var SQLCountHandler = function(parent, url, query) {
	SQLHandler.call(this, parent, url, query);
};
SQLCountHandler.template = templateHandler;
SQLCountHandler.prototype = Object.create(SQLHandler.prototype, {
	doResult: { value:
		function(result) {
			if (result.length) {
				var row = result[0];
				for (var field in row) {
					return parseInt(row[field], 10);
				}
			}
		}
	},
});

var SQLDeleteHandler = function(parent, url, query) {
	SQLHandler.call(this, parent, url, query);
};
SQLDeleteHandler.template = templateHandler;
SQLDeleteHandler.prototype = Object.create(SQLHandler.prototype, {
	doPrepare: { value:
		function(data) {
			var property = [], values = [], query = this.query;
			if (!('table' in data)) {
				throw new Error('SQLDeleteHandler "' + this.url + '" has no table name.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push(column + " = ?");
					values.push(query[column]);
				}
			}
			if (property.length) {
				data.statement = "DELETE FROM " + data.table + " WHERE " + property.join(" AND ");
				data.values = values;
				if (query.extra) {
					data.statement += " " + query.extra;
				}
			}
			else if (query.all) {
				data.statement = "DELETE FROM " + data.table;
				data.values = [];
				if (query.extra) {
					data.statement += " " + query.extra;
				}
			}
			else {
				throw new Error('SQLDeleteHandler "' + this.url + '" has where clause.');
			}
		}
	},
});

var SQLFirstHandler = function(parent, url, query) {
	SQLHandler.call(this, parent, url, query);
};
SQLFirstHandler.template = templateHandler;
SQLFirstHandler.prototype = Object.create(SQLHandler.prototype, {
	doResult: { value:
		function(result) {
			if (result.length)
				return result[0];
		}
	},
});

var SQLInsertHandler = function(parent, url, query) {
	SQLHandler.call(this, parent, url, query);
};
SQLInsertHandler.template = templateHandler;
SQLInsertHandler.prototype = Object.create(SQLHandler.prototype, {
	doPrepare: { value:
		function(data) {
			var property = [], items = [], values = [], query = this.query;

			if (!('table' in data)) {
				throw new Error('SQLInsertHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLInsertHandler "' + this.url + '" has no columns.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push(column);
					items.push('?');
					values.push(query[column]);
				}
			}
			data.statement = "INSERT INTO " + data.table + " (" + property.join(", ") + ") VALUES (" + items.join(", ") + ")";
			data.values = values;
			if (query.extra) {
				data.statement += " " + query.extra;
			}
		}
	},
});

var SQLSelectHandler = function(parent, url, query) {
	SQLHandler.call(this, parent, url, query);
};
SQLSelectHandler.template = templateHandler;
SQLSelectHandler.prototype = Object.create(SQLHandler.prototype, {
	doPrepare: { value:
		function(data) {
			var property = [], values = [], query = this.query;

			if (!('table' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no columns.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push(column + " = ?");
					values.push(query[column]);
				}
			}
			if (property.length) {
				data.statement = "SELECT * FROM " + data.table + " WHERE " + property.join(" AND ");
				data.values = values;
			}
			else {
				data.statement = "SELECT * FROM " + data.table;
			}
			if (query.extra) {
				data.statement += " " + query.extra;
			}
		}
	},
});

var SQLSelectFirstHandler = function(parent, url, query) {
	SQLSelectHandler.call(this, parent, url, query);
};
SQLSelectFirstHandler.template = templateHandler;
SQLSelectFirstHandler.prototype = Object.create(SQLSelectHandler.prototype, {
	doResult: { value:
		function(result) {
			if (result.length)
			return result[0];
		}
	},
});

var SQLSelectCountHandler = function(parent, url, query) {
	SQLCountHandler.call(this, parent, url, query);
};
SQLSelectCountHandler.template = templateHandler;
SQLSelectCountHandler.prototype = Object.create(SQLCountHandler.prototype, {
	doPrepare: { value:
		function(data) {
			var property = [], values = [], query = this.query;

			if (!('table' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no columns.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push(column + " = ?");
					values.push(query[column]);
				}
			}
			if (property.length) {
				data.statement = "SELECT COUNT(*) FROM " + data.table + " WHERE " + property.join(" AND ");
				data.values = values;
			}
			else {
				data.statement = "SELECT COUNT(*) FROM " + data.table;
			}
			if (query.extra) {
				data.statement += " " + query.extra;
			}
		}
	},
});

var SQLUpdateHandler = function(parent, url, query) {
	SQLHandler.call(this, parent, url, query);
};
SQLUpdateHandler.template = templateHandler;
SQLUpdateHandler.prototype = Object.create(SQLHandler.prototype, {
	doPrepare: { value:
		function(data) {
			var property = [], values = [], query = this.query;

			if (!('table' in data)) {
				throw new Error('SQLUpdateHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLUpdateHandler "' + this.url + '" has no columns.');
			}
			if (!('id' in query)) {
				throw new Error('SQLUpdateHandler "' + this.url + '" has no id.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push(column + " = ?");
					values.push(query[column]);
				}
			}
			values.push(query.id);
			data.statement = "UPDATE " + data.table + " SET " + property.join(", ") + " WHERE id = ?";
			data.values = values;
			if (query.extra) {
				data.statement += " " + query.extra;
			}
		}
	},
});
