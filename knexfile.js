module.exports = {
  client: 'mysql',
  connection: {
    host : process.env.DB_HOST,
    user : process.env.DB_USER,
    password : process.env.DB_PASSWD,
    database : process.env.DB_NAME
  },
  pool: { min: 0, max: 20 }
}