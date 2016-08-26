var AWS = require('aws-sdk');
var s3 = new AWS.S3({signatureVersion: 'v4'});
var fs = require('fs');
var chokidar = require('chokidar');
var path = require('path');
var zipdir = require('zip-dir');

// Watch changes to a folder
var folder_path = 'data';
// Initialize watcher.
var watcher = chokidar.watch(folder_path, {
    ignored: /[\/\\]\./,
    persistent: true
});
watcher
    .on('add', function(new_path) {
        if (path.dirname(new_path) === folder_path) {
            //console.log('File', new_path, 'has been added');
            var file_stream = fs.createReadStream(new_path);
            var params = {Bucket: 's3-link-generator', Key: new_path, Body: file_stream};

            s3.upload(params).on('httpUploadProgress', function(event) {
                //console.log('S3 upload progress:', event.loaded, '/', event.total);
            }).send(function(err, data) {
                if (err) {
                    console.log("An error occurred ", err);
                } else {
                    console.log("Uploaded the file at ", data.Location);
                }
            });
        }
    })
    .on('addDir', function(new_path) {
        if (path.dirname(new_path) === folder_path) {
            //console.log('Directory', new_path, 'has been added');
            zipdir(new_path, { saveTo: new_path + ".zip" }, function (err, buffer) {
                // `buffer` is the buffer of the zipped file
                // And the buffer was saved to `~/myzip.zip`
                if (err) {
                    console.error('Error zipping ' + new_path);
                } else {
                    console.log('Successfully zipped ' + new_path + ".zip");
                }
            });
        }
    });
