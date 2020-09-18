/////
// This is the batching queue for changes.
// Depending we are on node or the browser
// we can use different strategies to trigger the event at
// the next tick
/////

module.exports = function( flushTimers ){
	/* START */
	var activateQueue;
	if( typeof window !== 'undefined' && window.setImmediate ){
		let immId = false;
		activateQueue = function(){
			if( !immId ){
				immId = window.setImmediate( function() {
					immId = false;
					flushTimers();
				});
			}
		}
	}
	else if (typeof window !== 'undefined' && window.addEventListener ) {
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
	/* END */
	return activateQueue;
}
