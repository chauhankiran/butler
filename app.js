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
  types: {
    date: {
      to: 1184,
      from: [1082, 1083, 1114, 1184],
      serialize: (date) => date,
      parse: (date) => new Date(date).toLocaleDateString(),
    },
  },
  debug: console.log,
});

// Middleware.
app.use(morgan("tiny"));
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

// Custom middleware.

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

// Get the user level permission.
const permission = async (req, res, next) => {
  try {
    const permission = await sql`
        select
          *
        from
          permissions
        where
          "isActive" = true
      `.then(([x]) => x);

    if (!permission) {
      return res.status(403).json({
        error: "Permission denied",
      });
    }

    // Do the required adjustments to shape the
    // permission.module.action object.
    req.permission = {
      companies: {
        access: permission.canAccessCompanies,
        read: permission.canReadCompanies,
        create: permission.canCreateCompanies,
        update: permission.canUpdateCompanies,
        remove: permission.canRemoveCompanies,
      },
    };

    next();
  } catch (err) {
    next(err);
  }
};

// Get the active fields for companies.
const fields = (module) => {
  return async (req, res, next) => {
    try {
      const moduleFields = await sql`
        select
          *
        from
          fields
        where
          "isActive" = true and
          module = ${module}
      `;

      // Do the required adjustments to fetch
      // the fields in pattern of
      // req.fields.module.name
      let fields = {};
      for (const moduleField of moduleFields) {
        fields[moduleField.name] = moduleField.displayName;
      }
      req.fields = {
        companies: fields,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};

// Check if the org has permission to
// run the "action" on given "module"
const orgCan = (action, module) => {
  return (req, res, next) => {
    // As both "module" and "action" are dynamic,
    // can't use . notation to get the values.
    if (!req.org[module][action]) {
      return res.status(403).json({
        error: `Permission denied: org can't ${action} ${module}`,
      });
    }

    next();
  };
};

// Check if the user has permission to
// run the "action" on given "module"
const userCan = (action, module) => {
  return (req, res, next) => {
    // As both "module" and "action" are dynamic,
    // can't use . notation to get the values.
    if (!req.permission[module][action]) {
      return res.status(403).json({
        error: `Permission denied: user can't ${action} ${module}`,
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

app.use("/", org, permission, (req, res, next) => {
  console.log("[org]: accessing org protected end-points");
  console.log("[permission]: accessing user protected end-points");
  next();
});

// Companies.
app.use(
  "/companies",
  orgCan("access", "companies"),
  userCan("access", "companies"),
  fields("companies"),
  (req, res, next) => {
    console.log("[companies]: accessing companies end-points");
    next();
  },
);

// GET http://localhost:3000/companies
app.get("/companies", orgCan("read", "companies"), userCan("read", "companies"), async (req, res, next) => {
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
  if (name && req.fields.companies.name) {
    whereQuery = sql`where name ilike ${name + "%"}`;
  }

  // active fields are going to be
  // fetched from the database.
  // TODO: Improve the implementation logic.
  let columns = [];
  if (req.fields.companies.id) {
    columns.push("id");
  }
  if (req.fields.companies.name) {
    columns.push("name");
  }
  if (req.fields.companies.createdAt) {
    columns.push("createdAt");
  }
  // if no fields are active, return
  // an error.
  if (columns.length === 0) {
    return res.status(400).json({
      error: "Terminated request: No fields are there to display",
    });
  }

  // The default page starts from 1 and due to this,
  // we're doing "-1" to offset 0 for the first page
  // and so on.
  const skip = ((page || 1) - 1) * take;

  try {
    const companies = await sql`
      select
        ${sql(columns)}
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
app.get("/companies/:id", orgCan("read", "companies"), userCan("read", "companies"), async (req, res, next) => {
  const { id } = req.params;

  // Check if the passed 'id' is number or not.
  if (!isNum(id)) {
    return res.status(400).json({
      error: "Id must be number",
    });
  }

  // active fields are going to be
  // fetched from the database.
  // TODO: Improve the implementation logic.
  let columns = [];
  if (req.fields.companies.id) {
    columns.push("id");
  }
  if (req.fields.companies.name) {
    columns.push("name");
  }
  if (req.fields.companies.createdAt) {
    columns.push("createdAt");
  }
  // if no fields are active, return
  // an error.
  if (columns.length === 0) {
    return res.status(400).json({
      error: "Request terminated: No fields are not activate",
    });
  }

  try {
    const company = await sql`
      select
        ${sql(columns)}
      from
        companies
      where
        id = ${id}
    `.then(([x]) => x);

    if (!company) {
      return res.status(404).json({
        error: `Company with id #${id} doesn't exists`,
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
app.post("/companies", orgCan("create", "companies"), userCan("create", "companies"), async (req, res, next) => {
  // Check the "body" fields. If unknown field
  // exist in req.body, return error.
  const fields = ["name"];
  const body = req.body || {};
  for (const [key, _] of Object.entries(body)) {
    if (!fields.includes(key)) {
      return res.status(400).json({
        error: `Bad request: ${key} doesn't exist`,
      });
    }
  }

  const { name } = req.body;

  // active fields are going to be
  // fetched from the database.
  // TODO: Improve the implementation logic.
  let companyObj = {};
  if (name) {
    if (req.fields.companies.name) {
      companyObj["name"] = name;
    } else {
      return res.status(400).json({
        error: `Request terminated: name field is not activate`,
      });
    }
  }
  // if no fields are active, return an error.
  // TODO: Improve the implementation logic.
  if (Object.keys(companyObj).length === 0) {
    return res.status(400).json({
      error: `Request terminated: No fields are not activate`,
    });
  }

  try {
    const company = await sql`
      insert into companies 
        ${sql(companyObj)}
      returning id
    `.then(([x]) => x);

    return res.status(201).json({
      data: company,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH http://localhost:3000/companies/:id
app.patch("/companies/:id", orgCan("update", "companies"), userCan("update", "companies"), async (req, res, next) => {
  // Check the "body" fields. If unknown field
  // exist in req.body, return error.
  const fields = ["name"];
  const body = req.body || {};
  for (const [key, _] of Object.entries(body)) {
    if (!fields.includes(key)) {
      return res.status(400).json({
        error: `Bad request: ${key} doesn't exist`,
      });
    }
  }

  const { id } = req.params;
  const { name } = req.body;

  // Check if the passed 'id' is number or not.
  if (!isNum(id)) {
    return res.status(400).json({
      error: "Id must be number",
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
        error: `Company with id #${id} doesn't exists`,
      });
    }
  } catch (err) {
    next(err);
  }

  // active fields are going to be
  // fetched from the database.
  // TODO: Improve the implementation logic.
  let companyObj = {};
  if (name) {
    if (req.fields.companies.name) {
      companyObj["name"] = name;
    } else {
      return res.status(400).json({
        error: `Request terminated: name field is not activate`,
      });
    }
  }
  // if no fields are active, return an error.
  // TODO: Improve the implementation logic.
  if (Object.keys(companyObj).length === 0) {
    return res.status(400).json({
      error: `Request terminated: No fields are not activate`,
    });
  }

  try {
    const company = await sql`
      update
        companies
      set
        ${sql(companyObj)}
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
app.delete("/companies/:id", orgCan("remove", "companies"), userCan("remove", "companies"), async (req, res, next) => {
  const { id } = req.params;

  // Check if the passed 'id' is number or not.
  if (!isNum(id)) {
    return res.status(400).json({
      error: "Id must be number",
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
        error: `Company with id #${id} doesn't exists`,
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
