const Sequelize = require('sequelize');

const sequelize = new Sequelize('hoaxify', 'dbuser', 'dbpass', {
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

module.exports = sequelize;
