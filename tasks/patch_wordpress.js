/*
 * grunt-patch-wordpress
 * https://github.com/aaronjorbin/grunt-patch-wordpress
 * Based on https://gist.github.com/markjaquith/4219135 
 *
 *
 * Copyright (c) 2013 Aaron Jorbin
 * Licensed under the MIT license.
 */

var request = require('request')
    , exec =  require('child_process').exec
    , inquirer = require("inquirer")
    , url = require('url')
    , fs = require('fs')
	, _ = require('underscore')

_.str = _.str = require('underscore.string')
_.mixin( _.str.exports() )
    

module.exports = function(grunt) {
    var temp_file = 'wppatch.diff'

    function is_svn(){
        return fs.existsSync('.svn');
    }

    function apply_patch( patch_url , done ){
        grunt.verbose.write( patch_url )
        parsed_url = url.parse(patch_url)

        // What to do when either our patch is ready
        grunt.event.once('fileReady', function(level){
               exec('patch -p' + level + ' < ' + temp_file, function(error, result, code) {
                    grunt.file.delete(temp_file);
                    grunt.verbose.write(error, result, code)
                    done(0)
                })
        })

        // or we know we have failed
        grunt.event.once('fileFail', function(msg){
            if (typeof msg === 'string')
                grunt.log.errorlns(msg)

            done(false)
        })


        // if patch_url is a full url and is a raw-attachement, just apply it 
        if( parsed_url.hostname === 'core.trac.wordpress.org' && parsed_url.pathname.match(/raw-attachment/) )
            get_patch( patch_url )
        // if patch_url is full url and is a attachment, convert it to a raw attachment
        else if ( parsed_url.hostname === 'core.trac.wordpress.org' && parsed_url.pathname.match(/attachment/) )
            get_patch( convert_to_raw ( parsed_url ) )
        // if patch_url is just a ticket number, get a list of patches on that ticket and allow user to choose one
        else if (  parsed_url.hostname === 'core.trac.wordpress.org' && parsed_url.pathname.match(/ticket/) ) 
            get_patch_from_ticket(patch_url)
        // if we just enter a number, assume it is a ticket number
        else if ( parsed_url.hostname === null && ! parsed_url.pathname.match(/\./) )
            get_patch_from_ticket_number(patch_url)
        // if patch_url is a local file, just use that 
        else if ( parsed_url.hostname === null )
            get_local_patch(patch_url)
        // We've failed in our mission
        else
            grunt.event.emit('fileFile', 'All matching failed.  Please enter a ticket url, ticket number, patch url')

    }

    function convert_to_raw( parsed_url ){
        parsed_url.pathname = parsed_url.pathname.replace(/attachment/, "raw-attachment")
        return url.format( parsed_url )
    }

    function get_patch_from_ticket_number( patch_url ){
            grunt.event.emit('fileFile', 'method not available yet')

    }

    function get_patch_from_ticket( patch_url ){
            grunt.event.emit('fileFile', 'method not available yet')
    }

    function get_local_patch(patch_url) {
        var body = grunt.file.read(patch_url)
            , level = body.match(/diff --git a\//) ? 1 : 0

        grunt.file.copy(patch_url, temp_file)
        grunt.event.emit('fileReady', level)
    }

    function get_patch( patch_url ){
        request(patch_url, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var level = body.match(/diff --git a\//) ? 1 : 0
                grunt.file.write( temp_file, body)
                grunt.event.emit('fileReady', level)
            } else {
                // something went wrong
                    grunt.event.emit('fileFail')
            }
        })
    }

    function file_fail(done){
        grunt.log.errorlns('To use this command without entering a ticket number, ticket url or patch,')
        grunt.log.errorlns('Please have a diff or patch in your WordPress Directory')
        done(false)
    }


    grunt.registerTask('patch_wordpress', 'Patch your develop-wordpress directory like a boss', function( ticket, afterProtocal ) {
        var done = this.async()

        // since URLs contain a : which is the seperator for grunt, we need to reassemble the url.
        if (typeof afterProtocal !== 'undefined')
            ticket = ticket + ':' + afterProtocal

        if (typeof ticket === 'undefined'){
            // look for diffs and patches in the root of the checkout and prompt using inquirer to pick one 
            var fileFinderCommand = is_svn() ? "svn status " : 'git ls-files --other --exclude-standard'
                , files
            exec(fileFinderCommand , function(error, result, code) {
                if (! error){
					files = _.filter( result.split("\n") , function(file){
						return ( _.str.include(file, 'patch') || _.str.include( file, 'diff') ) 
					})
                    if (files.length === 0) {
                        file_fail( done )
                    } else if (files.length === 1) {
                        apply_patch( files[0] , done )
                    } else {
                        inquirer.prompt([
                            { type: 'list',
                              name: 'file',
                              message: 'Please select a file to apply',
                              choices: files
                            }
                        ], function (answers ) {
							var file = answers.file.replace('?', '').replace(/\s/g, '')
                            apply_patch( file , done )
                        })
                    }
                } else {
                    file_fail( done )
                }
            });


        } else {
            apply_patch( ticket , done )

        }

    })

}