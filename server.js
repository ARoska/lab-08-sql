'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const pg = require('pg');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes
app.get('/location', (request, response) => {
  getLocation(request.query.data)
    .then(location => {
      // console.log('27', location);
      response.send(location)
    })
    .catch(error => handleError(error, response));
})

app.get('/weather', getWeather);

app.get('/meetups', getMeetups);

app.get('/trails', getTrails);

app.get('/movies', getMovies);

app.get('/yelp', getYelps);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// *********************
// MODELS
// *********************

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.formatted_address;
  this.latitude = res.geometry.location.lat;
  this.longitude = res.geometry.location.lng;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

function Meetup(meetup) {
  // this.tableName = 'meetups';
  this.link = meetup.link;
  this.name = meetup.group.name;
  this.creation_date = new Date(meetup.group.created).toString().slice(0, 15);
  this.host = meetup.group.who;
  // this.created_at = Date.now();
}

function Trail(trail) {
  this.trail_url = trail.url;
  this.name = trail.name;
  this.location = trail.location;
  this.length = trail.length;
  this.condition_date = trail.conditionDate.slice(0, 10);
  this.condition_time = trail.conditionDate.slice(11, 19);
  this.conditions = trail.conditionStatus;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
  this.summary = trail.summary;
}

function Movie(movie) {
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = `https://image.tmdb.org/t/p/w185/${movie.poster_path}`;
  this.overview = movie.overview
}

function Yelp(yelp) {
  this.url = yelp.url;
  this.name = yelp.name;
  this.rating = yelp.rating;
  this.price = yelp.price;
  this.image_url = yelp.image_url
}

// *********************
// HELPER FUNCTIONS
// *********************

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

function getLocation(query) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [query];

  // Make the query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        return result.rows[0];

        // Otherwise get the location information from the Google API
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

        return superagent.get(url)
          .then(data => {
            // Throw an error if there is a problem with the API request
            if (!data.body.results.length) { throw 'no Data' }

            // Otherwise create an instance of Location
            else {
              let location = new Location(query, data.body.results[0]);

              // Create a query string to INSERT a new record with the location data
              let newSQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING id;`;
              let newValues = Object.values(location);
              // Add the record to the database
              return client.query(newSQL, newValues)
                .then(result => {
                  // Attach the id of the newly created record to the instance of location.
                  // This will be used to connect the location to the other databases.
                  location.id = result.rows[0].id;
                  return location;
                })
                .catch(console.error);
            }
          })
          .catch(error => console.log('Error in SQL Call'));
      }
    });
}

function getWeather(request, response) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM weathers WHERE location_id=$1`
  const values = [request.query.data.id];

  // Make a query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        response.send(result.rows);
      // Otherwise get the from Dark Sky
      } else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        superagent.get(url)
          .then(result => {
            const weatherSummaries = result.body.daily.data.map(day => {
              const summary = new Weather(day);
              return summary;
            });
            let newSQL = `INSERT INTO weathers(forecast, time, location_id) VALUES ($1, $2, $3);`;
            weatherSummaries.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              // Add the record to the database
              return client.query(newSQL, newValues)
            })
            response.send(weatherSummaries);
          })
      }
    })
}

function getMeetups(request, response) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM meetups WHERE location_id=$1;`;
  const values = [request.query.data.id];

  // Make a query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        response.send(result.rows);
      // Otherwise get the data from Meetups
      } else {
        const url = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${request.query.data.longitude}&page=20&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`

        superagent.get(url)
          .then(result => {
            const meetups = result.body.events.map(meetup => {
              const event = new Meetup(meetup);
              return event;
            });
            let newSQL = `INSERT INTO meetups(link, name, creation_date, host, location_id) VALUES ($1, $2, $3, $4, $5);`;
            meetups.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              // Add the record to the database
              return client.query(newSQL, newValues)
            })
            response.send(meetups);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getTrails (request, response) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM trails WHERE location_id=$1;`;
  const values = [request.query.data.id];

  // Make a query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        response.send(result.rows);
      // Otherwise get the data from Trails
      } else {
        const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&key=${process.env.HIKING_API_KEY}`
        superagent.get(url)
          .then(result => {
            const trails = result.body.trails.map(trail => {
              const newTrail = new Trail(trail);
              return newTrail;
            });
            let newSQL = `INSERT INTO trails(trail_url, name, location, length, condition_date, condition_time, conditions, stars, star_votes, summary, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`;
            trails.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              // Add the record to the database
              return client.query(newSQL, newValues)
            })
            response.send(trails);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getMovies(request, response) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
  const values = [request.query.data.id];

  // Make a query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        response.send(result.rows);
      // Otherwise get the data from Movies
      } else {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIEDB_API_KEY}&language=en-US&query=${request.query.data.search_query}&page=1&include_adult=false`

        superagent.get(url)
          .then(result => {
            const movies = result.body.results.map(movie => {
              const newMovie = new Movie(movie);
              return newMovie;
            });
            let newSQL = `INSERT INTO movies(title, released_on, total_votes, average_votes, popularity, image_url, overview, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
            movies.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              // Add the record to the database
              return client.query(newSQL, newValues)
            })
            response.send(movies);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getYelps(request, response) {
  // CREATE the query string to check for thexistence of the location
  const SQL = `SELECT * FROM yelps WHERE location_id=$1;`;
  const values = [request.query.data.id];

  console.log('321', SQL);
  // Make a query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        response.send(result.rows);
      // Otherwise get the data from Yelp
      } else {
        const url = `https://api.yelp.com/v3/businesses/search?term=delis&latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`

        superagent.get(url)
          .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
          .then(result => {
            const yelps = result.body.businesses.map(yelp => {
              const event = new Yelp(yelp);
              return event;
            });
            let newSQL = `INSERT INTO yelps(url, name, rating, price, image_url, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
            console.log('342', yelps);
            yelps.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              // Add the record to the database
              return client.query(newSQL, newValues)
            })
            response.send(yelps);
          })
          .catch(error => handleError(error, response));
      }
    })
}
