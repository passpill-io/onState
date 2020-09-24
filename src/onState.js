// ----------
// State queues
// ----------
var queue = [];

function flushTimers() {
  let t;
  while( t = queue.shift() ){
    t();
  }
}

var activateQueue = require('./activateQueue')(flushTimers);

var waitFor = function( clbk ){
  queue.push(clbk);
  activateQueue();
  return 1;
};

///////////
// On state
///////////
let instanceCounter = 0;
let rebuiltNodes = new WeakMap();

function onState(data, options) {
  rebuiltNodes = new WeakMap();
  let root = enhanceNode( data );
  root.__.rootName = (options || {}).name || ('os' + (++instanceCounter));
  return root;
}

function enhanceNode( data ){
  if( isLeaf( data ) ){
    return data;
  }
  else if( !isOs( data ) ){
    return createOsNode( data );
  }
  else if( data.__.nextState ){
    return settleNextState( data.__.nextState );
  }
  return data;
}

function createOsNode( data ){
  let __ = {
    parents: new Set(),
    clbks: isOs(data) ? data.__.clbks.slice() : [],
    timer: false,
    init: true // init true to not enqueue first changes
  };
  let handlers = Object.assign( {__: __}, proxyHandlers );
  let os = new Proxy( data.splice ? [] : {}, handlers );

  let data__ = data && data.__;
  iterateKeys( data, function( key ){
    let nextNode = enhanceNode( data[key] );
    if( nextNode !== data[key] ){
      nextNode.__.parents.add(__);
      data__ && nextNode.__.parents.delete(data__);
      nextNode.emitChange(nextNode);
    }
    os[key] = nextNode;
  });

  // From now we won't allow adding os nodes 
  // and start emitting events
  delete __.init;

  __.setDirty = function(node) {
    if( !__.parents.size && !__.rootName ){
      return onState.warn("Changing a detached node. It won't emit `state` events.");
    }

    if( node ){
      refreshNode( os, node );
    }

    addToParentDirtyNodes( os );
  };
  
  __.getAscendancy = function( ascendancy ){
    ascendancy.add( os );

    __.parents.forEach( parent => {
      parent.getAscendancy( ascendancy );
    });

    return ascendancy;
  }

  return os;
}

function addToParentDirtyNodes( node ){
  if( isRoot(node) ){
    enqueueRootChange(node);
  }
  else {
    node.__.parents.forEach( function(parent) {
      parent.setDirty(node);
    });
  }
}

function enqueueRootChange( node ){
  if( !node.__.timer ){
    node.__.timer = waitFor( () => {
      delete node.__.timer;
      updateRoot(node);
      node.emitChange(node);
    });
  }
}

function updateRoot(root){
  root.__.rebuilding = 1;

  let nextState = root.__.nextState;
  delete root.__.nextState;
  for (let key in root) {
    if( nextState[key] === undefined ){
      delete root[key];
    }
  }
  for (let key in nextState) {
    let nextNode = enhanceNode( nextState[key] );
    if( nextNode !== root[key] && isOs(nextNode) ){
      nextNode.__.parents.add(root.__);
      nextNode.__.parents.delete(root.__);
      if( isOs(root[key]) ){
        nextNode.__.clbks = root[key].__.clbks.slice();
      }
      nextNode.emitChange(nextNode);
    }
    root[key] = nextNode;
  }
  
  delete root.__.rebuilding;
  rebuiltNodes = new WeakMap();
}

function refreshNode( parent, node ){
  let nextNode = rebuiltNodes.get( node );
  if( !nextNode ) {
    nextNode = createOsNode( clone(node) );
    rebuiltNodes.set( node, nextNode );
  }

  let nextState;
  if( parent.__.nextState ){
    nextState = parent.__.nextState;
    iterateKeys( nextState, function( key ){
      // When there was a nextState we only update the target nodes
      if( nextState[key] === node ){
        nextState[key] = nextNode;
        nextNode.__.clbks = node.__clbks.slice();
      }
    });
  }
  else {
    nextState = parent.splice ? [] : {};
    iterateKeys( parent, function( key ){
      // When there wasn't a nextState, we create it by
      // cloning the parent but changing the target node
      nextState[key] = parent[key] === node ? nextNode : parent[key];
    });
  }
  
  parent.__.nextState = nextState;
}

