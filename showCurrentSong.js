sys = require('util');
path = require('path');
http = require('http');
express = require('express');
fs = require('fs');
io = require('socket.io');
url = require('url');
net = require('net');
musicmetadata = require('musicmetadata');

PORT = 50116;
WEBROOT = path.join(path.dirname(__filename), 'web/');
CONTROLPORT = 3333;

var currentStatus = {};
var currentCover = {};

function update() {
	updatePosition();
	socketio.sockets.emit('songStatus', currentStatus);
	delete currentStatus.updated;
}

// read file with song status, (old method, new method gets info over network)
function readSongStatus() {
	sys.log("Beginning reading new song info");
	fs.readFile(songinfofile, "binary", function(err, file) {
		if (!err) {
			var lines = file.split(/\r?\n/);
			var newSongInfo = {};
			for ( var x = 0; x < lines.length; x++) {
				var line = lines[x].split("=", 2);
				newSongInfo[line[0]] = line[1];
			}
			updateSongStatus(newSongInfo);
		}
	});
}

function handleInfoSocketData(data) {
	var dataStr = data + "";
	var lines = dataStr.split(/\r?\n/);
	for ( var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var parms = line.split(/\^/);
		var statusCode = parseInt(parms[0]);
		if (statusCode >= 110 && statusCode <= 120) {
			var newSongInfo = {};
			for ( var x = 0; x < parms.length; x++) {
				var arg = parms[x].split("=", 2);
				if (arg.length == 2) {
					newSongInfo[arg[0]] = arg[1];
				}
			}
			switch (statusCode) {
				case 111:
					newSongInfo.status = "playing";
					break;
				case 112:
					newSongInfo.status = "paused";
					break;
				case 113:
					newSongInfo.status = "paused";
					break;
			}
			newSongInfo.statuscode = statusCode;
			newSongInfo.position = parseFloat(parms[3]);
			//sys.log(JSON.stringify(newSongInfo));
			updateSongStatus(newSongInfo);
		}
	}
}

function updateSongStatus(newSongInfo) {
	sys.log("Got new song info");
	currentStatus.songStarted = new Date(new Date() - newSongInfo.position * 1000);
	currentStatus.songInfo = newSongInfo;
	var now = new Date();
	findCover(newSongInfo, function(err, cover) {
		if (cover) {
			currentCover = cover;
			currentStatus.coverUrl = "/cover?r=" + Math.random();
		} else {
			currentCover = false;
			delete currentStatus.coverUrl;
		}
		sys.debug("Took " + (new Date() - now) + "ms to find cover");
		update();
	});
}

function sendError(res, err) {
	res.writeHead(500);
	res.write("" + err);
	res.end();
}

function findCoverInDirectory(songInfo, cb) {
	var filePath = songInfo.path;
	var lastSlash = filePath.lastIndexOf('\\');
	if (lastSlash == -1) {
		lastSlash = filePath.lastIndexOf('/');
	}
	if (lastSlash == -1) {
		cb("No Cover Image found");
		return;
	}
	var dir = filePath.substr(0, lastSlash);
	fs.readdir(dir, function(err, files) {
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
					path : path.join(dir, image.file)
				});
			} else {
				cb("No Cover Image found " + files);
			}
		}
	});
}

function findCover(songInfo, cb) {
	if (!songInfo || !songInfo.path)
		return false;
	var currentCoverData = false;
	var stream = fs.createReadStream(songInfo.path);
	stream.on('error', function() {
		sys.log("Problem reading file metadata for " + songInfo.path);
		findCoverInDirectory(songInfo, cb);
	});
	var parser = new musicmetadata(stream);
	parser.on('metadata', function(result) {
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
app.get('/', function(req,res) {
	res.redirect('/index.html');
});
app.use(express.static(WEBROOT));

var socketio = io.listen(app, {
/* log : false */
});
app.listen(PORT);

socketio.sockets.on('connection', function(client) {
	updatePosition();
	sys.log("sending status");
	client.emit('songStatus', currentStatus);
});

var infoSock = new net.Socket();
var waitTime = 500;
infoSock.on('data', handleInfoSocketData);
infoSock.on('error', function(ex) {
	//sys.log('Problem while connecting the socket ' + ex);
});
infoSock.on('close', function() {
	waitTime = waitTime * 2;
	waitTime = Math.min(10000, waitTime);
	sys.log('Info Socket closed, waiting for ' + (waitTime / 1000) + 's then reconnecting');
	setTimeout(function() {
		infoSock.connect(CONTROLPORT);
	}, waitTime);
});
infoSock.connect(CONTROLPORT);


var songinfofile = path.join(path.dirname(__filename), 'songinfo.properties');
//fs.watch(songinfofile, readSongStatus);
fs.watch(path.join(path.dirname(__filename), 'web'), function() {
	currentStatus.updated = true;
	update();
});
//readSongStatus();

sys.log('Listening on port ' + PORT);