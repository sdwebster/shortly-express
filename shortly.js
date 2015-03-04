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
  console.log('express handling / GET for homepage')
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  console.log('express handling /create GET')
  // do we have to add more here?
  res.render('index');
});

// when user clicks 'all links', send some json to
// Backbone to render prettily
app.get('/links', restrict,
function(req, res) {
  console.log('express handling /links GET')
  // why reset?
  Links.reset().fetch().then(function(links) {
    console.log('Here are all our links:', links.models);
    res.send(200, links.models);
  });
});

app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;
  console.log('express ng /links POST for uri', uri)

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
  console.log('express handling /signup POST');
  response.render('signup');
});

app.post('/signup', function(request, response) {
  console.log('express handling /signup POST');
  // escape these?
  var username = request.body.username;
  var password = request.body.password;

  // if user name exists
    // alert username exist- pick another name
    // redirrect to the sign up page
  // else
    // add user and password to databases (using bcrypt)
});

app.get('/login', function(request, response) {
  console.log('express handling /login GET');
  response.render('login');
});

app.post('/login', function(request, response) {
  console.log('express handling /login POST');
  // escape these?
  var username = request.body.username;
  var password = request.body.password;

  // improve this test - intstead of demo, query db
  if(username === 'demo' && password === 'demo'){
  // if username exists
    // test it and the password against the db
      // if it matches
        request.session.regenerate(function(){
        request.session.user = username;
        response.redirect('/');
      });
      // else
        // really good ux would tell the user how they messed up
        // response.redirect('/login');
  }
  else {
    // really good ux would tell the user how they messed up
    response.redirect('/login');
  }
});

app.get('/logout', function(request, response){
  console.log('express handling /logout GET');
  request.session.destroy(function(){
      response.redirect('/');
  });
});


// // we can probably add this 'restrict' keyword on other methods above

// app.get('/restricted', restrict, function(request, response){
//   response.send('This is the restricted area! Hello ' + request.session.user + '! click <a href="/logout">here to logout</a>');
// });

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

// takes a shortlyd synonym from user and looks for real url
// (not rewsctrictdded)
app.get('/*', function(req, res) {
  console.log('express handling /* wildcard GET for', req.params);
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
            // console.log('link:', link);
            console.log('redirect to', link.get('url'));
            // console.log('with href', res.request.href);

            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