function assertNoLoops( parents, node ){
  if( isLeaf(node) ){
    return;
  }

  // Check if the parent is already added
  if( parents.has(node) ){
    err('Trying to add a node that is already added. Loops are not allowed in onState');
  }
  
  iterateKeys( node, function(key) {
    assertNoLoops( parents, node[key]);
  });
}

function settleNextState( prevNode ){
  let nextNode = rebuiltNodes.get( prevNode );
  if( nextNode ) return nextNode;

  // We are removing the nextState from the node
  let nextState = prevNode.__.nextState;
  delete prevNode.__.nextState;
  nextNode = createOsNode( nextState );
  rebuiltNodes.set( prevNode, nextNode);
  return nextNode;
}

////////
// Proxy handlers
///////
var proxyHandlers = {
  set: function (obj, prop, value) {
    if( typeof value === 'function' ){
      onState.warn('Adding functions to a oS is not allowed. They will be omitted.');
      return true;
    }

    if( this.__.rebuilding || this.__.init ){
      obj[prop] = value;
      return true;
    }

    if( !isLeaf(value) ){
      assertNoLoops( this.__.getAscendancy( new Set() ), value );
    }
    
    let nextState = this.__.nextState;
    let nextValue = enhanceNode( value );
    if( !nextState ){
      nextState = clone( obj );
      nextState[prop] = nextValue;
      this.__.nextState = nextState;
    }
    else {
      nextState[prop] = nextValue;
    }
    
    this.__.setDirty();
    return true;
  },
  deleteProperty: function (obj, prop) {
    if (this.__.rebuilding) {
      delete obj[prop];
      return true;
    }
    
    let nextState = this.__.nextState;
    if( nextState ){
      delete nextState[prop];
    }
    else {
      nextState = {};
      for( let key in obj ){
        if( prop !== key ){
          nextState[key] = obj[key];
        }
      }
      this.__.nextState = nextState;
    }

    this.__.setDirty();
    return true;
  },
  get: function (obj, prop) {
    if (prop === '__') {
      return this.__;
    }
    
    let target = this.__.nextState || obj;
    if (target.splice && Array.prototype[prop]) {
      return Array.prototype[prop].bind(target);
    }
    if (nodeMethods[prop]) {
      return nodeMethods[prop];
    }
    if (target[prop] || target.hasOwnProperty(prop)) {
      return target[prop];
    }

    return Reflect.get(target, prop);
  },
  ownKeys: function (obj){
    return Reflect.ownKeys( this.__.nextState || obj );
  },
  getOwnPropertyDescriptor: function( obj, key ){
    return Object.getOwnPropertyDescriptor( this.__.nextState || obj, key );
  }
};



///////////
// Extra methods for nodes
///////////
const nodeMethods = {
  addChangeListener: function(clbk) {
    if (typeof clbk !== 'function') {
      return warn("The listener is not a function.")
    }
    this.__.clbks.push( clbk );
  },
  removeChangeListener: function(clbk) {
    let clbks = this.__.clbks;
    let idx = clbks.length;
    let removed = false;

    while( idx-- > 0 ){
      if( clbk === clbks[idx] ){
        clbks.splice( idx, 1 );
        removed = true;
      }
    }

    if( !removed ){
      warn("Couldn't find the listener to remove.");
    }
  },
  emitChange: function ( state ) {
    this.__.clbks.forEach( clbk => {
      clbk( state );
    });
  },
  flatten: function() {
    return JSON.parse( JSON.stringify(this) );
  }
}


////////////
// HELPERS
////////////
function isOs(data) {
  return data && data.__;
}

function isLeaf(data){
  return !(data instanceof Object);
}

function isRoot(data){
  return data && data.__ && data.__.rootName;
}

function clone( node ){
  if (node.slice) return node.slice();

  let c = {};
  for (let key in node) {
    c[key] = node[key];
  }
  return c;
}

function iterateKeys( obj, clbk ){
  if(obj.splice){
    obj.forEach( (it, key) => clbk(key) );
  }
  for( let key in obj ){
    clbk(key);
  }
}

function err(msg) {
  throw new Error('onState ERROR: ' + msg);
}

onState.warn = function(msg) {
  console.warn('onState WARNING: ' + msg);
}

/* EXPORT - Do not remove or modify this comment */
module.exports = onState;