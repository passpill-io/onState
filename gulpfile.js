var gulp = require('gulp'),
	fs = require('fs'),
	uglify = require('gulp-uglify'),
	rename = require('gulp-rename'),
	insert = require('gulp-insert'),
	buildTools = require('./utils/buildTools')
;

var packageName = 'onstate';
var pack = require('./package.json');

var core = function (fileContents) {
	//Transform the buffer to string
	return ('' + fileContents).split('/* EXPORT')[0];
};

function handleErrors(err) {
	console.log(err);
}

gulp.task( 'build', function(){
	var src = core( fs.readFileSync('./src/onState2.js') );
	src = buildTools.toUmd( 'onState', src );
	src = buildTools.addComment( src );
});