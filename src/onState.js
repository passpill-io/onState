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

function addToParentDirtyNodes(node){
  var parent = node.__.parent;

  if( parent ){
    var dirtyNodes = parent.dirtyNodes || new Set();
    dirtyNodes.add(node);
    parent.dirtyNodes = dirtyNodes;
    parent.setDirty();
  }
  else if( !node.__.timer ){
    // We have no parents we are the root
    // enqueue the state update
    node.__.timer = waitFor( () => {
      delete node.__.timer;
      updateRoot(node);
      node.emitChange(node);
    });
  }
}


////////
// Proxy handlers
///////
var proxyHandlers = {
  set: function (obj, prop, value) {
    

    if(this.__.rebuild){
      
      obj[prop] = value;
      return true;
    }

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
      // 
      obj[prop] = child;
    }
    else {
      

      var nextState = this.__.nextState;
      if (!nextState) {
        nextState = this.__.nextState = clone(obj);
      }
      nextState[prop] = child;
      this.__.setDirty();
    }
    return true;
  },
  deleteProperty: function (obj, prop) {
    if (this.__.rebuild) {
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
    
    if (eventMethods[prop]) {
      return eventMethods[prop];
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

function getNextNode( __, prevNode ){
  if (!__ || !__.dirtyNodes || !__.dirtyNodes.has(prevNode) ){
    return prevNode;
  }

  let nextNode = createNode( prevNode );

  delete prevNode.__.splicing;
  prevNode.__.detached = true;
  nextNode.__.parent = __;

  return nextNode;
}

function checkNodeRebuild( __, prevNode ){
  let nextNode = getNextNode( __, prevNode );

  if( prevNode !== nextNode && nextNode && nextNode.emitChange ){
    
    // We have rebuilt the node, trigger a change
    nextNode.emitChange(nextNode);
  }
  else {
    // 
  }

  return nextNode;
}

function updateRoot(root){
  root.__.rebuild = 1;

  

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

  delete root.__.rebuild;
}

function createNode( source ){
  let wasOS = source && source.__;
  let __ = {
    parent: false,
    clbks: wasOS ? source.__.clbks.slice() : [],
    timer: false,
    init: true // init true to not enqueue first changes
  };

  let handlers = Object.assign( {__: __}, proxyHandlers );
  let os = new Proxy( source.splice ? [] : {}, handlers );

  let attributes = wasOS && source.__.nextState ?
    source.__.nextState :
    source
  ;

  for( let key in attributes ){
    os[key] = checkNodeRebuild( source.__, attributes[key] );
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

  return os;
}

function onState(data) {
  // if already is a oS we don't need to transform it
  if (isOs(data)) {
    return data;
  }

  return createNode(data);
}


///////////
// Event handling
///////////
const eventMethods = {
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
  }
}

////////////
// HELPERS
////////////
function isOs(data) {
  return data && data.__;
}

function err(msg) {
  throw new Error(msg);
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

/* EXPORT - Do not remove or modify this comment */
module.exports = onState;