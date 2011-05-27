sys = require('sys');
path = require('path');
http = require('http');
express = require('express');
fs = require('fs');
io = require('socket.io');
url = require('url');
watch = require('watch');
musicmetadata = require('musicmetadata');

PORT = 50116;
WEBROOT = path.join(path.dirname(__filename), 'web');

var currentStatus = {};
var currentCover = {};

function update() {
	updatePosition();
	socket.broadcast(currentStatus);
	delete currentStatus.updated;
}

function readSongStatus() {
	fs.readFile(songinfofile, "binary", function(err, file) {
		if (!err) {
			var lines = file.split(/\r?\n/);
			var newSongInfo = {};
			for ( var x = 0; x < lines.length; x++) {
				var line = lines[x].split("=", 2);
				newSongInfo[line[0]] = line[1];
			}
			currentStatus.songStarted = new Date(new Date() - newSongInfo.position * 1000);
			findCover(newSongInfo, function(err, cover) {
				if (cover) {
					currentCover = cover;
					currentStatus.coverUrl = "/cover?r=" + Math.random();
				} else {
					currentCover = false;
					delete currentStatus.coverUrl;
				}
				currentStatus.songInfo = newSongInfo;
				update();
			});
		}
	});
}

function sendError(res, err) {
	res.writeHead(500);
	res.write("" + err);
	res.end();
}

function findCoverInDirectory(songInfo, cb) {
	fs.readdir(songInfo.fpath, function(err, files) {
		if (err) {
			cb(err);
		} else {
			var image = false;
			for ( var x = 0; x < files.length; x++) {
				var file = files[x].toLowerCase();

				var ext = file.substr(-4);
				if (ext == ".png" || ext == ".jpg") {
					var pref = 10;

					if (file == "folder.jpg") {
						pref = 0;
					} else if (file == "cover.jpg") {
						pref = 5;
					} else if (file.indexOf("front") > -1 || file.indexOf("cover") > -1) {
						pref = 7;
					}
					if (!image || image.pref > pref) {
						image = {
							pref : pref,
							file : files[x]
						};
					}
				}
			}
			if (image) {
				sys.log("Selected " + image.file + " as cover");
				cb(false, {
					path : path.join(songInfo.fpath, image.file)
				});
			} else {
				cb("No Cover Image found " + files);
			}
		}
	});
}

function findCover(songInfo, cb) {
	if (!songInfo || !songInfo.fpath)
		return false;
	var currentCoverData = false;
	var stream = fs.createReadStream(songInfo.fn);
	stream.on('error', function() {
		sys.log("Problem reading file metadata for " + songInfo.fn);
		findCoverInDirectory(songInfo, cb);
	});
	var parser = new musicmetadata(stream);
	parser.on('metadata', function(result) {
		songInfo.title = result.title;
		songInfo.artist = result.artist[0];
		songInfo.album = result.album;
		currentCoverData = result.picture;
	});
	parser.on('done', function(err) {
		stream.destroy();
		if (err) {
			findCoverInDirectory(songInfo, cb);
		} else {
			if (currentCoverData && currentCoverData.length) {
				cb(false, {
					data : currentCoverData[0]
				});
			} else {
				findCoverInDirectory(songInfo, cb);
			}
		}
	});
}

function updatePosition() {
	if (currentStatus.songInfo && currentStatus.songInfo.status == "playing") {
		currentStatus.songInfo.position = Math.floor((new Date() - currentStatus.songStarted) / 1000);
	}
}

var app = express.createServer();

app.get('/cover', function(req, res) {
	if (currentCover.path) {
		res.sendfile(currentCover.path);
	} else if (currentCover.data) {
		res.send(currentCover.data.data);
	}
});
app.use(express.static(WEBROOT));

var socket = io.listen(app, {
/* log : false */
});
app.listen(PORT);

socket.on('connection', function(client) {
	updatePosition();
	client.send(currentStatus);
});

var songinfofile = path.join(path.dirname(__filename), 'songinfo.properties');
fs.watchFile(songinfofile, {
	persistent : false,
	interval : 50
}, readSongStatus);
watch.watchTree(path.join(path.dirname(__filename), 'web'), function() {
	currentStatus.updated = true;
	update();
});
readSongStatus();

sys.log('Listening on port ' + PORT);