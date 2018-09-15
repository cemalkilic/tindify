var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var index  = require('./routes/index');

var passport = require('passport');
var SpotifyStrategy = require('passport-spotify').Strategy;

var app = express();

app.engine('.hbs', exphbs({extname: '.hbs',
  defaultLayout: 'main' }));
app.set('view engine', '.hbs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true
}));

var client_id = process.env.SPOTIFY_KEY;
var client_secret = process.env.SPOTIFY_SECRET;
var callbackURL = process.env.SPOTIFY_CALLBACK_URI;

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(user, done) {
	done(null, user);
});

passport.use(new SpotifyStrategy({
    clientID: client_id,
    clientSecret: client_secret,
    callbackURL: callbackURL
  },
  function(accessToken, refreshToken, profile, done) {
    // User.findOrCreate({ spotifyId: profile.id }, function (err, user) {
    //   return done(err, user);
    console.log(profile);
    var user = profile;
    user.token = accessToken;
	return done(null, user);
  }
));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', index.home);
app.get('/login',
	passport.authenticate('spotify', {scope: 'user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-read-private'}),
	index.login);
app.get('/authed',
    passport.authenticate('spotify', {scope: 'user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-read-private'}),
    index.authed);
app.get('/getPlaylist', ensureAuthenticated, index.getPlaylist)
app.get('/getUserPlaylists', ensureAuthenticated, index.getUserPlaylists);
app.get('/playSong', ensureAuthenticated, index.playSong);
app.get('/getTracks/:playlistID', ensureAuthenticated, index.getTracks);
app.get('/getRandomPlaylist', ensureAuthenticated, index.getRandomPlaylist);

app.post('/skipSong', index.skipSong);
app.post('/addSong', index.addSong);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/getPlaylist');
}

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Application running on port:", PORT);
});
