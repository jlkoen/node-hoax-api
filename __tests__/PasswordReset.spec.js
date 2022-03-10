const request = require('supertest');
const app = require('../src/server');
const User = require('../src/user/User');
const Token = require('../src/auth/Token');
const sequelize = require('../src/config/db');
const bcrypt = require('bcrypt');
const SMTPServer = require('smtp-server').SMTPServer;
const config = require('config');

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on('data', (data) => {
        mailBody += data.toString();
      });
      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    },
  });

  await server.listen(config.mail.port, 'localhost');

  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
  jest.setTimeout(20000);
});

beforeEach(async () => {
  simulateSmtpFailure = false;
  await User.destroy({ truncate: { cascade: true } });
});

afterAll(async () => {
  await server.close();
  jest.setTimeout(5000);
});

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
  inactive: false,
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

const postPasswordReset = (email = 'user1@mail.com') => {
  const agent = request(app).post('/api/1.0/user/password');
  return agent.send({ email: email });
};

const putPasswordUpdate = (body = {}, options = {}) => {
  const agent = request(app).put('/api/1.0/user/password');

  return agent.send(body);
};

describe('Password Reset Request', () => {
  it('returns 404 when a password reset request is sent for unknown e-mail', async () => {
    const response = await postPasswordReset();
    expect(response.status).toBe(404);
  });

  it('returns error body with for unknown email for password reset request', async () => {
    const nowInMillis = new Date().getTime();
    const response = await postPasswordReset('user1@mail.com');
    expect(response.body.path).toBe('/api/1.0/user/password');
    expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
    expect(response.body.message).toBe('E-mail not found');
  });

  it('returns 400 with validation error response when request does not have valid email', async () => {
    const response = await postPasswordReset(null, {});
    expect(response.body.validationErrors.email).toBe('E-mail is not valid');
    expect(response.status).toBe(400);
  });

  it('returns 200 ok when a password reset request is sent for known e-mail', async () => {
    const user = await addUser();
    const response = await postPasswordReset(user.email);
    expect(response.status).toBe(200);
  });

  it('returns success response body for known email for password reset request', async () => {
    const user = await addUser();
    const response = await postPasswordReset(user.email);
    expect(response.body.message).toBe(
      'Check your e-mail for resetting your password'
    );
  });

  it('creates passwordResetToken when a password reset request is sent for known e-mail', async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userInDB = await User.findOne({ where: { email: user.email } });
    expect(userInDB.passwordResetToken).toBeTruthy();
  });

  it('sends a password reset email with passwordResetToken', async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userInDB = await User.findOne({ where: { email: user.email } });
    const passwordResetToken = userInDB.passwordResetToken;
    expect(lastMail).toContain('user1@mail.com');
    expect(lastMail).toContain(passwordResetToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const response = await postPasswordReset(user.email);
    expect(response.status).toBe(502);
  });
});

describe('Password Update', () => {
  it('returns 403 when password update does not have a valid password reset token', async () => {
    const response = await putPasswordUpdate({
      password: 'P4ssword',
      passwordResetToken: 'abcd',
    });
    expect(response.status).toBe(403);
  });

  it('returns 403 when password update request with invalid password and invalid token', async () => {
    const response = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'abcd',
    });
    expect(response.status).toBe(403);
  });

  it('returns 400 when password update with invalid password and valid token', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'test-token',
    });
    expect(response.status).toBe(400);
  });

  it('returns 200 when valid password is sent with valid reset token', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    expect(response.status).toBe(200);
  });

  it('updates the password in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const userInDB = await User.findOne({ where: { email: 'user1@mail.com' } });
    expect(userInDB.password).not.toEqual(user.password);
  });

  it('clears the reset token in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const userInDB = await User.findOne({ where: { email: 'user1@mail.com' } });
    expect(userInDB.passwordResetToken).toBeFalsy();
  });

  it('activates and clears activation token if the account is inactive after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    user.activationToken = 'activation-token';
    user.inactive = true;
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const userInDB = await User.findOne({ where: { email: 'user1@mail.com' } });
    expect(userInDB.activationToken).toBeFalsy();
    expect(userInDB.inactive).toBe(false);
  });

  it('clears all tokens of user after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await Token.create({
      token: 'token-1',
      userId: user.id,
      lastUsedAt: Date.now(),
    });
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const tokens = await Token.findAll({ where: { userId: user.id } });
    expect(tokens.length).toBe(0);
  });
});
