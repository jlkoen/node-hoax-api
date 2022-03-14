const request = require('supertest');
const app = require('../src/server');
const User = require('../src/user/User');
const Hoax = require('../src/hoax/Hoax');
const sequelize = require('../src/config/db');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
});

beforeEach(async () => {
  await Hoax.destroy({ truncate: true });
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

const postHoax = async (body = null, options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }
  agent = request(app).post('/api/1.0/hoaxes');
  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send(body);
};

describe('Post Hoax', () => {
  it('returns 401 when hoax post request has no authentication', async () => {
    const response = await postHoax();
    expect(response.status).toBe(401);
  });

  it('returns error body with message when unauthorized request sent', async () => {
    const nowInMillis = Date.now();
    const response = await postHoax();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/hoaxes');
    expect(error.message).toBe('You are not authorized to post hoax');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
  });

  it('returns 200 when valid hoax submitted with authorized user', async () => {
    await addUser();
    const response = await postHoax(
      { content: 'Hoax content' },
      { auth: credentials }
    );
    expect(response.status).toBe(200);
  });

  it('saves the hoax to database when authorized user sends valid request', async () => {
    await addUser();
    await postHoax({ content: 'Hoax content' }, { auth: credentials });
    const hoaxes = await Hoax.findAll();
    expect(hoaxes.length).toBe(1);
  });
  it('saves the hoax content and timestamp to database', async () => {
    await addUser();
    const beforeSubmit = Date.now();
    await postHoax({ content: 'Hoax content' }, { auth: credentials });
    const hoaxes = await Hoax.findAll();
    const savedHoax = hoaxes[0];
    expect(savedHoax.content).toBe('Hoax content');
    expect(savedHoax.timestamp).toBeGreaterThan(beforeSubmit);
    expect(savedHoax.timestamp).toBeLessThan(Date.now());
  });
  it('returns success message on hoax submit', async () => {
    await addUser();
    const response = await postHoax(
      { content: 'Hoax content' },
      { auth: credentials }
    );
    expect(response.body.message).toBe('Hoax is saved');
  });

  it('returns 400 and validation failure when hoax content is less than 10 characters', async () => {
    await addUser();
    const response = await postHoax(
      { content: '123456789' },
      { auth: credentials }
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation Failure');
  });

  it('returns validation error body when an invalid hoax post by authorized user', async () => {
    await addUser();
    const nowInMillis = Date.now();
    const response = await postHoax(
      { content: '123456789' },
      { auth: credentials }
    );
    const error = response.body;
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.path).toBe('/api/1.0/hoaxes');
    expect(Object.keys(error)).toEqual([
      'path',
      'timestamp',
      'message',
      'validationErrors',
    ]);
  });

  it.each`
    content             | message
    ${null}             | ${'Hoax must be min 10 and max 5000 characters'}
    ${'a'.repeat(9)}    | ${'Hoax must be min 10 and max 5000 characters'}
    ${'a'.repeat(5001)} | ${'Hoax must be min 10 and max 5000 characters'}
  `(
    'returns message when the content is $content',
    async ({ content, message }) => {
      await addUser();
      const response = await postHoax(
        { content: content },
        { auth: credentials }
      );
      expect(response.body.validationErrors.content).toBe(message);
    }
  );
});
