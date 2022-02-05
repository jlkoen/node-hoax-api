const express = require('express');
const User = require('./User');
const router = express.Router();
const UserService = require('./UserService');

router.post('/api/v1/users', async (req, res) => {
  await UserService.save(req.body);

  return res.send({ message: 'User created' });
});

module.exports = router;
