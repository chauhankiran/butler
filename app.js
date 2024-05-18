require("dotenv").config();
const crypto = require("crypto");
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

// Auth: Check if the user is authenticated
// or not via passed header token - Authorization.
const auth = async (req, res, next) => {
  const authorization = req.get("Authorization");

  if (!authorization) {
    return res.status(400).json({ error: "Authorization token is required" });
  }

  const [token, userId] = authorization.split("-");
  if (!token || !userId) {
    return res.status(400).json({ error: "Corrupted token" });
  }

  try {
    const user = await sql`
      select
        *
      from
        tokens
      where
        "userId" = ${userId} and 
        token = ${token}
    `.then(([x]) => x);

    if (!user) {
      return res.status(400).json({ error: "Invalid token" });
    }

    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware: Get the org level permission.
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

// Middleware: Get the user level permission.
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

// Middleware: Get the active fields for companies.
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

// Middleware: Check if the org has permission to
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

// Middleware: Check if the user has permission to
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

// Helper: Check if the given parameter
// is number or not.
const isNum = (id) => {
  if (isNaN(id) || parseInt(id, 10) !== +id) {
    return false;
  }

  return true;
};

// Helper: Check if the company
// exists or not based on passed id.
const isCompanyExists = async (id) => {
  return await sql`
    select
      id
    from
      companies
    where
      id = ${id}
  `.then(([x]) => x);
};

// Helper: Generate SHA256 has for the given value.
const generateSHA256 = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

// Helper: Generate random string of length 2 * size.
const generateRandom = (size) => {
  return crypto.randomBytes(size).toString("hex");
};

// Routes.
app.get("/", (req, res) => {
  res.json({ message: "Application is up and running!" });
});

// Auth.
app.use("/auth", (req, res, next) => {
  console.log("[auth]: accessing auth protected end-points");
  next();
});

// POST http://localhost:3000/auth/login
app.post("/auth/login", async (req, res, next) => {
  const { email, password } = req.body;

  // Single and guided validation.
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  const passwordHash = generateSHA256(password);

  try {
    // Check first the email.
    // User with given email is exist or not.
    const user = await sql`
      select
        *
      from
        users
      where
        email = ${email}
    `.then(([x]) => x);

    if (!user) {
      return res.status(400).json({ error: "Email is incorrect" });
    }

    // If user is found with given email,
    // then check for the hashed password
    // and then generate token.
    if (user.password === passwordHash) {
      const token = generateRandom(32);

      // Save the created token into database
      // for future check up to validate the
      // protected route requests.
      await sql`
        insert into tokens (
          "userId",
          token
        ) values (
          ${user.id},
          ${token}
        ) returning id
      `.then(([x]) => x);

      return res.json({ token: `${token}-${user.id}` });
    } else {
      return res.status(400).json({ error: "Password is incorrect" });
    }
  } catch (err) {
    next(err);
  }
});

// POST http://localhost:3000/auth/register
app.post("/auth/register", async (req, res, next) => {
  const { email, password } = req.body;

  // Single and guided validation.
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const passwordHash = generateSHA256(password);

  try {
    const user = await sql`
      insert into users (
        email,
        password
      ) values (
        ${email},
        ${passwordHash}
      ) returning id
    `.then(([x]) => x);

    const token = generateRandom(32);

    // Save the created token into database
    // for future check up to validate the
    // protected route requests.
    await sql`
      insert into tokens (
        "userId",
        token
      ) values (
        ${user.id},
        ${token}
      ) returning id
    `.then(([x]) => x);

    return res.json({ token: `${token}-${user.id}` });
  } catch (err) {
    next(err);
  }
});

app.use("/", auth, org, permission, (req, res, next) => {
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
  const { limit, page, name, withHeaders } = req.query;

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

  // The fields in list of companies
  // now fetched from 'views'.
  let columns = [];
  // TODO: conditionally add headers. As of now,
  // without withHeaders also run the headers related code.
  let headers = [];
  try {
    const views = await sql`
      select
        field
      from
        views
      where
        module = 'companies'
    `;

    for (const view of views) {
      if (view.field === "id") {
        if (req.fields.companies.id) {
          columns.push("id");
          headers.push(req.fields.companies.id);
        }
      }

      if (view.field === "name") {
        if (req.fields.companies.name) {
          columns.push("name");
          headers.push(req.fields.companies.name);
        }
      }

      if (view.field === "createdAt") {
        if (req.fields.companies.createdAt) {
          columns.push("createdAt");
          headers.push(req.fields.companies.createdAt);
        }
      }

      if (view.field === "updatedAt") {
        if (req.fields.companies.updatedAt) {
          columns.push("updatedAt");
          headers.push(req.fields.companies.updatedAt);
        }
      }
    }
  } catch (err) {
    next(err);
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
      // add headers in res. if 'withHeaders' is passed as query string.
      // The value of this query string can be anything to become true.
      // but suggested to use 'true' value e.g. withHeaders=true
      ...(withHeaders && headers),
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
  if (req.fields.companies.updatedAt) {
    columns.push("updatedAt");
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
    const company = await isCompanyExists(id);

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
  } else {
    // If we have field(s) to update, add timestamp when it
    // is updated.
    companyObj["updatedAt"] = sql`now()`;
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
    const company = await isCompanyExists(id);

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
