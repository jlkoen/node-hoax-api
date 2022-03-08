const express = require('express');
const UserRouter = require('./user/UserRouter');
const errorHandler = require('./error/ErrorHandler');
const AuthenticationRouter = require('./auth/AuthenticationRouter');
const tokenAuthentication = require('./middleware/tokenAuthentication');
const FileService = require('./file/FileService');
const config = require('config');
const path = require('path');

const { uploadDir, profileDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir);

const ONE_YEAR_IN_MILLIS = 365 * 24 * 60 * 60 * 1000;

FileService.createFolders();
const app = express();

app.use(express.json());

app.use(
  '/images',
  express.static(profileFolder, { maxAge: ONE_YEAR_IN_MILLIS })
);

app.use(tokenAuthentication);

app.use(UserRouter);
app.use(AuthenticationRouter);

app.use(errorHandler);

//app.listen(5000, () => console.log('Server running'));

module.exports = app;
