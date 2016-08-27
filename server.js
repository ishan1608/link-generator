var http = require('http');
var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var Mustache = require('mustache');
var wurl = require('wurl');

var port = 9092;
var ip = "0.0.0.0";
var mongoUri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/torrent-downloads';

// Initializing watcher
var watcher = require('./watcher');
watcher.initialize();

function return500(res) {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end('uh-oh.\nThis is embarrassing :(.\nThe server is not working properly. Please contact admin.');
}

http.createServer(function(req, res) {
    var firstLocation = wurl(1, req.url);
    if (firstLocation === 'favicon.ico') {
        fs.readFile('favicon.ico', function(err, file_data) {
            if (!err) {
                res.writeHead(200, {"Content-Type": "image/x-icon"});
                res.end(file_data);
            } else {
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.end("favicon not available");
            }
        });
    } else {
        fs.readFile('downloads_list.html', function(err, file_data) {
            if (!err) {
                MongoClient.connect(mongoUri, function(err, db) {
                    if (!err) {
                        var collection = db.collection('downloads');
                        collection.find().toArray(function(err, docs) {
                            if (!err) {
                                //console.log(docs);
                                var data = {'downloads': docs};
                                var output = Mustache.render(file_data.toString(), data);
                                res.writeHead(200, {'Content-Type': 'text/html'});
                                res.end(output);
                            } else {
                                console.error(err);
                                return500(res);
                            }
                        });
                    } else {
                        console.error(err);
                        return500(res);
                    }
                });
            } else {
                console.error(err);
                return500(res);
            }
        });
    }
}).listen(port, ip);

console.log("Running server at " + ip + ":" + port);
