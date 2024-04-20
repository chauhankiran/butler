# Butler

Simple CRM System

The application is created in JavaScript/Node with Express framework. PostgreSQL database is used via postgres package.

## Prerequisites

You need following on your computer.

1. Node v20.x
2. Postgres 14+
3. Visual Studio Code (with Prettier Extension, Code Spell Checker, Thunder Client, Database Client)

## Getting Started

1. Clone the repo.
```
$ git clone https://github.com/chauhankiran/butler.git
```

2. Go inside the `butler` folder.
```
$ cd butler
```

3. Install the dependencies.
```
$ npm i
```

4. Run the database queries written in `scripts.sql` in PostgreSQL.
5. Rename `.env.example` to `.env` and update the environment variables defined in it.
6. Run the application
```sh
# run in development mode using nodemon
$ npm run dev

# run in production mode.
$ npm start
```
7. The application is up and running at http://localhost:3000.