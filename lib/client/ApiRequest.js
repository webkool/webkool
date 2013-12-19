function spinningOn() {
}

function spinningOff() {
}

var ApiRequest;
(function (ApiRequest) {
    'use strict';

    function getXMLHttpRequest(handler, context, query) {
        var client;
        if (typeof XDomainRequest === "undefined") {
            client = new XMLHttpRequest();
            client.onreadystatechange = function () {
                try  {
                    if (this.readyState === this.DONE) {
                        if (this.status === 200) {
                            var result = JSON.parse(this.responseText);
                            handler.on_complete(context, context.model, query, result);
                        } else if (this.status === 0) {
                            throw new Error('Could not reach Server');
                        } else if (this.status) {
                            context.responseText = this.responseText;
                            throw new Error('Server error (' + this.status + ')');
                        }
                        spinningOff();
                        context.dequeue(handler);
                    }
                } catch (e) {
                    handler.on_error(context, context.model, query, e);
                }
            };
        } else {
            client = new XDomainRequest();
            client.setRequestHeader = function () {
                return;
            };
            client.onload = function () {
                try  {
                    spinningOff();
                    var result = JSON.parse(this.responseText);
                    handler.on_complete(context, context.model, query, result);
                } catch (e) {
                    handler.on_error(context, context.model, query, e);
                }
            };
            client.ontimeout = function () {
                try  {
                    spinningOff();
                    throw new Error('La connexion Internet semble interrompue.');
                } catch (e) {
                    handler.on_error(context, context.model, query, e);
                }
            };
        }
        return client;
    }

    function get(handler, context, query, url, httpQuery) {
        context.queue(handler, query);
        var client = getXMLHttpRequest(handler, context, query);
        client.open('GET', url + "?" + application.serializeQuery(httpQuery));
        client.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        client.send();
        spinningOn();
    }
    ApiRequest.get = get;

    function post(handler, context, query, url, httpQuery) {
        context.queue(handler, query);
        var client = getXMLHttpRequest(handler, context, query);
        client.open('POST', url);
        client.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        client.send(application.serializeQuery(httpQuery));
        spinningOn();
    }
    ApiRequest.post = post;
})(ApiRequest || (ApiRequest = {}));
