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
app.use(express.json());

// Custom middleare.

// Get the org level permission.
const org = async (req, res, next) => {
  try {
    const org = await sql`
        select
          *
        from
          orgs
        where
          "isActive" = true
      `.then(([x]) => x);

    if (!org) {
      return res.status(403).json({
        error: "Permission denied",
      });
    }

    // Do the required adjustments to shape the
    // org.module.action object.
    req.org = {
      companies: {
        access: org.canAccessCompanies,
        read: org.canReadCompanies,
        create: org.canCreateCompanies,
        update: org.canUpdateCompanies,
        remove: org.canRemoveCompanies,
      },
    };

    next();
  } catch (err) {
    next(err);
  }
};

// Check if the org has permission to
// run the "action" on given "module"
const orgCan = (action, module) => {
  return (req, res, next) => {
    if (!req.org[module][action]) {
      return res.status(403).json({
        error: `Permission denined: user can't ${action} ${module}`,
      });
    }

    next();
  };
};

// Helpers
const isNum = (id) => {
  if (isNaN(id) || parseInt(id, 10) !== +id) {
    return false;
  }

  return true;
};

// Routes.
app.get("/", (req, res) => {
  res.json({ message: "Application is up and running!" });
});

app.use("/", org, (req, res, next) => {
  console.log("[org]: accessing org end-points");
  next();
});

// Companies.
app.use("/companies", orgCan("access", "companies"), (req, res, next) => {
  console.log("[companies]: accessing companies end-points");
  next();
});

// GET http://localhost:3000/companies
app.get("/companies", orgCan("read", "companies"), async (req, res, next) => {
  const { limit, page, name } = req.query;

  // 'take' per page.
  // We should not allow user to pass negative
  // number of records. Also, for the better
  // performance, we have set the upper limit to
  // 100.
  let take = limit || 10;
  if (limit < 0 || limit > 100) {
    take = 10;
  }

  // Search by name.
  let whereQuery = sql``;
  if (name) {
    whereQuery = sql`where name ilike ${name + "%"}`;
  }

  // The default page starts from 1 and due to this,
  // we're doing "-1" to offset 0 for the first page
  // and so on.
  const skip = ((page || 1) - 1) * take;

  try {
    const companies = await sql`
      select
        *
      from
        companies
      ${whereQuery}
      limit ${take}
      offset ${skip}
    `;

    return res.json({
      data: companies,
    });
  } catch (err) {
    next(err);
  }
});

// GET http://localhost:3000/companies/:id
app.get("/companies/:id", orgCan("read", "companies"), async (req, res, next) => {
  const { id } = req.params;

  // Check if the passed 'id' is number or not.
  if (!isNum(id)) {
    return res.status(400).json({
      error: "Id must be number.",
    });
  }

  try {
    const company = await sql`
      select
        *
      from
        companies
      where
        id = ${id}
    `.then(([x]) => x);

    if (!company) {
      return res.status(404).json({
        error: `Company with id #${id} doesn't exists.`,
      });
    }

    return res.json({
      data: company,
    });
  } catch (err) {
    next(err);
  }
});

// POST http://localhost:3000/companies
app.post("/companies", orgCan("create", "companies"), async (req, res, next) => {
  const { name } = req.body;

  try {
    const company = await sql`
      insert into companies (
        name
      ) values (
        ${name}
      ) returning id
    `.then(([x]) => x);

    return res.status(201).json({
      data: company,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH http://localhost:3000/companies/:id
app.patch("/companies/:id", orgCan("update", "companies"), async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  // Check if the passed 'id' is number or not.
  if (!isNum(id)) {
    return res.status(400).json({
      error: "Id must be number.",
    });
  }

  // Before updating the company,
  // check if the company exists or not.
  try {
    const company = await sql`
      select
        id
      from
        companies
      where
        id = ${id}
    `.then(([x]) => x);

    if (!company) {
      return res.status(404).json({
        error: `Company with id #${id} doesn't exists.`,
      });
    }
  } catch (err) {
    next(err);
  }

  try {
    const company = await sql`
      update
        companies
      set
        name = ${name}
      where
        id = ${id}
      returning id
    `.then(([x]) => x);

    return res.json({
      data: company,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE http://localhost:3000/companies/:id
app.delete("/companies/:id", orgCan("remove", "companies"), async (req, res, next) => {
  const { id } = req.params;

  // Check if the passed 'id' is number or not.
  if (!isNum(id)) {
    return res.status(400).json({
      error: "Id must be number.",
    });
  }

  // Before deleting the company,
  // check if the company exists or not.
  try {
    const company = await sql`
      select
        id
      from
        companies
      where
        id = ${id}
    `.then(([x]) => x);

    if (!company) {
      return res.status(404).json({
        error: `Company with id #${id} doesn't exists.`,
      });
    }
  } catch (err) {
    next(err);
  }

  try {
    const company = await sql`
      delete from
        companies
      where
        id = ${id}
      returning id
    `.then(([x]) => x);

    return res.json({
      data: company,
    });
  } catch (err) {
    next(err);
  }
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
