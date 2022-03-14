const express = require('express');
const router = express.Router();
const AuthenticationException = require('../auth/AuthenticationException');
const HoaxService = require('./HoaxService');

router.post('/api/1.0/hoaxes', async (req, res, next) => {
  if (req.authenticatedUser) {
    await HoaxService.save(req.body);
    return res.send({ message: 'Hoax is saved' });
  }
  next(new AuthenticationException('You are not authorized to post hoax'));
});

module.exports = router;
