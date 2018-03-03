(function(root){

/*
  START onState implementation
*/

const dontPropagate = new Set(['_reState', 'state']);

function isOs( data ){
  return data && data._delParent;
}

function onState( data ){

  

  var listeners = {},
  	parents = [],
    timer = false
  ;

  var m = {
    on: function( event, clbk ){
      if( !listeners[event] ){
        listeners[event] = [clbk];
      }
      else {
        listeners[event].push(clbk);
      }
    },
    emit: function( event ){
      var args = arguments;

      [event, '*'].forEach( e => {
      	if( listeners[e] ){
        	listeners[e].forEach( clbk => {
          	clbk.apply( null, args );
          });
        }
      });

      // Don't propagate reState
      if( dontPropagate.has(event) ) return;

      var method = event === 'update' ? '_enqueue' : 'emit';
      parents.forEach( p => p[method].apply(p, args) );
    },
    _addParent: function( p ){
      parents.push(p);
    },
    _delParent: function( p ){
      var idx = parents.indexOf(p);
      if( idx !== -1 ){
      	parents.splice( idx, 1 );
      }
    }
  }

  function createNode( data ){
    var base = data.splice ? [] : {},
      timer = true
    ;

    var enqueueState = function( node ){
      if( !timer ){
        timer = setTimeout( () => {
          timer = false;
          node.emit('state', node );
          parents.forEach( p => p.emit('_reState', node, createNode(node)) );
        });
      }
    }

    var oS = new Proxy( base, {
    	set: function(obj, prop, value){
      	var isObject = value instanceof Object,
        	child = isObject ? onState(value) : value,
        	oldValue = obj[prop]
        ;


        if( oldValue && oldValue._delParent ){
        	oldValue._delParent(m);
        }

        if( isObject ){
        	child._addParent(m);
        }

        Reflect.set( obj, prop, child );
        enqueueState(oS);
        return true;
      },
      deleteProperty: function( obj, prop ){
        var oldValue = obj[prop];

        if( oldValue && oldValue._delParent ){
        	oldValue._delParent(m);
        }

        Reflect.deleteProperty(obj, prop);
        enqueueState(oS);
        return true;
      },
      get: function (obj, prop) {
        if (m[prop]) {
          return m[prop];
        }
        if(obj[prop] || obj.hasOwnProperty(prop)){
          return obj[prop];
        }

        return Reflect.get( obj, prop );
      }
    });

    var key;
    for( key in data ){
      oS[key] = data[key];
    }

    timer = false;

    oS.on('_reState', (prevState, nextState) => {
       for(var key in oS){
         if( oS[key] === prevState ){
           Reflect.set( oS, key, nextState );
           oS.emit('state', oS );
           if( parents.length ){
             var next = createNode( oS );
             parents.forEach( p => p.emit('_reState', oS, next) );
           }
         }
       }
    });

    return oS;
  }

  return createNode( data );
}


/*
  END onState implementation
*/

// Make it work everywhere
if (typeof define === 'function' && define.amd) {
  // AMD. Register as an anonymous module.
  define(['exports', 'onState'], onState);
} else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
  // CommonJS
  module.exports = onState;
} else {
  // Browser globals
  root.onState = onState;
}

})(this);
