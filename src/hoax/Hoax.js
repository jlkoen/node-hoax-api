const { Sequelize } = require('sequelize/dist');
const sequelize = require('../config/db');

const Model = Sequelize.Model;

class Hoax extends Model {}

Hoax.init(
  {
    content: {
      type: Sequelize.STRING,
    },
    timestamp: {
      type: Sequelize.BIGINT,
    },
  },
  {
    sequelize,
    modelname: 'hoax',
    timestamps: false,
  }
);

module.exports = Hoax;
