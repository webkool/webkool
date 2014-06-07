module MySQL {
	'use strict';
	declare var require;
	declare var application;
	var connection;
	var MYSQL;

	export function connect(host, user, database, password) {
		MYSQL = require('mysql');
		connection = MYSQL.createConnection({host: host, user: user, database: database, password: password, timezone: '+00:00'});
		handleDisconnect();
		connection.connect();
	}

	export function handleDisconnect() {
	  connection.on('error', function(err) {
		if (!err.fatal) {
		  return;
		}
		if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
		  throw err;
		}
		application.log('Re-connecting lost connection: ' + err.stack);

		connection = MYSQL.createConnection(connection.config);
		handleDisconnect();
		connection.connect();
	  });
	}

	export function count(handler, context, query, statement, data) {
		context.queue(handler, query);
		connection.query(statement, data,
			function(error, result) {
				try {
					var field, row;
					if (!error) {
						if (result.length) {
							row = result[0];
							for (field in row) {
								handler.on_complete(context, context.model, query, parseInt((result[0])[field], 10));
								break;
							}
						}
						else
							handler.on_complete(context, context.model, query, 0);
					}
					else {
						throw new Error('SQL "' + statement + '" ' + error);
					}
					context.dequeue(handler);
				}
				catch (e) {
					handler.on_error(context, context.model, query, e);
				}
			});
	}

	export function deleteFrom(handler, context, query, statement, data) {
		context.queue(handler, query);
		connection.query(statement, data,
			function(error, result) {
				try {
					if (!error) {
						handler.on_complete(context, context.model, query, handler.on_sqlResult(context, context.model, query, result));
					}
					else {
						throw new Error('SQL "' + statement + '" ' + error);
					}
					context.dequeue(handler);
				}
				catch (e) {
					handler.on_error(context, context.model, query, e);
				}
			});
	}

	export function escape(name) {
		return connection.escape(name);
	}

	export function find(handler, context, query, statement, data) {
		context.queue(handler, query);
		connection.query(statement, data,
			function(error, result) {
				try {
					if (!error) {
						handler.on_complete(context, context.model, query, handler.on_sqlResult(context, context.model, query, result));
					}
					else {
						throw new Error('SQL "' + statement + '" ' + error);
					}
					context.dequeue(handler);
				}
				catch (e) {
					handler.on_error(context, context.model, query, e);
				}
			});
	}

	export function findFirst(handler, context, query, statement, data) {
		context.queue(handler, query);
		connection.query(statement, data,
			function(error, result) {
				try {
					if (!error) {
						if (result.length>0)
							handler.on_complete(context, context.model, query, handler.on_sqlResult(context, context.model, query, result[0]));
						else
							handler.on_complete(context, context.model, query, handler.on_sqlResult(context, context.model, query));
					}
					else {
						throw new Error('SQL "' + statement + '" ' + error);
					}
					context.dequeue(handler);
				}
				catch (e) {
					handler.on_error(context, context.model, query, e);
				}
			});
	}

	export function insert(handler, context, query, statement, data) {
		context.queue(handler, query);
		connection.query(statement, data,
			function(error, result) {
				try {
					if (!error) {
						handler.on_complete(context, context.model, query, handler.on_sqlResult(context, context.model, query, result));
					}
					else {
						throw new Error('SQL "' + statement + '" ' + error);
					}
					context.dequeue(handler);
				}
				catch (e) {
					handler.on_error(context, context.model, query, e);
				}
			});
	}

	export function update(handler, context, query, statement, data) {
		context.queue(handler, query);
		connection.query(statement, data,
			function(error, result) {
				try {
					if (!error) {
						handler.on_complete(context, context.model, query, handler.on_sqlResult(context, context.model, query, result));
					}
					else {
						throw new Error('SQL "' + statement + '" ' + error);
					}
					context.dequeue(handler);
				}
				catch (e) {
					handler.on_error(context, context.model, query, e);
				}
			});
	}
}
