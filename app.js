require("dotenv").config();
const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const postgres = require("postgres");
const app = express();

// Database connection.
const sql = postgres({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  debug: console.log,
});

// Middleware.
app.use(morgan("tiny"));
app.use(cors());
app.use(helmet());
app.use(compression());

// Routes.
app.get("/", (req, res) => {
  res.json({ message: "Application is up and running!" });
});

// 404 error Handler.
app.all("*", (req, res) => {
  res.status(404).json({ error: "4-0-4" });
});

// Default error handler.
app.use((err, req, res, next) => {
  console.log(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Application is up and running on ${PORT} port!`);
});
