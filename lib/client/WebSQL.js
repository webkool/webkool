var MySQL = Object.create(Object.prototype, {
	_connection: { value: null, writable: true,},
	connect: { value:
		function (database, version, name, size) {
			try {
				this._connection = openDatabase(database, version, name, size);
			}
			catch (e) {

			}
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
			var result = {statement: data.statement, values: data.values};
			if (!data || !('statement' in data)) {
				throw new Error('SQLHandler "' + this.url + '" has no statement.');
			}
			if (!data.values) {
				result.values = [];
			}
			return result;
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
					var data = handler.doPrepare(behavior.on_construct(handler, handler.model, handler.query));
					MySQL._connection.transaction(function (tx) {
						tx.executeSql(data.statement, data.values,
							function (transaction, result) {
								try {
									var rows = [];
									for(var i = 0; i < result.rows.length; i++) {
										rows[i] = result.rows.item(i);
									}
									handler.result = handler.doResult(rows);
									handler.synchronize();
								}
								catch (e) {
									application.reportError(handler, e);
								}
							},
							function (transaction, error) {
								try {
									handler.doError(new Error('WebSQL "' + data.statement + '" ' + error.message));
									handler.synchronize();
								}
								catch (e) {
									application.reportError(handler, e);
								}
							}
						);
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
			var property = [], values = [], query = this.query, result = {};
			if (!('table' in data)) {
				throw new Error('SQLDeleteHandler "' + this.url + '" has no table name.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push("`" + column + "` = ?");
					values.push(query[column]);
				}
			}
			if (property.length) {
				result.statement = "DELETE FROM " + data.table + " WHERE " + property.join(" AND ");
				result.values = values;
				if (query.extra) {
					result.statement += " " + query.extra;
				}
			}
			else if (query.all) {
				result.statement = "DELETE FROM " + data.table;
				result.values = undefined;
				if (query.extra) {
					result.statement += " " + query.extra;
				}
			}
			else {
				throw new Error('SQLDeleteHandler "' + this.url + '" has where clause.');
			}
			return result;
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
			var property = [], items = [], values = [], query = this.query, result = {};

			if (!('table' in data)) {
				throw new Error('SQLInsertHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLInsertHandler "' + this.url + '" has no columns.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push("`" + column + "`");
					items.push('?');
					values.push(query[column]);
				}
			}
			result.statement = "INSERT INTO " + data.table + " (" + property.join(", ") + ") VALUES (" + items.join(", ") + ")";
			result.values = values;
			if (query.extra) {
				result.statement += " " + query.extra;
			}
			return result;
		}
	},
	doResult: { value:
		function(result) {
			return result.insertId;
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
			var property = [], values = [], query = this.query, result = {};

			if (!('table' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no columns.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push("`" + column + "` = ?");
					values.push(query[column]);
				}
			}
			if (property.length) {
				result.statement = "SELECT * FROM " + data.table + " WHERE " + property.join(" AND ");
				result.values = values;
			}
			else {
				result.statement = "SELECT * FROM " + data.table;
			}
			if (query.extra) {
				result.statement += " " + query.extra;
			}
			return result;
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
			var property = [], values = [], query = this.query, result = {};

			if (!('table' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no table name.');
			}
			if (!('columns' in data)) {
				throw new Error('SQLSelectHandler "' + this.url + '" has no columns.');
			}
			for (var i = 0; i < data.columns.length; i++) {
				var column = data.columns[i];
				if (query.hasOwnProperty(column)) {
					property.push("`" + column + "` = ?");
					values.push(query[column]);
				}
			}
			if (property.length) {
				result.statement = "SELECT COUNT(*) FROM " + data.table + " WHERE " + property.join(" AND ");
				result.values = values;
			}
			else {
				result.statement = "SELECT COUNT(*) FROM " + data.table;
			}
			if (query.extra) {
				result.statement += " " + query.extra;
			}
			return result;
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
			var property = [], values = [], query = this.query, result = {};

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
				if (column != 'id' && query.hasOwnProperty(column)) {
					property.push("`" + column + "` = ?");
					values.push(query[column]);
				}
			}
			values.push(query.id);
			result.statement = "UPDATE " + data.table + " SET " + property.join(", ") + " WHERE id = ?";
			result.values = values;
			if (query.extra) {
				result.statement += " " + query.extra;
			}
			return result;
		}
	},
});
