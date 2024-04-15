-- database: butler
create database butler;

-- table: companies
create table companies (
  id serial primary key,
  name varchar(255)
);