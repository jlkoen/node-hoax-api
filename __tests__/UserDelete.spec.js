const request = require('supertest');
const app = require('../src/server');
const User = require('../src/user/User');
const sequelize = require('../src/config/db');
const bcrypt = require('bcrypt');
const Token = require('../src/auth/Token');

beforeAll(async () => {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
});

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
  inactive: false,
};

const credentials = { email: 'user1@mail.com', password: 'P4ssword' };

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

const auth = async (options = {}) => {
  let token;
  if (options.auth) {
    const response = await request(app)
      .post('/api/1.0/auth')
      .send(options.auth);
    token = response.body.token;
  }
  return token;
};

const deleteUser = async (id = 5, options = {}) => {
  const agent = request(app).delete('/api/1.0/users/' + id);
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send();
};

describe('User Delete', () => {
  it('returns forbidden when request sent unauthorized', async () => {
    const response = await deleteUser();
    expect(response.status).toBe(403);
  });

  it('returns forbidden when delete request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeDelete = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com',
    });
    const token = await auth({
      auth: credentials,
    });
    const response = await deleteUser(userToBeDelete.id, { token: token });
    expect(response.status).toBe(403);
  });

  it('reutrns 403 when token is not valid', async () => {
    const response = await deleteUser(5, { token: '123' });
    expect(response.status).toBe(403);
  });

  it('returns 200 ok when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: credentials,
    });
    const response = await deleteUser(savedUser.id, { token: token });
    expect(response.status).toBe(200);
  });

  it('deletes user from database when request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    await deleteUser(savedUser.id, { token: token });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser).toBeNull();
  });

  it('deletes token from database when delete user request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: credentials,
    });
    await deleteUser(savedUser.id, { token: token });

    const tokenInDB = await Token.findOne({ where: { token: token } });
    expect(tokenInDB).toBeNull();
  });

  it('deletes all tokens from database when delete user request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token1 = await auth({
      auth: credentials,
    });
    const token2 = await auth({
      auth: credentials,
    });
    await deleteUser(savedUser.id, { token: token1 });

    const tokenInDB = await Token.findOne({ where: { token: token2 } });
    expect(tokenInDB).toBeNull();
  });
});
