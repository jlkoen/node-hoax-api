const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/db');
const User = require('../src/user/User');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const config = require('config');

const { uploadDir, profileDir } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);

beforeAll(async () => {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
});

beforeEach(() => {
  return User.destroy({ truncate: { cascase: true } });
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

const putUser = async (id = 5, body = null, options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth/').send(options.auth);
    token = response.body.token;
  }
  agent = request(app).put('/api/1.0/users/' + id);
  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send(body);
};

const readFileAsBase64 = (file = 'test-png.png') => {
  const filePath = path.join('.', '__tests__', 'resources', file);
  return fs.readFileSync(filePath, { encoding: 'base64' }).toString();
};

describe('User Update', () => {
  it('returns forbidden when request sent without basic authentication', async () => {
    const response = await putUser();
    expect(response.status).toBe(403);
  });

  it('returns forbidden when request sent with incorrect email in basic authorization', async () => {
    await addUser();
    const response = await putUser(5, null, {
      auth: { email: 'user1000@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });

  it('returns forbidden when request sent with incorrect password in basic authorization', async () => {
    await addUser();
    const response = await putUser(5, null, {
      auth: { email: 'user1@mail.com', password: 'password' },
    });
    expect(response.status).toBe(403);
  });

  it('returns forbidden when update request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeUpdated = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com',
    });
    const response = await putUser(userToBeUpdated.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });

  it('returns forbidden when update request is sent by inactive user with correct credentials for its own user', async () => {
    const inactiveUser = await addUser({ ...activeUser, inactive: true });
    const response = await putUser(inactiveUser.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    expect(response.status).toBe(403);
  });

  it('returns 200 ok when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.status).toBe(200);
  });

  it('updates username in database when valid update request is sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
  });

  it('returns 403 when token is not valid', async () => {
    const response = await putUser(5, null, { token: '123' });
    expect(response.status).toBe(403);
  });

  it('saves the user image when update contains image as base64', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.image).toBeTruthy();
  });

  it('returns success body with onlly id, username, email, and image', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(Object.keys(response.body)).toEqual([
      'id',
      'username',
      'email',
      'image',
    ]);
  });

  it('saves the user image to the upload folder and stores filename in user when update has image', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    const profileImagePath = path.join(profileDirectory, inDBUser.image);
    expect(fs.existsSync(profileImagePath)).toBe(true);
  });

  it('removes the old image after user upload new one', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const firstImage = response.body.image;

    await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const profileImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImagePath)).toBe(false);
  });

  it.each`
    field         | value             | message
    ${'username'} | ${null}           | ${'Username cannot be null'}
    ${'username'} | ${'usr'}          | ${'Must have min 4 and max 32 characters'}
    ${'username'} | ${'a'.repeat(33)} | ${'Must have min 4 and max 32 characters'}
  `(
    'returns bad request with $message when username is updated with $value',
    async ({ value, message }) => {
      const savedUser = await addUser();
      const invalidUpdate = { username: value };
      const response = await putUser(savedUser.id, invalidUpdate, {
        auth: { email: savedUser.email, password: 'P4ssword' },
      });
      expect(response.status).toBe(400);
      expect(response.body.validationErrors.username).toBe(message);
    }
  );

  it('returns 200 when image size is exactly 2mb', async () => {
    const testPng = readFileAsBase64();
    const pngByte = Buffer.from(testPng, 'base64').length;
    const twoMB = 1024 * 1024 * 2;
    const filling = 'a'.repeat(twoMB - pngByte);
    const fillBase64 = Buffer.from(filling).toString('base64');
    const savedUser = await addUser();
    const validUpdate = {
      username: 'updated-user',
      image: testPng + fillBase64,
    };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.status).toBe(200);
  });

  it('returns 400 when image size exceeds 2mb', async () => {
    const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
    const savedUser = await addUser();
    const invalidUpdate = { username: 'updated-user', image: base64 };
    const response = await putUser(savedUser.id, invalidUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.status).toBe(400);
  });

  it('keeps the old image after user only updates username', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated', image: fileInBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });

    const firstImage = response.body.image;

    await putUser(
      savedUser.id,
      { username: 'user1-updated2' },
      {
        auth: { email: savedUser.email, password: 'P4ssword' },
      }
    );

    const profileImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImagePath)).toBe(true);

    const userInDb = await User.findOne({ where: { id: savedUser.id } });
    expect(userInDb.image).toBe(firstImage);
  });

  it('returns message when file size exceeds 2mb', async () => {
    const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
    const savedUser = await addUser();
    const invalidUpdate = { username: 'updated-user', image: base64 };
    const response = await putUser(savedUser.id, invalidUpdate, {
      auth: { email: savedUser.email, password: 'P4ssword' },
    });
    expect(response.body.validationErrors.image).toBe(
      'Your profile image cannot be bigger than 2MB'
    );
  });

  it.each`
    file              | status
    ${'test-gif.gif'} | ${400}
    ${'test-pdf.pdf'} | ${400}
    ${'test-txt.txt'} | ${400}
    ${'test-png.png'} | ${200}
    ${'test-jpg.jpg'} | ${200}
  `(
    'returns $status when uploading $file as image',
    async ({ file, status }) => {
      const fileInBase64 = readFileAsBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: 'user1-updated', image: fileInBase64 };
      const response = await putUser(savedUser.id, updateBody, {
        auth: { email: savedUser.email, password: 'P4ssword' },
      });
      expect(response.status).toBe(status);
    }
  );

  it.each`
    file              | message
    ${'test-gif.gif'} | ${'Only JPEG or PNG files are allowed'}
    ${'test-pdf.pdf'} | ${'Only JPEG or PNG files are allowed'}
    ${'test-txt.txt'} | ${'Only JPEG or PNG files are allowed'}
  `(
    'returns $message when uploading $file as image',
    async ({ file, message }) => {
      const fileInBase64 = readFileAsBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: 'user1-updated', image: fileInBase64 };
      const response = await putUser(savedUser.id, updateBody, {
        auth: { email: savedUser.email, password: 'P4ssword' },
      });
      expect(response.body.validationErrors.image).toBe(message);
    }
  );
});
