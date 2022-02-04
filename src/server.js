const express = require('express');

const app = express();

app.post('/api/v1/users', (req, res) => {
  return res.send({ message: 'User created' });
});

app.listen(5000, () => console.log('Server running'));

module.exports = app;
