/*
Basic connect server using connect middleware and SQLite database.
Here we query the database to find song details that a user
can request through a query like http://localhost:3000/find?title=Love

This is an Express 4.x application
Note to change this to an express application from Node.js/connect 
just required two lines of change:
require('express') instead of require('connect')
and app = express() rather than app = connect()

This is because express uses, and exposes all the capabilities 
of the connect dispatcher.

This example assumes a data/db_1200iRealSongs exists.

requires npm modules:
express
sqlite3

Application of middleware example:
Here we register middleware to do http 401 'BASIC' authentication.

When the browser receives a 401 status response with a
'WWW-Authenticate' header set it will prompt the user
for a userid and password. The userid:password string will then
be "scrambled" as a base64 encoding will be sent with each
subsequent request.

Here our authenticate middleware will determine it an authorization
header is included with the client request, and if not send a 401 authenticate
response. (The browser should then prompt the user for the userid and password.

If an authorization header is present the userid and password is decoded and
checked against valid users before  proceeding to middleware that serve pages 

Here our users are in an sqlite3 database.
API for using sqlite3 API: https://github.com/mapbox/node-sqlite3/wiki/API

Once users are authenticated the can visit /users.html to see all the users
and visit /find.html?title=Girl to find all the songs that have 'Girl' in the
title.
*/

//Cntl+C to stop server (in Windows CMD console)



var http = require('http');
var express = require('express');
var sqlite3 = require('sqlite3').verbose(); //verbose provides more detailed stack trace
var url = require('url');

var db = new sqlite3.Database('data/db_1200iRealSongs');
var  app = express(); //create express middleware dispatcher
var urlObj; //we will parse user GET URL's into this object

//Define middleware functions
/*
function(request, response, next){
   //request is the http request object
   //response is the http response object
   //next is the next-in-line middeware that needs to be called
   //this function should either respond to the client -ending the
   //middleware chain, or call next()
}
*/

//add a user table to database
//serialize ensures the queries are presented to database serially.
  db.serialize(function(){
      var sqlString = "CREATE TABLE IF NOT EXISTS users (userid TEXT PRIMARY KEY, password TEXT)";
      db.run(sqlString);
      sqlString = "INSERT OR REPLACE INTO users VALUES ('ldnel', 'secret')";
      db.run(sqlString);
      sqlString = "INSERT OR REPLACE INTO users VALUES ('frank', 'secret2')";
      db.run(sqlString);  
  });


function methodLogger(request, response, next){           
		   console.log("");
		   console.log("================================");
		   console.log("Console Logger:");
		   console.log("METHOD: " + request.method);
		   console.log("URL:" + request.url);
		   next(); //call next middleware registered
}

function headerLogger(request, response, next){           
		   console.log("Headers:")
           for(k in request.headers) console.log(k);
		   next(); //call next middleware registered
}

function authenticate(request, response, next){
    /*
	Middleware to do BASIC http 401 authentication
	*/
    var auth = request.headers.authorization;
	// auth is a base64 representation of (username:password) 
	//so we will need to decode the base64 
	if(!auth){
 	 	//note here the setHeader must be before the writeHead
		response.setHeader('WWW-Authenticate', 'Basic realm="need to login"'); 
        response.writeHead(401, {'Content-Type': 'text/html'});
		console.log('No authorization found, send 401.'); 
 		response.end();  
	}
	else{
	    console.log("Authorization Header: " + auth);
        //decode authorization header
		// Split on a space, the original auth 
		//looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part 
        var tmp = auth.split(' ');   		
		
		// create a buffer and tell it the data coming in is base64 
        var buf = new Buffer(tmp[1], 'base64'); 
 
        // read it back out as a string 
        //should look like 'ldnel:secret'		
		var plain_auth = buf.toString();    
        console.log("Decoded Authorization ", plain_auth); 
		
        //extract the userid and password as separate strings 
        var credentials = plain_auth.split(':');      // split on a ':' 
        var username = credentials[0]; 
        var password = credentials[1]; 
        console.log("User: ", username); 
        console.log("Password: ", password); 
		
		var authorized = false;
		//check database users table for user
		db.all("SELECT userid, password FROM users", function(err, rows){
		for(var i=0; i<rows.length; i++){
		      if(rows[i].userid == username & rows[i].password == password) authorized = true;		     
		}
		if(authorized == false){
 	 	   //we had an authorization header by the user:password is not valid
		   response.setHeader('WWW-Authenticate', 'Basic realm="need to login"'); 
           response.writeHead(401, {'Content-Type': 'text/html'});
		   console.log('No authorization found, send 401.'); 
 		   response.end();  
		}
        else
		  next();				
		});
	}

	//notice no call to next()
  
}

