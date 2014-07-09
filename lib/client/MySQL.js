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
          var values, data = behavior.on_construct(handler, handler.model, handler.query);
          if (!('statement' in data))
            throw new Error('SQLHandler "' + handler.url + '" has no statement.');

          if (data.values)
            values = data.values;

          MySQL._connection.query(data.statement, values, function (error, result) {
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
