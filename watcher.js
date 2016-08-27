/**
 * Created by ishan on 27/8/16.
 */
var AWS = require('aws-sdk');
var fs = require('fs');
var chokidar = require('chokidar');
var path = require('path');
var zipdir = require('zip-dir');
var MongoClient = require('mongodb').MongoClient;
var os = require('os');

var AWS_BUCKET_NAME = 's3-link-generator';
var mongoUri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/torrent-downloads';

// Preparing s3 to new api version
var s3 = new AWS.S3({signatureVersion: 'v4'});

// Watch changes to a folder
var folder_path = '';
var incomplete_folder_path = '';
if(os.hostname() === 'iUbuntu') {
    folder_path = 'data';
    incomplete_folder_path = 'incomplete';
} else {
    folder_path = '/home/ubuntu/Downloads/transmission/completed';
    incomplete_folder_path = '/home/ubuntu/Downloads/transmission/incomplete';
}

function initialize() {
    // Initialize incomplete watcher
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
            var copied_path = path.join(folder_path, path.basename(old_path));
            console.log('NEW Location ' + copied_path);
            // Zipping the folder in same location to be captured by file watcher
            zipdir(copied_path, { saveTo: copied_path + ".zip" }, function (err, buffer) {
                // `buffer` is the buffer of the zipped file
                // And the buffer was saved to new_path + ".zip"
                if (err) {
                    console.error('Error zipping ' + copied_path + err);
                } else {
                    // Successfully zipped the folder and now it will be caught by file watcher
                    console.log('Successfully zipped ' + copied_path + ".zip");
                }
            });
        }
    });

    // Initialize complete watcher.
    var watcher = chokidar.watch(folder_path, {
        ignored: /[\/\\]\./,
        persistent: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        }
    });
    watcher
        .on('add', function(new_path) {
            // Only watching files of current folder
            if (path.dirname(new_path) === folder_path) {
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
        /*.on('addDir', function(new_path) {
            // Only watching folder of current folder
            if (path.dirname(new_path) === folder_path) {
                console.log('Directory', new_path, 'has been added');
                // Zipping the folder in same location to be captured by file watcher
                zipdir(new_path, { saveTo: new_path + ".zip" }, function (err, buffer) {
                    // `buffer` is the buffer of the zipped file
                    // And the buffer was saved to new_path + ".zip"
                    if (err) {
                        console.error('Error zipping ' + new_path + err);
                    } else {
                        // Successfully zipped the folder and now it will be caught by file watcher
                        //console.log('Successfully zipped ' + new_path + ".zip");
                    }
                });
            }
        });*/

    console.log("Watching: " + folder_path + " & " + incomplete_folder_path);
}

exports.initialize = initialize;
