const User = require('./User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const generateToken = (length) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
};

const save = async (body) => {
  const { username, email, password } = body;
  const hash = await bcrypt.hash(body.password, 10);
  const user = {
    username,
    email,
    password: hash,
    activationToken: generateToken(16),
  };
  await User.create(user);
};

module.exports = { save };
