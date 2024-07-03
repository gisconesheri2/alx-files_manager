/* eslint-disable no-unused-vars */
import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = express.Router();

router.get('/status', (req, res, _next) => {
  AppController.getStatus(req, res);
});

router.get('/stats', (req, res, _next) => {
  AppController.getStats(req, res);
});

router.post('/users', (req, res, _next) => {
  UsersController.postNew(req, res);
});

router.get('/users/me', (req, res, _next) => {
  UsersController.getMe(req, res);
});

router.get('/connect', (req, res) => {
  AuthController.getConnect(req, res);
});

router.get('/disconnect', (req, res) => {
  AuthController.getDisconnect(req, res);
});

router.post('/files', (req, res) => {
  FilesController.postUpload(req, res);
});

router.get('/files/:id', (req, res) => {
  FilesController.getShow(req, res);
});

router.get('/files', (req, res) => {
  FilesController.getInddex(req, res);
});

router.put('/files/:id/publish', (req, res) => {
  FilesController.putPublish(req, res);
});

router.put('/files/:id/publish', (req, res) => {
  FilesController.putUnpublish(req, res);
});

router.get('/files/:id/data', (req, res) => {
  FilesController.getFile(req, res);
});

module.exports = router;
