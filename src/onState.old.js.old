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

function addToParentDirtyNodes( node ) {
  if( isRoot(node) ){
    if( !node.__.timer ){
      node.__.timer = waitFor( () => {
        delete node.__.timer;
        updateRoot(node);
        node.emitChange(node);
      });
    }
  }
  else {
    node.__.parents.forEach( parent => {
      let dirtyNodes = parent.dirtyNodes || new Set();
      dirtyNodes.add(node);
      parent.dirtyNodes = dirtyNodes;
      parent.setDirty();
    });
  }
}


////////
// Proxy handlers
///////
var proxyHandlers = {
  set: function (obj, prop, value) {
    if( !this.__.init && !this.__.rebuilding && !isLeaf(value) ){
      assertNoLoops( this.__.getAscendancy( new Set() ), value );
    }

    if(this.__.rebuilding){
      obj[prop] = value;
      return true;
    }

    if( typeof value === 'function' ){
      warn('Adding functions to a oS is not allowed. They will be omitted.');
      return true;
    }

    let nodeToAdd = value;
    if( !isLeaf(value) && !isOs(value) ){
      nodeToAdd = onState(value);
    }

    if( this.__.init ){
      // don't emit events
      obj[prop] = nodeToAdd;
    }
    else {
      var nextState = this.__.nextState;
      if (!nextState) {
        nextState = this.__.nextState = clone(obj);
      }
      if( !isLeaf(value) ){
        nodeToAdd.__.parents.add(this.__);
      }
      nextState[prop] = nodeToAdd;
      this.__.setDirty();
    }
    return true;
  },
  deleteProperty: function (obj, prop) {
    if (this.__.rebuilding) {
      delete obj[prop];
      return true;
    }

    var nextState = this.__.nextState;
    if(!nextState){
      nextState = this.__.nextState = clone(obj);
    }
    delete nextState[prop];
    this.__.setDirty();
    return true;
  },
  get: function (obj, prop) {
    if (prop === '__') {
      return this.__;
    }
    
    let target = this.__.nextState || obj;
    if (target.splice && Array.prototype[prop]) {
      if (prop === 'splice') {
        // Intermediate steps of splice need to add the same
        // node twice to the array, mark it as splicing to not to
        // throw errors
        this.__.splicing = true;
      }
      if(this.__.nextState)
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
// Node creation
///////////

function getNextNode( __, baseNode ){
  if( isLeaf(baseNode) ){
    return baseNode;
  }
  if( isOs(baseNode) && (!__ || !__.dirtyNodes || !__.dirtyNodes.has(baseNode)) ){
    return baseNode;
  }

  let nextNode = rebuiltNodes.get(baseNode);
  if( nextNode ) {
    return nextNode;
  }

  nextNode = createNode( baseNode );
  if( baseNode.__ ) {
    delete baseNode.__.splicing;
    baseNode.__.parents.delete(__);
    baseNode.__.detached = true;
  }
  nextNode.__.parents.add(__);

  rebuiltNodes.set(baseNode, nextNode);
  
  return nextNode;
}

function checkNodeRebuild( __, prevNode ){
  let nextNode = getNextNode( __, prevNode );

  if( prevNode !== nextNode && nextNode && nextNode.emitChange ){
    // We have rebuilt the node, trigger a change
    nextNode.emitChange(nextNode);
  }

  return nextNode;
}

let rebuiltNodes = new WeakMap();
function updateRoot(root){
  root.__.rebuilding = 1;

  if( root.__.nextState ){
    let nextState = root.__.nextState;
    delete root.__.nextState;
    for (key in root) {
      delete root[key];
    }
    for (key in nextState) {
      root[key] = checkNodeRebuild(root.__, nextState[key]);
    }
  }
  else {
    for (key in root) {
      root[key] = checkNodeRebuild(root.__, root[key]);
    }
  }

  delete root.__.rebuilding;
  rebuiltNodes = new WeakMap();
}

function createNode( source ){
  let __ = {
    parents: new Set(),
    clbks: isOs(source) ? source.__.clbks.slice() : [],
    timer: false,
    init: true // init true to not enqueue first changes
  };

  let handlers = Object.assign( {__: __}, proxyHandlers );
  let os = new Proxy( source.splice ? [] : {}, handlers );

  let attributes = isOs(source) && source.__.nextState ?
    source.__.nextState :
    source
  ;

  let source__ = source && source.__;
  iterateKeys( attributes, key => {
    let nextNode = checkNodeRebuild( source.__, attributes[key] );
    if( isOs(nextNode) ){
      nextNode.__.parents.add(__);
      nextNode.__.parents.delete(source__);
    }
    os[key] = nextNode;
  });

  if( isOs(source) ){
    delete source.__.nextState;
  }

  // From now we won't allow adding os nodes 
  // and start emitting events
  delete __.init;
  __.setDirty = function() {
    if( __.detached ){
      warn("Changing a detached node. It won't emit `state` events.");
    }
    else {
      addToParentDirtyNodes( os );
    }
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

function onState(data) {
  return createNode(data);
}

///////////
// Node extra methods
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
  return !data || !data.__ || data.__.parents.size === 0;
}

function err(msg) {
  throw new Error('onState ERROR: ' + msg);
}

function warn(msg) {
  console.warn('onState WARNING: ' + msg);
}

function clone(obj) {
  if (obj.slice) return obj.slice();

  let c = {};
  for (let key in obj) {
    c[key] = obj[key];
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

/* EXPORT - Do not remove or modify this comment */
module.exports = onState;