Smart Media Display - Show Current Song
============================================

The showCurrentSong application is a node.js based application which shows the song currently
playing in your media player along with it's cover art and the current time.
The data about the song is updated near real time using socket.io push APIs.
The website actually displaying the data is served through express.

![Screenshot](https://github.com/FrzMe/smartdisplay-media/blob/master/Screenshot.png?raw=true "The webapp showing a playing song")

Getting it to work
-------------------------------------------
The script currently has two methods to retrieve the current Song data:

1. The currently preferred method is to have your mediaplayer listen on a given port and send information about the current song as soon as it changes.
   The information needs to be send in a new line terminated text based format. The syntax for each line is this: `(propertyName=propertyValue)*`. <br>
   Conveniently the foo_controlserver component for foobar 2000 does exactly that when configured with the following fields String
   `codec=%codec%^bitrate=%bitrate%^artist=$if(%album artist%,%album artist%,%artist%)^album=%album%^year=%date%^genre=%genre%^track=%tracknumber%^title=%title%^path=%path%^length=%length_seconds%`, UTF8 output checked and `Base Delimiter` set to ^
2. Alternatively it is possible to have the script read (and monitor) a properties file (by default songinfo.properties in the same folder as the script, a sample songinfo.properties is provided in the repo) with information about the current song. 

For both options the following property keys should be present:

 * `status` or `statuscode`, status should have the values "playing" "stopped" or "paused" where statuscode has the values 111, 112 or 113 respectively
 * `artist`
 * `album`
 * `year`
 * `genre`
 * `track` (tracknumber within the album)
 * `title`
 * `path` (complete path of the media file, including the filename)
 * `position` (position in seconds within the file, con be ommited when using option 1)
 * `length` (length of the song in seconds)
 
 Required npm modules
-------------------------------------------
You'll need `express`, `musicmetadata` and `socket.io`