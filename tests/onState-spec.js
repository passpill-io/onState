// Conditional definition to work also in the browser
// tests where onState is global
if( typeof onState == 'undefined' ){
	var onState = require('../onState.js');
	var assert = require('assert');
}

var data = {
	a: 1,
	b: { z: 0, y: 1, x:[ 'A', 'B'] },
	c: [1, 2, {w: 3}],
	d: null
};

var os;

describe( "onState tests", function(){
	beforeEach( function(){
		os = onState( data );
	});

	it( 'Create an onState object', function(){
		console.log('dentro');
		assert.equal( data.a, os.a );
		assert.equal( data.b.z, os.b.z );
		assert.equal( data.b.x[0], os.b.x[0] );
		assert.equal( data.c[0], os.c[0] );
		assert.equal( data.c[2].w, os.c[2].w );
		assert.equal( data.d, os.d);
	});

	it( 'All methods in place', function(){
		console.log('dentro');
		assert.equal( typeof os.emit, "function" );
		assert.equal( typeof os.on, "function" );
		assert.equal( typeof os._addParent, "function" );
		assert.equal( typeof os._delParent, "function" );
	});

	it( "Intermediate nodes also have methods", function(){
		console.log('dentro');
		assert.equal( typeof os.b.x.emit, "function" );
		assert.equal( typeof os.b.x.on, "function" );
		assert.equal( typeof os.b.x._addParent, "function" );
		assert.equal( typeof os.b.x._delParent, "function" );
	});

	it( "New nodes also have methods", function(){
		console.log('dentro');
		os.newOne = {};

		assert.equal( typeof os.newOne.emit, "function" );
		assert.equal( typeof os.newOne.on, "function" );
		assert.equal( typeof os.newOne._addParent, "function" );
		assert.equal( typeof os.newOne._delParent, "function" );
	});

	it( "Original methods are not overridden", function(){
		os.newOne = {
			emit: 2,
			on: 2,
			_addParent: 2,
			_delParent: 2
		};

		assert.equal( os.newOne.emit, 2 );
		assert.equal( os.newOne.on, 2 );
		assert.equal( os.newOne._addParent, 2 );
		assert.equal( os.newOne._delParent, 2 );
	});
});
