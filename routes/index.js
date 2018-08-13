var url = require('url');
var path = require('path');
var querystring = require('querystring');
var https = require('https');
var request = require('request');
var session = require('express-session');

var PLAYLIST_NAME = "Tindify";

var routes = {};

/* Homepage (/) */
routes.home = function(req, res) {
  res.render('home', {title: 'Tindify'});
}

/**
 * Callback URI for when the user is logged in.
 */
routes.authed = function(req, res) {
  res.redirect('/getPlaylist');
}

/**
 * The first step of the swipe-prep process.
 * Sets the session variable pID to be the ID of the user's Tindify playlist.
 * If the user does not have a Tindify playlist, create one.
 * After retrieving the playlist ID, redirect to /findSongs
 */
routes.getPlaylist = function(req, res) {
  console.log("ID: " + req.user.id);
  var uID = req.user.id;
  console.log("The bearer token: " + req.user.token);
  var playlistsOptions = {
    url: 'https://api.spotify.com/v1/users/'+uID+'/playlists',
    headers: { Authorization: 'Bearer ' + req.user.token}
  };
  request.get(playlistsOptions, function(perror, presponse, pbody) {
    pbody = JSON.parse(pbody);
    var correct = pbody.items.filter(function(p) {
      return p.name == PLAYLIST_NAME
    });
    
    if (correct.length) {
      // If the playlist already exists, then log its id and redirect to the next step.
      req.session.pID = correct[0].id;
      res.redirect('/findSongs');
    } else {
      // Otherwise, create a new playlist (POST request), log its id, and redirect.
      var newPlaylistOptions = {
        url: 'https://api.spotify.com/v1/users/'+uID+'/playlists',
        headers: {
          Authorization: 'Bearer ' + req.user.token,
          "Content-Type": "application/json" },
         body: JSON.stringify({'name': PLAYLIST_NAME}),
         dataType: 'json' };
      console.log(newPlaylistOptions);
      request.post(newPlaylistOptions, function(nerror, nresponse, nbody) {
        req.session.pID = JSON.parse(nbody).id;
        res.redirect('/findSongs');
      });
    }
  });
}

// Randomly select one element from an array.
var randomChoice = function(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Find the IDs of several tracks,
 * and store them in the session under req.session.tracks.
 * Then redirect to actually playing songs!
 * We hates how big this function is.
 */
routes.findSongs = function(req, res) {
    // 1. Get a random playlist from the user's followed/owned playlists.
    var playlistOptions = {
      url: 'https://api.spotify.com/v1/me/playlists',
      headers: { Authorization: 'Bearer ' + req.user.token }
    };
    request.get(playlistOptions, function (perror, presponse, pbody) {
      var playlists = JSON.parse(pbody).items;
      var playlist = randomChoice(playlists);
      var playlistURL = playlist.href;
      req.session.playlistName = playlist.name;
      console.log("USING PLAYLIST: " + JSON.stringify(playlistURL));
      console.log("AKA: " + req.session.playlistName);

      // 2. Get the full list of tracks from that playlist
      var tracksOptions = {
        url: playlistURL + '/tracks',
        headers: { Authorization: 'Bearer ' + req.user.token }
      };

      request.get(tracksOptions, function (terror, tresponse, tbody) {
        var tracks = JSON.parse(tbody).items;
        tracks = selectTracks(tracks);

        // api needs the track ids as comma seperated string
        var tracksAsCommaSep= tracks.join(",");

        // 3. Get the recommendations
        var recomOptions = {
          url: "https://api.spotify.com/v1/recommendations",
          headers: { Authorization: 'Bearer ' + req.user.token },
          qs: {"seed_tracks": tracksAsCommaSep}
        };
        request.get(recomOptions, function(rerror, rresponse, rbody) {
          rbody = JSON.parse(rbody).tracks;
          // get the links of the recommended songs
          tracks = (rbody.map(function (t) {return t.href}));
          req.session.tracks = tracks;
          res.redirect('/playSong');
        })
      });
    })
}

/**
 * Selects random five tracks from the list.
 * If the list contains less than 5 tracks,
 * return all.
 */
var selectTracks = function(trackList) {
    if(trackList.length >= 5) {
        var selectedTracks = new Set();
        while(selectedTracks.size !== 5) {
            var track = randomChoice(trackList);
            selectedTracks.add(track);
        }
        return Array.from(selectedTracks, function (t) {return t.track.id});
    } else {
        return trackList.map(function (t) {return t.track.id});
    }
}

/**
 * Play the zeroeth track of req.session.tracks.
 */
routes.playSong = function(req, res) {
  console.log("THE ID IS...." + req.session.pID)
  var trackOptions = {
    url: req.session.tracks[0],
    headers: { Authorization: 'Bearer ' + req.user.token }
  };
  request.get(trackOptions, function (terror, tresponse, tbody) {
    tbody = JSON.parse(tbody);
    console.log("NAME: " + tbody.name);
    var artists = tbody.artists.map(function(a) {return a.name}).join(', ');
    res.render('playSong', {
      trackName: tbody.name,
      artistName: artists,
      previewURL: tbody.preview_url,
      playlistName: req.session.playlistName
    });
  });
}

/**
 * Add the zeroeth track from session to the user's Tindify playlist.
 */
routes.addSong = function(req, res) {
  console.log("Adding a song!");
  uID = req.user.id;
  pID = req.session.pID;

  // Get the URI of the track
  var getURIOptions = {
    url: req.session.tracks[0],
    headers: { Authorization: 'Bearer ' + req.user.token }
  }
  request.get(getURIOptions, function(uerror, uresponse, ubody) {
    ubody = JSON.parse(ubody);
    var uri = ubody.uri;

    // POST request to add the track
    var addTrackOptions = {
      url: 'https://api.spotify.com/v1/users/'+uID+'/playlists/'+pID+'/tracks',
      headers: {
        Authorization: 'Bearer ' + req.user.token,
        "Content-Type": "application/json" },
      body: JSON.stringify({'uris': [uri]}),
      dataType: 'json' };
    request.post(addTrackOptions, function(aerror, aresponse, abody) {
      res.end();  
    });
  });
}

/**
 * Skip this track...
 * ...or more aptly, just remove this track from the queue.
 * Send back the number of songs remaining. That way 
 */
routes.skipSong = function(req, res) {
  console.log("Skipping a song!");
  req.session.tracks = req.session.tracks.slice(1);
  res.end(String(req.session.tracks.length));
}

routes.login = function(req, res) {};

module.exports = routes;
