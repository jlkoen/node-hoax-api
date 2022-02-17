const express = require('express');
const UserRouter = require('./user/UserRouter');
const errorHandler = require('./error/ErrorHandler');
const AuthenticationRouter = require('./auth/AuthenticationRouter');

const app = express();

app.use(express.json());

app.use(UserRouter);
app.use(AuthenticationRouter);

app.use(errorHandler);

//app.listen(5000, () => console.log('Server running'));

module.exports = app;
