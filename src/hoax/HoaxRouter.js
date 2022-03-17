const express = require('express');
const router = express.Router();
const AuthenticationException = require('../auth/AuthenticationException');
const HoaxService = require('./HoaxService');
const { check, validationResult } = require('express-validator');
const ValidationException = require('../error/ValidationException');
const pagination = require('../middleware/pagination');

router.post(
  '/api/1.0/hoaxes',
  check('content')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Hoax must be min 10 and max 5000 characters'),
  async (req, res, next) => {
    if (!req.authenticatedUser) {
      return next(
        new AuthenticationException('You are not authorized to post hoax')
      );
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    await HoaxService.save(req.body, req.authenticatedUser);
    return res.send({ message: 'Hoax is saved' });
  }
);

router.get(
  ['/api/1.0/hoaxes', '/api/1.0/users/:userId/hoaxes'],
  pagination,
  async (req, res, next) => {
    const { page, size } = req.pagination;
    try {
      const hoaxes = await HoaxService.getHoaxes(page, size, req.params.userId);
      res.send(hoaxes);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
