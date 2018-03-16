// Conditional definition to work also in the browser
// tests where onState is global
if( typeof onState == 'undefined' ){
	var onState = require('../src/onState');
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
		assert.equal( data.a, os.a );
		assert.equal( data.b.z, os.b.z );
		assert.equal( data.b.x[0], os.b.x[0] );
		assert.equal( data.c[0], os.c[0] );
		assert.equal( data.c[2].w, os.c[2].w );
		assert.equal( data.d, os.d);
	});

	it( 'All methods in place', function(){
		assert.equal( typeof os.emit, "function" );
		assert.equal( typeof os.on, "function" );
	});

	it( "Intermediate nodes also have methods", function(){
		assert.equal( typeof os.b.x.emit, "function" );
		assert.equal( typeof os.b.x.on, "function" );
	});

	it( "New nodes also have methods", function(){
		os.newOne = {};

		assert.equal( typeof os.newOne.emit, "function" );
		assert.equal( typeof os.newOne.on, "function" );
	});

	it( "Original methods are overridden", function(){
		os.newOne = {
			emit: 2,
			on: 2
		};

		assert.equal(typeof os.newOne.emit, "function");
		assert.equal(typeof os.newOne.on, "function");
	});

	it("State is mutable", function(){
		os.a = 'changed';
		assert.equal(os.a, 'changed');
	});

	it("State events are emitted on changes", function(done){
		os.on('state', st => {
			assert.equal(st, os);
			assert.equal(st.e, 'foo');
			assert.equal(os.e, 'foo');
			done();
		});

		os.e = 'foo';
	});

	it("State events are emitted on delete", function (done) {
		os.on('state', st => {
			assert.equal(st, os);
			assert.equal(st.b, undefined);
			assert.equal(os.b, undefined);
			done();
		});

		delete os.b;
	});

	it("State events are emitted on delete leave", function(done){
		os.on('state', st => {
			assert.equal(st, os);
			assert.equal(st.b.z, undefined);
			assert.equal(Object.keys(st.b).length, 2);
			done();
		});

		delete os.b.z;
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
			l1a: [
				{l3a:[1,2,3], l3b:[3,2,1], l3c:{a:{}, b:{}}},
				{}
			],
			l1b: {l2a:[{},{},{}], l2b:[{},{},{}], l2c:[{},{},{}]},
			l1c: []
		};

		// Let get a copy of every node related to the path changed
		var os = onState(data);
		var osl1a = os.l1a;
		var osl1b = os.l1b;
		var osl1c = os.l1c;
		var osl1a0 = os.l1a[0];
		var osl1a1 = os.l1a[1];
		var osl1a0l3a = os.l1a[0].l3a;
		var osl1a0l3b = os.l1a[0].l3b;
		var osl1a0l3c = os.l1a[0].l3c;
		var osl1a0l3ca = os.l1a[0].l3c.a;
		var osl1a0l3cb = os.l1a[0].l3c.b;
		

		os.on('state', st => {
			// Nodes in the path changed needs to be different
			// but siblings needs to be the same objects

			assert.notEqual(st.l1a, osl1a);
			assert.equal(st.l1b, osl1b);
			assert.equal(st.l1c, osl1c);

			assert.notEqual(st.l1a[0], osl1a0);
			assert.equal(st.l1a[1], osl1a1);
			
			assert.equal(osl1a0l3a, st.l1a[0].l3a);
			assert.equal(osl1a0l3b, st.l1a[0].l3b);
			assert.notEqual(osl1a0l3c, st.l1a[0].l3c);

			assert.equal(osl1a0l3ca, st.l1a[0].l3c.a);
			assert.notEqual(osl1a0l3cb, st.l1a[0].l3c.b);

			done();
		});
		
		os.l1a[0].l3c.b = {};
	});

	it('Adding working nodes to os objects should preserve __', function(done){
		var os2 = onState({foo: 'bar'}),
			once = false,
			twice = false
		;

		os.os2 = os2;

		os2.on('state', function(){
			once = 'true';
		});
		os.on('state', function(){
			twice = 'true';
		});

		os2.second = 'true';

		setTimeout( () => {
			assert.equal(once, 'true');
			assert.equal(twice, 'true');
			done();
		}, 10);
	});

	it("Add a oS node to the object throws an error", function(done){
		var thrown = false;
		try {
			os.e = os.b;
		}
		catch( err ){
			thrown = true;
		}

		setTimeout( function(){
			assert.notEqual(os.e, os.b);
			assert.equal(thrown, true);
			done();
		},10);
	});

	it("Splice delete exception should be removed after tick", function( done ){
		var f;
		os.on('state', f = function(st){
			var thrown;
			os.off('state', f);
			try {
				os.c.push(st.c[1]);
			}
			catch( err ){
				thrown = true;
			}

			assert.equal( st.c.length, 2 );
			assert.equal( thrown, true );
			done();
		});
		os.c.splice(0,1);

	});

	it("Add more than one listener to a node", function(done){
		var one, two;
		os.on('state', function () { one = 1 });
		os.on('state', function() { two = 2 });

		os.a = 2;

		setTimeout( function(){
			assert.equal( one, 1 );
			assert.equal( two, 2 );
			done();
		}, 10);
	});

	it("Custom events should be synchronous and propagated", function(){
		var order = '';

		os.b.x.on('custom', function (arg1, arg2, arg3, arg4) {
			assert.equal(arg1, 'arg1');
			assert.equal(arg2, 'arg2');
			assert.equal(arg3, 'arg3');
			assert.equal(arg4, undefined);
			order += 'A';
		});
		os.b.on('custom', function (arg1, arg2, arg3, arg4) {
			assert.equal(arg1, 'arg1');
			assert.equal(arg2, 'arg2');
			assert.equal(arg3, 'arg3');
			assert.equal(arg4, undefined);
			order += 'B';
		});
		os.on('custom', function (arg1, arg2, arg3, arg4) {
			assert.equal(arg1, 'arg1');
			assert.equal(arg2, 'arg2');
			assert.equal(arg3, 'arg3');
			assert.equal(arg4, undefined);
			order += 'C';
		});

		os.b.x.emit('custom', 'arg1', 'arg2', 'arg3');
		
		assert.equal( order, 'ABC' );
	});

	it("Can't add falsy events", function(){
		os.on(false, function(){
			console.log('My callback');
		});

		assert.equal( os.__.clbks[false], undefined );

		os.on('hello');

		assert.equal(os.__.clbks["hello"], undefined);
	});

	it("Remove listeners", function(){
		var called = '',
			listener = function(){
				called += '1';
			}
		;

		os.on('call', listener);
		os.emit('call');
		os.off('call', listener );
		os.emit('call');

		assert.equal(called, '1');
	});

	it("Removing an unexistant listener doesn't affect others", function(){

		var called = '',
			listener = function () {
				called += '1';
			},
			listener2 = function() {
				called += '2';
			}
		;
		
		os.off('call', listener2);
		os.on('call', listener);
		os.emit('call');
		os.off('call', listener2);
		os.emit('call');

		assert.equal(called, '11');
	});

	it("Conserve listeners on changes", function(done){
		var hits = 0,
			osb = os.b
		;
		
		os.b.on('state', function(b){
			osb = b;
			hits++;
		});

		os.b.x.push('C');
		setTimeout(() => osb.x.push('D'), 20);
		setTimeout(() => osb.x.push('E'), 40);
		setTimeout(() => osb.x.push('F'), 60);

		setTimeout( () => {
			assert.equal( osb.x.length, 6 );
			assert.equal( hits, 4 );
			done();
		}, 80);
	});

	it("Changes in detached nodes don't emit events", function(done){
		var hits = 0,
			osbx = os.b.x
		;

		os.b.on('state', function (b) {
			hits++;
		});

		osbx.push('C');
		setTimeout(() => osbx.push('D'), 20);
		setTimeout(() => osbx.push('E'), 40);

		setTimeout(() => {
			assert.equal(os.b.x.length, 3);
			assert.equal(hits, 1);
			done();
		}, 80);
	});

	it("Emit should return the latest non undefined return value from calbacks", function(){
		var order = '';
		os.on('check:emit', () => {
			order += '1';
			return 1;
		});
		os.on('check:emit', () => {
			order += '2';
		});
		os.on('check:emit', () => {
			order += '3';
			return 3;
		});
		os.on('check:emit', () => {
			order += '4';
		});

		var returned = os.emit('check:emit');
		
		assert.equal( order, '1234');
		assert.equal( returned, 3 );
	});

	it("Changes in different levels should only trigger one state event", function(done){
		var once, twice;
		os.on("state", () => {
			if(!once){
				once = true;
			}
			else {
				twice = true;
			}
			assert.notEqual(twice, true);
			done();
		});

		os.e = true;
		os.b.x.push('C');
	});

	it("Changing the same leave twice only emit one state event with the second value", function(done){
		var once, twice;
		os.on("state", st => {
			if (!once) {
				once = true;
			}
			else {
				twice = true;
			}
			assert.notEqual(twice, true);
			assert.equal( st.e, 2 );
			done();
		});

		os.e = 1;
		assert.equal(os.e, 1);
		os.e = 2;
		assert.equal(os.e, 2);
	});

	it("Root node should keep semi-mutable", function( done ){
		os.e = 1;
		setTimeout(() => {
			assert.equal(os.e, 1);
			assert.equal(os.__.update, undefined);
			done();
		});
	});

	it("Mark event should be kept in the root node", function(done){
		os.on('state', () => {
			if( os.e < 2 ){
				os.e++;
			}
			else {
				assert.equal(os.e, 2);
				done();
			}
		});
		os.e = 0;
	});

	it("Root children need to point the root as parent", function( done ){
		os.on('state', () => {
			Object.keys(os).forEach( key => {
				if( os[key] && os[key].__ ){
					assert.equal(os[key].__.parent, os.__);
				}
			});
			done();
		});
		os.c.w = 4;
	});

	it("Nested updates can be accessible from the root node", function(done){
		os.on('state', st => {
			assert.equal(st.c.w, 4);
			done();
		});

		os.c.w = 4;
	});
});


