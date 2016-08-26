var AWS = require('aws-sdk');
var s3 = new AWS.S3({signatureVersion: 'v4'});
var fs = require('fs');
var chokidar = require('chokidar');
var path = require('path');

/*// This uploads a file
var file_name = 'acker7.jpg';
var file_stream = fs.createReadStream('data/' + file_name);
var file_key = file_name;
var params = {Bucket: 's3-link-generator', Key: file_key, Body: file_stream};

s3.upload(params).on('httpUploadProgress', function(event) {
    console.log('Progress:', event.loaded, '/', event.total);
}).send(function(err, data) {
    if (err) {
        console.log("An error occurred", err);
    } else {
        console.log("Uploaded the file at", data.Location);
    }
});*/

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
            console.log('File', new_path, 'has been added');
            var file_stream = fs.createReadStream(new_path);
            var params = {Bucket: 's3-link-generator', Key: new_path, Body: file_stream};

            s3.upload(params).on('httpUploadProgress', function(event) {
                console.log('S3 upload progress:', event.loaded, '/', event.total);
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
            console.log('Directory', new_path, 'has been added');
        }
    });
