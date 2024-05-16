-- database: butler
create database butler;

-- table: users
create table users (
  id serial primary key,
  email varchar(255) unique not null,
  password varchar(255) not null,
  type varchar(255) not null default 'user'
);

-- table: companies
create table companies (
  id serial primary key,
  name varchar(255),
  "createdAt" timestamptz default current_timestamp,
  "updatedAt" timestamptz
);

-- table: orgs
-- temp, might change if this schema is not 
-- flexible enough to supports scenarios.
create table orgs (
  id serial primary key,
  "orgId" int not null,
  "canAccessCompanies" bool default true,
  "canReadCompanies" bool default true,
  "canCreateCompanies" bool default true,
  "canUpdateCompanies" bool default true,
  "canRemoveCompanies" bool default true,
  "isActive" bool default true
);
-- test entry
insert into orgs ("orgId") values (1);

-- table: permissions
-- temp, might change if this schema is not 
-- flexible enough to supports scenarios.
create table permissions (
  id serial primary key,
  "userId" int not null,
  "canAccessCompanies" bool default true,
  "canReadCompanies" bool default true,
  "canCreateCompanies" bool default true,
  "canUpdateCompanies" bool default true,
  "canRemoveCompanies" bool default true,
  "isActive" bool default true
);
-- test entry
insert into permissions ("userId") values (1);

-- table: fields
-- temp, might change if this schema is not 
-- flexible enough to supports scenarios.
create table fields (
  id serial primary key,
  name varchar(255) not null,
  "displayName" varchar(255) not null,
  module varchar(255) not null,
  "isActive" bool not null default true
);

--- test entries
insert into fields (name, "displayName", module) values ('id', 'Id', 'companies');
insert into fields (name, "displayName", module) values ('name', 'Name', 'companies');
insert into fields (name, "displayName", module) values ('createdAt', 'Created at', 'companies');
insert into fields (name, "displayName", module) values ('updatedAt', 'Updated at', 'companies');

-- table: views
-- temp, might change if this schema is not 
-- flexible enough to supports scenarios.
-- fields to add: sequence
create table views (
  id serial primary key,
  field varchar(255) not null,
  module varchar(255) not null
);

--- test entries
insert into views (field, module) values ('id', 'companies');
insert into views (field, module) values ('name', 'companies');