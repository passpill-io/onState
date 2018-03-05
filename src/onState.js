const dontPropagate = new Set(['_reState', 'state']);

function isOs(data) {
  return data && data.__;
}

function err(msg) {
  throw new Error(msg);
}

function warn(msg) {
  console.warn('onState WARNING: ' + msg);
}

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
    trigger.apply(null, [this.__].concat( args ) );

    // Don't propagate some events
    if (dontPropagate.has(event)) return;

    var p = this.__.parent;
    while( p ){
      trigger.apply(null, [p].concat(args));
      p = p.parent;
    }
  }
}

function trigger(__, event) {
  if (!__.clbks[event]) return;

  var rest = Array.from(arguments).slice(2);
  __.clbks[event].forEach(clbk => {
    clbk.apply(null, rest);
  });
}

function enqueueState(__) {
  if (!__.timer) {
    __.timer = setTimeout(() => {
      trigger(__, '_reState');
    });
  }
}

function onReState(node, prevChild, nextChild) {
  if (prevChild) {
    for (var key in node) {
      if (node[key] === prevChild) {
        Reflect.set(node, key, nextChild);
        break;
      }
    }
  }

  var next = createNode(node),
    __ = node.__
  ;

  node.emit('state', next);

  // We are flushing the changes, so clear 
  // the timer if it was enqueued
  clearTimeout(__.timer);
  __.timer = false;

  if (__.parent) {
    trigger(__.parent, '_reState', node, next);
  }
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
      child = isObject ? onState(value) : value,
      oldValue = obj[prop]
      ;

    if (oldValue && oldValue.__) {
      oldValue.__.parent = false;
    }

    if (isObject) {
      child.__.parent = this.__;
    }

    Reflect.set(obj, prop, child);
    if (!this.__.init) {
      enqueueState(this.__);
    }
    return true;
  },
  deleteProperty: function (obj, prop) {
    var oldValue = obj[prop];

    if (oldValue && oldValue.__) {
      oldValue.__.parent = false;
    }

    Reflect.deleteProperty(obj, prop);
    enqueueState(this.__);
    return true;
  },
  get: function (obj, prop) {

    if (obj.splice && prop === 'splice') {
      // Intermediate steps of splice needs to add the same
      // node twice to the array, mark it as splicing
      this.__.splicing = true;
      setTimeout(() => delete this.__.splicing);
    }
    
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
    __ = { parent: false, clbks: {}, timer: false, init: true }, // timer true to not enqueue first changes
    handlers = Object.assign({ __: __ }, proxyHandlers)
    ;

  var os = new Proxy(base, handlers);

  var key;
  for (key in data) {
    os[key] = data[key];
  }

  // Now we won't allow setting nodes and start emitting events
  delete __.init;

  os.on('_reState', function (prevChild, nextChild) {
    onReState(os, prevChild, nextChild);
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

/* EXPORT - Do not remove or modify this comment */
module.exports = onState;