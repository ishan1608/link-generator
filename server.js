var AWS = require('aws-sdk');
var s3 = new AWS.S3({signatureVersion: 'v4'});
var fs = require('fs');

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
});
