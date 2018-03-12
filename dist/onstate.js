/* onstate v0.5.0 (2018-3-12)
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
	

const dontPropagate = new Set(['_mark', 'state']);

function isOs(data) {
  return data && data.__;
}

function err(msg) {
  throw new Error(msg);
}

function warn(msg) {
  console.warn('onState WARNING: ' + msg);
}

function clone(obj){
  if( obj.slice ) return obj.slice();
  var c = {};
  for(var key in obj ){
    c[key] = obj[key];
  }
  return c;
}

// ----------
// State queues
// ----------
var queue = [];

function flushTimers() {
  var t;
  while( t = queue.shift() ){
    t();
  }
}


var activateQueue;
if (typeof window !== 'undefined') {
	let o = window.origin;
	if (!o || o === 'null') o = '*';

	window.addEventListener('message', function (e) {
		e.data === 'now' && flushTimers();
	});
	activateQueue = window.postMessage.bind(window, 'now', o);
}
else {
	activateQueue = function () {
		process.nextTick(flushTimers);
	}
}


var waitFor = function( clbk ){
  queue.push(clbk);
  activateQueue();
  return 1;
};

var methods = {
  on: function (event, clbk) {
    if( !event ){
      return warn("Can't add listener for a falsy event.");
    }
    else if(typeof clbk !== 'function') {
      return warn("No listener provided for the event '" + event + "'.")
    }

    if (!this.__.clbks[event]) {
      this.__.clbks[event] = [clbk];
    }
    else {
      this.__.clbks[event].push(clbk);
    }
  },
  off: function( event, clbk ){
    var clbks = this.__.clbks[event],
      msg = "Couldn't find the listener to remove from the event '" + event + "'."
    ;

    if( !clbks ) return warn(msg);
    
    var idx = clbks.indexOf( clbk );
    if( idx !== -1 ){
      clbks.splice(idx, 1);
    }
    else {
      warn(msg);
    }
  },
  emit: function (event) {
    var args = Array.from( arguments );
    var result = trigger.apply(null, [this.__].concat( args ) );

    // Don't propagate some events
    if (dontPropagate.has(event)) return result;

    var p = this.__.parent;
    while( p ){
      trigger.apply(null, [p].concat(args));
      p = p.parent;
    }

    return result;
  }
}

function trigger(__, event) {
  if (!__.clbks[event]) {
    if( event === '_mark' ){
      warn("Changing a detached node. It won't emit `state` events.");
    }
    return;
  }

  var rest = Array.from(arguments).slice(2),
    result, returned
  ;
  __.clbks[event].forEach(clbk => {
    returned = clbk.apply(null, rest);
    if( returned !== undefined ){
      result = returned;
    }
  });
  
  return result;
}

function onMark(node){
  var parent = node.__.parent;
  if( parent ){
    var marked = parent.marked || new Set();
    marked.add(node);
    parent.marked = marked;

    trigger(parent, '_mark');
  }
  else if( !node.__.timer ){
    node.__.timer = waitFor( () => {
      node.__.update = rebuild(node);
    });
  }
}

function rebuild(node){
  var rebuilt = createNode(node);
  delete node.__.splicing;
  delete node.__.clbks._mark;
  node.emit('state', rebuilt);
  return rebuilt;
}

var proxyHandlers = {
  set: function (obj, prop, value) {
    if (!this.__.init && value && value.__ && value.__.parent && !this.__.splicing ) {
      err("Can't add an oS node to another oS object.");
    }

    if (value && !value.__ && (value.on || value.emit)) {
      warn('Adding an object with `on` or `emit` attributes. They will be overriden.');
    }

    var isObject = value instanceof Object,
      child = isObject ? onState(value) : value
    ;

    if( isObject ){
      child.__.parent = this.__;
    }

    if( this.__.init ){
      obj[prop] = child;
    }
    else {
      var update = this.__.update;
      if (!update) {
        update = this.__.update = clone(obj);
      }
      update[prop] = child;
      trigger( this.__, '_mark' );
    }
    return true;
  },
  deleteProperty: function (obj, prop) {
    var update = this.__.update;
    if(!update){
      update = this.__.update = clone(obj);
    }
    delete update[prop];
    trigger(this.__, '_mark');
    return true;
  },
  get: function (obj, prop) {
    var target = this.__.update || obj;
    if (target.splice && prop === 'splice') {
      // Intermediate steps of splice needs to add the same
      // node twice to the array, mark it as splicing
      this.__.splicing = true;
    }
    
    if (prop === '__') {
      return this.__;
    }
    if (methods[prop]) {
      return methods[prop];
    }
    if (target[prop] || target.hasOwnProperty(prop)) {
      return target[prop];
    }

    return Reflect.get(target, prop);
  }
};

function createNode(data, isRebuild) {
  var base = data.splice ? [] : {},
    __ = { parent: false, clbks: {}, timer: false, init: true }, // timer true to not enqueue first changes
    handlers = Object.assign({ __: __ }, proxyHandlers)
  ;

  var target = data,
    marked, data__
  ;
  
  if (data && (data__ = data.__) && data__.clbks ){
    marked = data__.marked;
    target = data__.update || data;
    if (data__.parent) {
      delete data__.update;
    }
    for( key in data__.clbks ){
      if( key !== '_mark' ){
        __.clbks[key] = data__.clbks[key];
      }
    }
  }

  var os = new Proxy(base, handlers),
    getNextNode, key
  ;
  if( marked ){
    getNextNode = function( node ){
      return marked.has(node) ? rebuild(node) : node;
    }
  }
  else {
    getNextNode = function( node ){ return node; }
  }

  for (key in target) {
    os[key] = getNextNode( target[key] );
  }

  // From now we won't allow adding os nodes 
  // and start emitting events
  delete __.init;
  os.on('_mark', function(){
    onMark(os);
  });
  return os;
}

function onState(data) {
  // if already is a oS we don't need to transform it
  if (isOs(data)) {
    return data;
  }

  return createNode(data);
}


	return onState;
}));