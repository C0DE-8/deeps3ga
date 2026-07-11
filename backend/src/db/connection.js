const path = require('path')
const mysql = require('mysql2/promise')
const { readEnv } = require('../config/env')

let pool

function getDatabaseConfig() {
  const env = readEnv()

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  }
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDatabaseConfig())
  }

  return pool
}

function getDatabaseInfo() {
  const env = readEnv()

  return {
    driver: 'mysql2',
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    migrationsPath: path.resolve(process.cwd(), env.dbMigrationsDir),
  }
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params)
  return rows
}

module.exports = { getDatabaseConfig, getDatabaseInfo, getPool, query }