function respondToClient(request, response, next){
    response.end();
	//notice no call to next()
  
}

function addHeader(request, response, next){
        // about.html
        var title = 'COMP 2406:';
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write('<!DOCTYPE html>');
        response.write('<html><head><title>About</title></head>' + '<body>');
        response.write('<h1>' +  title + '</h1>');
		response.write('<hr>');
		next();
}
function addFooter(request, response, next){
 		response.write('<hr>');
		response.write('<h3>' +  'Carleton University' + '</h3>');
		response.write('<h3>' +  'School of Computer Science' + '</h3>');
        response.write('</body></html>');
		next();

}
function getUsersPage(request, response, next){
        // users.html
		console.log("RUNNING ADD USERS");
        response.write('<h2>' +  'USERS' + '</h2>');
		db.all("SELECT userid, password FROM users", function(err, rows){
		  for(var i=0; i<rows.length; i++){
              console.log(rows[i].userid + ": " + rows[i].password);
			   response.write('<p>' + rows[i].userid + ": " + rows[i].password + '</p>');
		     
		  }
          next();		  
		});

}

function parseURL(request, response, next){
	var parseQuery = true; //parseQueryStringIfTrue 
    var slashHost = true; //slashDenoteHostIfTrue 
    urlObj = url.parse(request.url, parseQuery , slashHost );
    console.log('path: ' + urlObj.path);
    console.log('query: ' + urlObj.query);	
    for(x in urlObj.query) console.log(x + ': ' + urlObj.query[x]);
	next();

}

function findSongsPage(request, response, next){
        // find.html
		console.log("RUNNING FIND SONGS");
		
		var sql = "SELECT id, title FROM songs";

        if(urlObj.query['title']) {
		    console.log("finding title: " + urlObj.query['title']);
		    sql = "SELECT id, title FROM songs WHERE title LIKE '%" + 
			          urlObj.query['title'] + "%'"; 			
		}		

        response.write('<h2>' +  'SONGS' + '</h2>');
        response.write('<ul>');
		db.all(sql, function(err, rows){
		  for(var i=0; i<rows.length; i++){
			   response.write('<li><a href=' + 'song/' + rows[i].id + '>' + rows[i].title + '</a></li>');		     
		  }
          response.write('</ul>');
          next();		  
		});

}
function getSongDetails(request, response, next){
        
        var songID = urlObj.path; //expected form: /song/235
		songID = songID.substring(songID.lastIndexOf("/")+1, songID.length);
		var sql = "SELECT id, title, composer, key, bars FROM songs WHERE id=" + songID;
        console.log("GET SONG DETAILS: " + songID );
        response.write('<h2>' +  'SONG DETAILS:' + '</h2>');
		db.all(sql, function(err, rows){
		  for(var i=0; i<rows.length; i++){
			   response.write('<p><strong> title: ' + rows[i].title  + '</strong></p>');		     
			   response.write('<p> composer: ' + rows[i].composer  + '</p>');		     
			   response.write('<p> key: ' + rows[i].key + '</p>');		     
			   response.write('<p> bars: ' + rows[i].bars + '</p>');		     
		  }
          next();		  
		});

}
		
 function getIndexPage(request, response, next){
        // about.html
        var page = 'Index:';
        response.write('<h1>' +  page + '</h1>');
        response.write('<p>' +  'Using npm express module and middleware'  + '</p>');
        response.write('<p>' +  'Example of using sqlite relational database'  + '</p>');
 		
		next();
		}

//register middleware with dispatcher
//ORDER MATTERS HERE
//app.use(methodLogger); 
//app.use(headerLogger);
app.use(parseURL);
app.use(authenticate); //authenticate user
app.use(addHeader);
app.use('/users', getUsersPage);
app.use('/find', findSongsPage);
app.use('/song', getSongDetails);
app.use('/index.html', getIndexPage);
app.use(addFooter);
app.use(respondToClient);

//create http-express server
http.createServer(app).listen(3000);

console.log('Server Running at http://127.0.0.1:3000  CNTL-C to quit');
