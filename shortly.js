var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

// libraries for authentication
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


// for authentication
app.use(cookieParser());
app.use(session({secret: 'i like lionel richie'}));

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};

app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  // do we have to add more here?
  res.render('index');
});

// when user clicks 'all links', send some json to
// Backbone to render prettily
app.get('/links', restrict,
function(req, res) {
  // why reset?
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

// let user create new link
app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        console.log('making new Link with url', uri);
        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', function(request, response){
  response.render('signup');
});

app.post('/signup', function(request, response) {
  // escape these?
  var username = request.body.username;
  var password = request.body.password;

  // if user name exists
  new User({username: username}).fetch().then(function(user){
    if (user){
      // redirect to the sign up page
      response.redirect('/signup');
    } else {
      // add user and password to databases (using bcrypt)
      var thisEncryptedPassword = bcrypt.hash(password, null, null, function(err, hash){
        var newUser = new User({
          username: username,
          encryptedPassword: hash
        });
        // why do we have to both save and add?
        newUser.save().then(function(newUser){
          Users.add(newUser);
          // better ux would log user in automatically
          response.redirect('/login');
        });
      });
    }
  })
});

app.get('/login', function(request, response) {
  response.render('login');
});

app.post('/login', function(request, response) {
  // escape these?
  var username = request.body.username;
  var password = request.body.password;

  // improve this test - intstead of demo, query db
  // if(username === 'demo' && password === 'demo'){

  new User( { username: username } ).fetch().then(function(user){
    // console.log(user);
    console.log(user.get('encryptedPassword'));
    // if username exists
    if( user ){
      bcrypt.compare(password, user.get('encryptedPassword'), function(err, res){
        if (err){
          throw err;
        } else {
          if (res){
            // valid user and password
            request.session.regenerate(function(){
              request.session.user = username;
              console.log('Welcome, ' + username);
              response.redirect('/');
            });
          } else {
            // invalid user and password
            // better ux would tell the user how they messed up
            response.redirect('/login');
          }
        }
      });

    } else {
      // no such user
      // better ux would tell the user how they messed up
      response.redirect('/login');
    }
  });
});

app.get('/logout', function(request, response){
  request.session.destroy(function(){
      response.redirect('/');
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            console.log('redirect to', link.get('url'));
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
