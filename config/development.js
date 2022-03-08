module.exports = {
  database: {
    database: 'hoaxify',
    username: 'my-db-user',
    password: 'db-p4ss',
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false,
  },
  mail: {
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'viva.von91@ethereal.email',
      pass: 'wz9bgcPR1HgxUx931V',
    },
  },
  uploadDir: 'uploads-dev',
  profileDir: 'profile',
};
