global.window = {
	addEventListener: function(e, clbk){
		this.clbk = () => clbk({data:'now'});
	},
	postMessage(){
		process.nextTick( this.clbk );
	}
}

console.log('Mocking browser window');
require('./onState-spec');