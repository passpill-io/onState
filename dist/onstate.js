/* onstate v0.2.0 (2018-3-5)
 * https://github.com/passpill-io/onState
 * By Javier Marquez - javi@arqex.com
 * License: MIT
 */
 (function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(['exports', 'onState'], factory);
	} else if (typeof exports === 'object') {
		module.exports = factory();
	} else {
		root.onState = factory();
	}
}(this, function () {
	'use strict';
	const dontPropagate = new Set(['_reState', 'state']);

function isOs( data ){
  return data && typeof data._delParent === 'function';
}

var methods = {
  on: function (event, clbk) {
    if (!this.__.listeners[event]) {
      this.__.listeners[event] = [clbk];
    }
    else {
      this.__.listeners[event].push(clbk);
    }
  },
  emit: function (event) {
    var args = [this.__].concat( Array.from(arguments) );
    trigger.apply(this, args);

    // Don't propagate reState
    if (dontPropagate.has(event)) return;

    this.__.parents.forEach(p => {
      p.emit.apply(p, args)
    });
  },
  _addParent: function (p) {
    this.__.parents.push(p);
  },
  _delParent: function (p) {
    var idx = this.__.parents.indexOf(p);
    if (idx !== -1) {
      this.__.parents.splice(idx, 1);
    }
  }
}

function trigger(__, event){
  if( !__.listeners[event] ) return;

  var rest = Array.from(arguments).slice(2);
  __.listeners[event].forEach(clbk => {
    clbk.apply(null, rest);
  });
}

function enqueueState(__) {
  if (!__.timer) {
    __.timer = setTimeout(() => {
      trigger( __, '_reState' );
    });
  }
}

function onReState(parent, prevChild, nextChild) {
  if( prevChild ){
    for (var key in parent) {
      if (parent[key] === prevChild) {
        Reflect.set(parent, key, nextChild);
        break;
      }
    }
  }
  
  var next = createNode(parent),
    __ = parent.__
  ;

  parent.emit('state', next);

  // We are flushing the changes, so clear 
  //the timer if it was enqueued
  clearTimeout(__.timer);
  __.timer = false;

  __.parents.forEach(p => {
    trigger( p, '_reState', parent, next );
  });
}

var proxyHandlers = {
  set: function (obj, prop, value) {
    var isObject = value instanceof Object,
      child = isObject ? onState(value) : value,
      oldValue = obj[prop]
    ;

    if (oldValue && oldValue._delParent) {
      oldValue._delParent(this.__);
    }

    if (isObject) {
      child._addParent(this.__);
    }

    Reflect.set(obj, prop, child);
    enqueueState(this.__);
    return true;
  },
  deleteProperty: function (obj, prop) {
    var oldValue = obj[prop];

    if (oldValue && oldValue._delParent) {
      oldValue._delParent(this.__);
    }

    Reflect.deleteProperty(obj, prop);
    enqueueState( this.__ );
    return true;
  },
  get: function (obj, prop) {
    if (prop === '__') {
      return this.__;
    }
    if (methods[prop]) {
      return methods[prop];
    }
    if (obj[prop] || obj.hasOwnProperty(prop)) {
      return obj[prop];
    }

    return Reflect.get(obj, prop);
  }
};


function createNode(data) {
  var base = data.splice ? [] : {},
    __ = {parents: [], listeners: {}, timer: true}, // timer true to not enqueue first changes
    handlers = Object.assign({__:__},proxyHandlers)
  ;

  var os = new Proxy(base, handlers);

  var key;
  for (key in data) {
    os[key] = data[key];
  }

  os.on('_reState', function( prevChild, nextChild ){
    onReState(os, prevChild, nextChild);
  });

  // Start enqueuing changes
  __.timer = false;

  return os;
}

function onState( data ){
  // if already is a oS we don't need to
  // transform it
  if (isOs(data)) {
    return data;
  }

  return createNode( data );
}


	return onState;
}));