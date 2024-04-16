-- database: butler
create database butler;

-- table: companies
create table companies (
  id serial primary key,
  name varchar(255)
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