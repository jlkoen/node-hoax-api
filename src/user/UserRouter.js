const express = require('express');
const User = require('./User');
const router = express.Router();
const UserService = require('./UserService');

router.post('/api/v1/users', async (req, res) => {
  const user = req.body;
  if (user.username === null) {
    return res.status(400).send({
      validationErrors: {
        username: 'Username cannot be null',
      },
    });
  }

  await UserService.save(req.body);

  return res.send({ message: 'User created' });
});

module.exports = router;
