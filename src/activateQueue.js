module.exports = function( flushTimers ){
	/* START */
	var activateQueue;
	if (typeof window !== 'undefined' && window.addEventListener ) {
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
