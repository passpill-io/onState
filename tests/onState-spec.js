// Conditional definition to work also in the browser
// tests where onState is global
if( typeof onState == 'undefined' ){
	var onState = require('../src/onState2');
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

	it( "Original methods are overridden", function(){
		os.newOne = {
			emit: 2,
			on: 2,
			_addParent: 2,
			_delParent: 2
		};

		assert.equal(typeof os.newOne.emit, "function");
		assert.equal(typeof os.newOne.on, "function");
		assert.equal(typeof os.newOne._addParent, "function");
		assert.equal(typeof os.newOne._delParent, "function");
	});

	it("State is mutable", function(){
		os.a = 'changed';
		assert.equal(os.a, 'changed');
	});

	it("State events are emitted on changes", function(done){
		os.on('state', st => {
			assert.notEqual(st, os);
			assert.equal(st.e, 'foo');
			assert.equal(os.e, 'foo');
			done();
		});

		os.e = 'foo';
	});

	it("State events are emitted on delete", function (done) {
		os.on('state', st => {
			assert.notEqual(st, os);
			assert.equal(st.b, undefined);
			assert.equal(os.b, undefined);
			done();
		});

		delete os.b;
	});


	it("State changes are batched", function(done){
		var once = false;
		var twice = false;
		var timer;

		os.on('state', st => {
			if( !once ){
				once = true;
			}
			else {
				twice = true;
			}

			if (!timer) {
				timer = setTimeout(() => {
					assert.equal(st.b.z, 10);
					assert.equal(st.b.y, 11);
					assert.equal(st.b.x, 12);
					assert.equal(st.a, 13);
					assert.equal(os.b.z, 10);
					assert.equal(os.b.y, 11);
					assert.equal(os.b.x, 12);
					assert.equal(os.a, 13);
					assert.notEqual(twice, true);
					done();
				}, 20);
			}
		});

		os.b.z = 10;
		os.b.y = 11;
		os.b.x = 12;
		os.a = 13;
	});

	it('events are emitted in ascending order', function(done){
		var order = '';

		function listen( node, stamp ){
			node.on('state', function(st) {
				order += stamp;
			});
		}

		listen( os, '1');
		listen( os.b, '2');
		listen( os.b.x, '3');

		os.b.x[2] = 'changed';

		setTimeout( () => {
			assert.equal( order, '321');
			assert.equal( os.b.x[2], 'changed');
			done();
		},20);
	});

	it('Preserve unchanged nodes', function(done){
		var data = {
			l1a: [{l3a:[1,2,3], l3b:[3,2,1], l3c:{a:{}, b:{}}}, {}],
			l1b: {l2a:[{},{},{}], l2b:[{},{},{}], l2c:[{},{},{}]},
			l1c: []
		};
		
		var os = onState(data);
		var copy = Object.assign({},os);
		var copy1 = os.l1a.slice();
		var copy2 = Object.assign({}, os.l1a[0]);
		var copy3 = Object.assign({}, os.l1a[0].l3c);

		os.on('state', st => {
			assert.notEqual(st, copy);

			assert.equal(copy1[1], st.l1a[1]);
			assert.notEqual(copy1[0], st.l1a[0]);
			
			assert.equal(copy2.l3a, st.l1a[0].l3a);
			assert.equal(copy2.l3b, st.l1a[0].l3b);
			assert.notEqual(copy2.l3c, st.l1a[0].l3c);

			assert.equal(copy3.a, st.l1a[0].l3c.a);
			assert.notEqual(copy3.b, st.l1a[0].l3c.b);

			done();
		});
		
		os.l1a[0].l3c.b = {};
	});
});


