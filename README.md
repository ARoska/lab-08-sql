### City Explorer

**Author**: Andrew Roska
**Version**: 1.0.0

## Overview
City Exploerer is an app that you can use to search for a city and find the local map, current weather report, good eats in the area, movies relevant to the city, great hiking opportunities, and meetup events.

## Getting Started
This app is back-end only.  To use it, you will need to:
  --Clone the repo and install dependencies
  --Create a DB in PostgreSQL called city_explorer by entering the following command in psql ```CREATE DATABASE city_explorer;```
  --Create the DB tables via the following command in the terminal ```psql -f city_explorer -d schema.sql```
  --Open nodemon
Then, point your browser to https://codefellows.github.io/city_explorer/ and input your hosting port (3000 by default).

## Architecture
This app is written in JavaScript and accessed via Node in the terminal.  The dependencies are:
  --Express (For handling app heavy lifting)
  --SuperAgent (For handling API requests)
  --CORS (For allowing communication with the APIs)
  --Postgress (pg, for DB creation and maintenance)

## Credits and Collaborations
Thanks to:
  --Ian Gifford (https://github.com/IanGifford261)
  --Liz (https://github.com/lizkavalski)