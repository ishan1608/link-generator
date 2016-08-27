/**
 * Created by ishan on 27/8/16.
 */
var AWS = require('aws-sdk');
var fs = require('fs');
var chokidar = require('chokidar');
var path = require('path');
var zipdir = require('zip-dir');
var MongoClient = require('mongodb').MongoClient;

var AWS_BUCKET_NAME = 's3-link-generator';
var mongoUri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/torrent-downloads';

// Preparing s3 to new api version
var s3 = new AWS.S3({signatureVersion: 'v4'});

// Watch changes to a folder
var folder_path = 'data';

function initialize() {
    // Initialize watcher.
    var watcher = chokidar.watch(folder_path, {
        ignored: /[\/\\]\./,
        persistent: true
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
                    console.log(path.basename(new_path) + ': ', event.loaded, '/', event.total);
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
                    }
                });
            }
        })
        .on('addDir', function(new_path) {
            // Only watching folder of current folder
            if (path.dirname(new_path) === folder_path) {
                //console.log('Directory', new_path, 'has been added');
                // Zipping the folder in same location to be captured by file watcher
                zipdir(new_path, { saveTo: new_path + ".zip" }, function (err, buffer) {
                    // `buffer` is the buffer of the zipped file
                    // And the buffer was saved to new_path + ".zip"
                    if (err) {
                        console.error('Error zipping ' + new_path);
                    } else {
                        // Successfully zipped the folder and now it will be caught by file watcher
                        //console.log('Successfully zipped ' + new_path + ".zip");
                    }
                });
            }
        });

    console.log("Watching: " + folder_path);
}

exports.initialize = initialize;
