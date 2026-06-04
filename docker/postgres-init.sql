-- Creates one database per tenant mode so you can switch TENANT_MODE without the
-- data from one mode bleeding into another. Runs once, on first volume init.
-- `\gexec` runs each generated CREATE DATABASE only if the database is missing.
SELECT 'CREATE DATABASE nest_auth_disabled'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nest_auth_disabled')\gexec
SELECT 'CREATE DATABASE nest_auth_shared'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nest_auth_shared')\gexec
SELECT 'CREATE DATABASE nest_auth_isolated'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nest_auth_isolated')\gexec
