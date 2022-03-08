const express = require('express');
const router = express.Router();
const UserService = require('./UserService');
const { check, validationResult } = require('express-validator');
const ValidationException = require('../error/ValidationException');
const pagination = require('../middleware/pagination');
const NotFoundException = require('../error/NotFoundException');
const ForbiddenException = require('../error/ForbiddenException');

router.post(
  '/api/1.0/users',
  check('username')
    .notEmpty()
    .withMessage('Username cannot be null')
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage('Must have min 4 and max 32 characters'),
  check('email')
    .notEmpty()
    .withMessage('E-mail cannot be null')
    .bail()
    .isEmail()
    .withMessage('E-mail is not valid')
    .bail()
    .custom(async (email) => {
      const user = await UserService.findByEmail(email);
      if (user) {
        throw new Error('E-mail address in use');
      }
    }),
  check('password')
    .notEmpty()
    .withMessage('Password cannot be null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage(
      'Password must have at least 1 uppercase, 1 lowercase letter and 1 number'
    ),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    try {
      await UserService.save(req.body);
      return res.send({ message: 'User created' });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/api/1.0/users/token/:token', async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);
    return res.send({ message: 'Account is activated' });
  } catch (err) {
    next(err);
  }
});

router.get('/api/1.0/users', pagination, async (req, res) => {
  const authenticatedUser = req.authenticatedUser;
  const { page, size } = req.pagination;
  const users = await UserService.getUsers(page, size, authenticatedUser);
  res.send(users);
});

router.get('/api/1.0/users/:id', async (req, res, next) => {
  try {
    const user = await UserService.getUser(req.params.id);
    res.send(user);
  } catch (err) {
    next(err);
  }
});

router.put('/api/1.0/users/:id', async (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;

  if (!authenticatedUser || authenticatedUser.id != req.params.id) {
    return next(
      new ForbiddenException('You are not authorized to update user')
    );
  }
  const user = await UserService.updateUser(req.params.id, req.body);
  return res.send(user);
});

router.delete('/api/1.0/users/:id', async (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;
  // eslint-disable-next-line eqeqeq
  if (!authenticatedUser || authenticatedUser.id != req.params.id) {
    return next(
      new ForbiddenException('You are not authorized to delete the user')
    );
  }
  await UserService.deleteUser(req.params.id);
  res.send();
});

router.post(
  '/api/1.0/user/password',
  check('email').isEmail().withMessage('E-mail is not valid'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    try {
      await UserService.passwordResetRequest(req.body.email);
      return res.send({
        message: 'Check your e-mail for resetting your password',
      });
    } catch (err) {
      next(err);
    }
  }
);

const passwordResetTokenValidator = async (req, res, next) => {
  const user = await UserService.findByPasswordResetToken(
    req.body.passwordResetToken
  );
  if (!user) {
    return next(
      new ForbiddenException(
        'You are not authorized to update your password. Please follow the password reset steps again.'
      )
    );
    next();
  }
  next();
};

router.put(
  '/api/1.0/user/password',
  passwordResetTokenValidator,
  check('password')
    .notEmpty()
    .withMessage('Password cannot be null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage(
      'Password must have at least 1 uppercase, 1 lowercase letter and 1 number'
    ),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    await UserService.updatePassword(req.body);
    res.send();
  }
);
module.exports = router;
