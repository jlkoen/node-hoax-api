const express = require('express');
const UserRouter = require('./user/UserRouter');

const app = express();

app.use(express.json());

app.use(UserRouter);

//app.listen(5000, () => console.log('Server running'));

module.exports = app;
