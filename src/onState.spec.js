// Conditional definition to work also in the browser
// tests where onState is global
if( typeof onState == 'undefined' ){
	var onState = require('../src/onState');
	var assert = require('assert');
}

// deactivates console.warn
// console.warn = function(){};

let data = {
	a: 1,
	b: { z: 0, y: 1, x:[ 'A', 'B'] },
	c: [1, 2, {w: 3}],
	d: null
};

let os;

describe( "onState", function(){
	beforeEach( function(){
		os = onState( data );
	});

	describe('creation', () => {
		it( 'Create an onState object', function(){
			expect( data.a ).toEqual( os.a );
			expect( data.b.z ).toEqual( os.b.z );
			expect( data.b.x[0] ).toEqual( os.b.x[0] );
			expect( data.c[0] ).toEqual( os.c[0] );
			expect( data.c[2].w ).toEqual( os.c[2].w );
			expect( data.d ).toEqual( os.d);
		});

		it("State is mutable", function(){
			os.a = 'changed';
			expect(os.a).toBe('changed');
		});

		it("State is serializable", () => {
			expect( JSON.toString(data) ).toBe( JSON.toString(os) );
		})
	});

	describe('methods existence', () => {
		it( 'All methods in place', function(){
			expect( typeof os.emitChange ).toBe( "function" );
			expect( typeof os.addChangeListener ).toBe( "function" );
		});

		it( "Intermediate nodes also have methods", function(){
			expect( typeof os.b.x.emitChange ).toBe( "function" );
			expect( typeof os.b.x.addChangeListener ).toBe( "function" );
		});

		it( "New nodes also have methods", function(){
			os.newOne = {};

			expect( typeof os.newOne.emitChange ).toBe( "function" );
			expect( typeof os.newOne.addChangeListener ).toBe( "function" );
		});

		it( "Original methods are overridden", function(){
			os.newOne = {
				emit: 2,
				on: 2
			};

			expect(typeof os.newOne.emitChange ).toBe( "function");
			expect(typeof os.newOne.addChangeListener ).toBe( "function");
		});
	});


	describe('event emmiting', () => {
		it("State events are emitted on changes", function(done){
			os.addChangeListener( st => {
				expect(st).toEqual(os);
				expect(st.e).toBe('foo');
				expect(os.e).toBe('foo');
				done();
			});

			os.e = 'foo';
		});

		it("State events are emitted on delete", function (done) {
			os.addChangeListener( st => {
				expect(st).toEqual(os);
				expect(st.b).toBe(undefined);
				expect(os.b).toBe(undefined);
				done();
			});

			delete os.b;
		});

		it("State events are emitted on delete leaf", function(done){
			os.addChangeListener( st => {
				expect(st).toEqual(os);
				expect(st.b.z).toBe(undefined);
				expect(Object.keys(st.b).length).toBe(2);
				done();
			});

			delete os.b.z;
		});

		it('events are emitted in ascending order', function(done){
			let order = '';

			function listen( node, stamp ){
				node.addChangeListener( function(st) {
					order += stamp;
				});
			}

			listen( os, '1');
			listen( os.b, '2');
			listen( os.b.x, '3');

			os.b.x[2] = 'changed';

			setTimeout( () => {
				expect( order ).toBe('321');
				expect( os.b.x[2] ).toBe('changed');
				done();
			},20);
		});

		it("Add more than one listener to a node", function(done){
			let one, two;
			os.addChangeListener( function () { one = 1 });
			os.addChangeListener( function() { two = 2 });

			os.a = 2;

			setTimeout( function(){
				expect( one ).toBe( 1 );
				expect( two ).toBe( 2 );
				done();
			}, 10);
		});

		it("Remove listeners", function(){
			let called = '',
				listener = function(){
					called += '1';
				}
			;

			os.addChangeListener(listener);
			os.emitChange();
			os.removeChangeListener(listener );
			os.emitChange();

			expect(called).toBe('1');
		});

		it("Removing an unexistant listener doesn't affect others", function(){
			let called = '',
				listener = function () {
					called += '1';
				},
				listener2 = function() {
					called += '2';
				}
			;
			
			os.removeChangeListener(listener2);
			os.addChangeListener(listener);
			os.emitChange();
			os.removeChangeListener(listener2);
			os.emitChange();

			expect(called).toBe('11');
		});

		it("Changes in detached nodes don't emit events", function(done){
			let hits = 0,
				osbx = os.b.x
			;

			os.b.addChangeListener( function (b) {
				hits++;
			});

			osbx.push('C');
			setTimeout(() => osbx.push('D'), 20);
			setTimeout(() => osbx.push('E'), 40);

			setTimeout(() => {
				expect(os.b.x.length).toBe(3);
				expect(hits).toBe(1);
				done();
			}, 80);
		});

		it("Simultaneous changes in different levels should only trigger one state event", function(done){
			let once, twice;
			os.addChangeListener(() => {
				if(!once){
					once = true;
				}
				else {
					twice = true;
				}
				expect(twice).not.toBe( true);
				done();
			});

			os.e = true;
			os.b.x.push('C');
		});

		it("Changing the same leave twice in a tick only emit one state event with the second value", function(done){
			let once, twice;
			os.addChangeListener(st => {
				if (!once) {
					once = true;
				}
				else {
					twice = true;
				}
				expect(twice).not.toBe( true);
				expect( st.e).toBe(2 );
				done();
			});

			os.e = 1;
			expect(os.e).toBe(1);
			os.e = 2;
			expect(os.e).toBe(2);
		});

		it("Changing the same node multiple times during time, should emit multiple events in the generated nodes", done => {
			let listener = jest.fn();
			os.b.x.addChangeListener( listener);

			os.b.x.push('C');
			setTimeout( () => {os.b.x.push('D')}, 100 );
			setTimeout( () => {os.b.x.push('E')}, 200 );

			setTimeout( () => {
				expect( listener ).toHaveBeenCalledTimes(3);
				done();
			},300);
		});
	});

	describe('changes', () => {
		it("State changes are batched", function(done){
			let once = false;
			let twice = false;
			let timer;

			os.addChangeListener( st => {
				if( !once ){
					once = true;
				}
				else {
					twice = true;
				}

				if (!timer) {
					timer = setTimeout(() => {
						expect(st.b.z).toBe(10);
						expect(st.b.y).toBe(11);
						expect(st.b.x).toBe(12);
						expect(st.a).toBe(13);
						expect(os.b.z).toBe(10);
						expect(os.b.y).toBe(11);
						expect(os.b.x).toBe(12);
						expect(os.a).toBe(13);
						expect(twice).not.toBe( true);
						done();
					}, 20);
				}
			});

			os.b.z = 10;
			os.b.y = 11;
			os.b.x = 12;
			os.a = 13;
		});

		it('Preserve unchanged nodes', function(done){
			let data = {
				l1a: [
					{l3a:[1,2,3], l3b:[3,2,1], l3c:{a:{}, b:{}}},
					{}
				],
				l1b: {l2a:[{},{},{}], l2b:[{},{},{}], l2c:[{},{},{}]},
				l1c: []
			};

			// Let get a copy of every node related to the path changed
			let os = onState(data);
			let osl1a = os.l1a;
			let osl1b = os.l1b;
			let osl1c = os.l1c;
			let osl1a0 = os.l1a[0];
			let osl1a1 = os.l1a[1];
			let osl1a0l3a = os.l1a[0].l3a;
			let osl1a0l3b = os.l1a[0].l3b;
			let osl1a0l3c = os.l1a[0].l3c;
			let osl1a0l3ca = os.l1a[0].l3c.a;
			let osl1a0l3cb = os.l1a[0].l3c.b;
			

			os.addChangeListener( st => {
				// Nodes in the path changed needs to be different
				// but siblings needs to be the same objects

				expect(st.l1a).not.toBe( osl1a);
				expect(st.l1b).toBe(osl1b);
				expect(st.l1c).toBe(osl1c);

				expect(st.l1a[0]).not.toBe( osl1a0);
				expect(st.l1a[1]).toBe(osl1a1);
				
				expect(osl1a0l3a).toBe(st.l1a[0].l3a);
				expect(osl1a0l3b).toBe(st.l1a[0].l3b);
				expect(osl1a0l3c).not.toBe( st.l1a[0].l3c);

				expect(osl1a0l3ca).toBe(st.l1a[0].l3c.a);
				expect(osl1a0l3cb).not.toBe( st.l1a[0].l3c.b);

				done();
			});
			
			os.l1a[0].l3c.b = {};
		});

		it('Adding working nodes to os objects should preserve __', function(done){
			let os2 = onState({foo: 'bar'}),
				once = false,
				twice = false
			;

			os.os2 = os2;

			os2.addChangeListener( function(){
				once = 'true';
			});
			os.addChangeListener( function(){
				twice = 'true';
			});

			os2.second = 'true';

			setTimeout( () => {
				expect(once).toBe('true');
				expect(twice).toBe('true');
				done();
			}, 10);
		});

		it("Add a oS node to the object throws an error", function(done){
			let thrown = false;
			try {
				os.e = os.b;
			}
			catch( err ){
				thrown = true;
			}

			setTimeout( function(){
				expect(os.e).not.toBe( os.b);
				expect(thrown).toBe(true);
				done();
			},10);
		});

		it("Splice delete exception should be removed after tick", function( done ){
			let f;

			os.addChangeListener( f = function(st){
				let thrown;
				os.removeChangeListener(f);
				try {
					os.c.push(st.c[1]);
				}
				catch( err ){
					thrown = true;
				}

				expect(st.c.length).toBe(2);
				expect(thrown).toBe(true );
				done();
			});

			os.c.splice(0,1);
		});

		it("Conserve listeners on changes", function(done){
			let hits = 0,
				osb = os.b
			;
			
			os.b.addChangeListener( function(b){
				osb = b;
				hits++;
			});

			os.b.x.push('C');
			setTimeout(() => osb.x.push('D'), 20);
			setTimeout(() => osb.x.push('E'), 40);
			setTimeout(() => osb.x.push('F'), 60);

			setTimeout( () => {
				expect( osb.x.length).toBe(6 );
				expect( hits).toBe(4 );
				done();
			}, 80);
		});

		it("Nested updates can be accessible from the root node", function(done){
			os.addChangeListener( st => {
				expect(st.c.w).toBe(4);
				done();
			});

			os.c.w = 4;
		});

		it("Update object node should update its keys", function(){
			os.b.other = 'new';
			let keys = Object.keys(os.b);
			expect(keys.length).toBe(4);
		});

		it("Update array node should update its keys", function () {
			os.c.push(4);
			
			let count = 0;
			for( let i in os.c ){
				count++;
			}
			
			os.c.forEach( value => {
				count++;
			});
			
			expect(count).toBe(8);
		});
	});
	
	describe('internals', () => {
		it("Mark event should be kept in the root node", function(done){
			os.addChangeListener( () => {
				if( os.e < 2 ){
					os.e++;
				}
				else {
					expect(os.e).toBe(2);
					done();
				}
			});
			os.e = 0;
		});

		it("Root children need to point the root as parent", function( done ){
			os.addChangeListener( () => {
				Object.keys(os).forEach( key => {
					if( os[key] && os[key].__ ){
						expect(os[key].__.parent).toBe(os.__);
					}
				});
				done();
			});
			os.c.w = 4;
		});

		it("Root node should keep semi-mutable", function( done ){
			os.e = 1;
			setTimeout(() => {
				expect(os.e).toBe(1);
				expect(os.__.update).toBe(undefined);
				done();
			});
		});
	});

	
});


