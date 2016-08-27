/**
 * Created by ishan on 27/8/16.
 */
var AWS = require('aws-sdk');
var fs = require('fs');
var chokidar = require('chokidar');
var path = require('path');
var MongoClient = require('mongodb').MongoClient;
var os = require('os');
var exec = require('child_process').exec;

var AWS_BUCKET_NAME = 's3-link-generator';
var mongoUri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/torrent-downloads';

// Preparing s3 to new api version
var s3 = new AWS.S3({signatureVersion: 'v4'});

// Watch changes to a folder
var completed_folder_path = '';
var incomplete_folder_path = '';
if(os.hostname() === 'iUbuntu') {
    completed_folder_path = '/home/ishan/nodejs/link-generator/data';
    incomplete_folder_path = '/home/ishan/nodejs/link-generator/incomplete';
} else {
    completed_folder_path = '/home/ubuntu/Downloads/transmission/completed';
    incomplete_folder_path = '/home/ubuntu/Downloads/transmission/incomplete';
}

function initialize() {
    // Initialize incomplete_watcher
    var incomplete_watcher = chokidar.watch(incomplete_folder_path, {
        ignored: /[\/\\]\./,
        persistent: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        }
    });
    incomplete_watcher.on('unlinkDir', function(old_path) {
        console.log(old_path + " has been removed");
        if (path.dirname(old_path) === incomplete_folder_path) {
            var copied_path = path.join(completed_folder_path, path.basename(old_path));
            console.log('NEW Location ' + copied_path);
            // Zipping the folder in same location to be captured by file completed_watcher
            // zipping new_path to new_path + ".zip"
            var shell_command = 'cd ' + completed_folder_path +' && zip -r ' + path.basename(new_path) + '.zip '
                + path.basename(new_path);
            console.log(shell_command);
            exec(shell_command, function(error, stdout, stderr) {
                console.log('stdout: ' + stdout);
                console.log('stderr: ' + stderr);
                if (error !== null) {
                    console.log('exec error: ' + error);
                }
            });
        }
    });

    // Initialize completed_watcher.
    var completed_watcher = chokidar.watch(completed_folder_path, {
        ignored: /[\/\\]\./,
        persistent: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        }
    });
    completed_watcher
        .on('add', function(new_path) {
            // Only watching files of current folder
            if (path.dirname(new_path) === completed_folder_path) {
                //console.log('File', new_path, 'has been added');
                // Preparing S3 Upload
                var file_stream = fs.createReadStream(new_path);
                var params = {Bucket: AWS_BUCKET_NAME, Key: new_path, Body: file_stream};

                // Use progress listener as needed
                s3.upload(params).on('httpUploadProgress', function(event) {
                    // TODO Enter items into database here itself, have a status parameter
                    console.log('uploading ' + path.basename(new_path) + ': ' + event.loaded + " / " + event.total);
                }).send(function(err, data) {
                    if (err) {
                        console.log("An error occurred ", err);
                    } else {
                        // File upload done successfully
                        console.log("Uploaded the file at ", data.Location);
                        // Adding / updating this to the database
                        MongoClient.connect(mongoUri, function(err, db) {
                            if (!err) {
                                var collection = db.collection('downloads');
                                collection.findOneAndUpdate({'file': path.basename(new_path)}, {$set: {'link': data.Location}},
                                    {upsert: true, returnOriginal: false}, function (err, document) {
                                        if (!err) {
                                            console.log("updated " + document.value.file + " with " + document.value.link);
                                            //console.log(document);
                                        } else {
                                            console.log('error updating database');
                                            console.error(err);
                                        }
                                        db.close();
                                    });
                            }
                        });
                        // Removing if it is a zip file
                        if (path.extname(new_path) === '.zip') {
                            console.log('Remvoing zip file ' + new_path);
                            fs.unlink(new_path, function(err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                        }
                    }
                });
            }
        });

    console.log("Watching: " + completed_folder_path + " & " + incomplete_folder_path);
}

exports.initialize = initialize;
