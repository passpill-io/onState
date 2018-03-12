var pack = require('../package.json');
var fs = require('fs');
var Path = require('path');
var ugly = require('uglify-es');
var rimraf = require('rimraf');

var pack = require('../package.json');
var moduleName = 'onState';

const BUILD_PATH = Path.join(__dirname, '../dist') ;

module.exports = {
	read: function( path ){
		var p = Path.join(__dirname, path);
		return fs.readFileSync(p, { encoding: 'utf8' });
	},
	write: function( filename, content ){
		var path = Path.join(BUILD_PATH, filename);
		return fs.writeFileSync( path, content );
	},
	build: function(){
		rimraf(BUILD_PATH, () => {
			fs.mkdirSync(BUILD_PATH);

			var content = this.read( '../src/onState.js' );
			var activateQueue = this.read('../src/activateQueue.js')
				.split('/* START */')[1]
				.split('/* END */')[0]
			;

			content = content.replace("var activateQueue = require('./activateQueue')(flushTimers);", activateQueue);

			// Remove the export, wrap it in umd
			var umd = this.toUmd(moduleName, content.split('/* EXPORT')[0]),
				minified = ugly.minify(umd)
			;

			if( minified.error ){
				console.error( minified.error );
			}

			this.write('onstate.js', this.addComment(umd));
			this.write('onstate.min.js',
				this.addComment(minified.code, '/* %%name%% %%version%% - %%homepage%% */\n%%contents%%'));

			console.log('Done!');
		});
	},
	addComment: function( content, comment ){
		var now = new Date(),
			wrapper = comment || this.read('./comment.txt')
		;

		return wrapper
			.replace(/%%name%%/g, pack.name)
			.replace(/%%version%%/g, pack.version)
			.replace(/%%author%%/g, pack.author)
			.replace(/%%license%%/g, pack.license)
			.replace(/%%homepage%%/g, pack.homepage)
			.replace(/%%date%%/g, now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() )
			.replace(/%%contents%%/g, content)
		;
	},
	toUmd: function( moduleName, content ){
		var wrapper = this.read('umd.txt');

		return wrapper
			.replace(/%%moduleName%%/g, moduleName )
			.replace(/%%contents%%/g, content)
		;
	}
}