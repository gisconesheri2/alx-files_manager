/* eslint-disable no-else-return */
/* eslint-disable no-useless-return */
import mongodb from 'mongodb';
import Queue from 'bull/lib/queue';
import { v4 as uuid4 } from 'uuid';
import { contentType } from 'mime-types';
import path from 'path';
import fs from 'fs';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue('thumbnail generation');

export default class FilesController {
  static async postUpload(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });

      if (user) {
        const allowedTypes = ['file', 'folder', 'image'];
        const fileData = req.body;

        if (!fileData.name) res.status(400).json({ error: 'Missing name' });
        if (!fileData.type) res.status(400).json({ error: 'Missing type' });
        if (!allowedTypes.includes(fileData.type)) res.status(400).json({ error: 'Missing type' });
        if (fileData.type !== 'folder' && !fileData.data) res.status(400).json({ error: 'Missing data' });
        if (fileData.parentId) {
          const parentIdObj = new mongodb.ObjectID(fileData.parentId);
          const folder = await dbClient.client.db().collection('files').findOne({ _id: parentIdObj });
          if (!folder) res.status(400).json({ error: 'Parent not found' });
          if (folder.type !== 'folder') res.status(400).json({ error: 'Parent is not a folder' });
        }

        if (fileData.type === 'folder') {
          const folderInsert = await dbClient.client.db().collection('files').insertOne({
            userId: user._id.toString(),
            name: fileData.name,
            type: fileData.type,
            isPublic: fileData.isPublic || false,
            parentId: fileData.parentId || 0,
          });

          delete folderInsert.ops[0]._id;
          folderInsert.ops[0].id = folderInsert.insertedId.toString();
          res.status(201).json(folderInsert.ops[0]);
        } else {
          const writeData = Buffer.from(fileData.data, 'base64').toString('utf-8');
          const filePath = `${FOLDER_PATH}/${uuid4()}`;

          fs.mkdir(FOLDER_PATH, (err) => {
            if (err !== null || err === null) {
              fs.writeFile(filePath, writeData, 'utf-8', async (err) => {
                if (err) throw err;
                const fileInsert = await dbClient.client.db().collection('files').insertOne({
                  userId: user._id.toString(),
                  name: fileData.name,
                  type: fileData.type,
                  isPublic: fileData.isPublic || false,
                  parentId: fileData.parentId || 0,
                  localPath: path.resolve(filePath),
                });
                delete fileInsert.ops[0]._id;
                delete fileInsert.ops[0].localPath;
                fileInsert.ops[0].id = fileInsert.insertedId.toString();
                const fileId = fileInsert.insertedId.toString();
                if (fileData.type === 'image') {
                  const jobName = `Image thumbnail [${userId}-${fileId}]`;
                  fileQueue.add({ userId, fileId, name: jobName });
                }
                res.status(201).json(fileInsert.ops[0]);
              });
            }
          });
        }
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async getShow(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });

      if (user) {
        const fileId = new mongodb.ObjectID(req.params.id);
        const file = await dbClient.client.db().collection('files').findOne({ _id: fileId, userId: user._id.tostring() });
        if (!file) res.status(404).json({ error: 'Not found' });
        res.status(200).json({
          id: file._id.toString(),
          userId,
          name: file.name,
          type: file.type,
          isPublic: file.isPublic,
          parentId: file.parentId,
        });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async getIndex(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });

      if (user) {
        const parentId = req.query.parentId || 0;
        const page = /\d+/.test((req.query.page || '').toString())
          ? Number.parseInt(req.query.page, 10)
          : 0;

        const filesFilter = {
          userId: user._id,
          parentId: parentId === 0
            ? parentId
            : new mongodb.ObjectId(parentId),
        };

        const files = await (dbClient.client.db().collection('files')
          .aggregate([
            { $match: filesFilter },
            { $sort: { _id: -1 } },
            { $skip: page * MAX_FILES_PER_PAGE },
            { $limit: MAX_FILES_PER_PAGE },
            {
              $project: {
                _id: 0,
                id: '$_id',
                userId: '$userId',
                name: '$name',
                type: '$type',
                isPublic: '$isPublic',
                parentId: {
                  $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
                },
              },
            },
          ])).toArray();
        res.status(200).json(files);
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async putPublish(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });

      if (user) {
        const _id = new mongodb.ObjectID(req.params.id);
        const file = await dbClient.client.db().collection('files').findOne({ userId, _id });
        if (!file) res.status(404).json({ error: 'Not found' });
        await dbClient.client.db().collection('files').updateOne({ userId, _id }, { $set: { isPublic: true } });
        res.status(200).json({
          id: file._id.toString(),
          userId,
          name: file.name,
          type: file.type,
          isPublic: true,
          parentId: file.parentId,
        });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async putUnpublish(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });

      if (user) {
        const _id = new mongodb.ObjectID(req.params.id);
        const file = await dbClient.client.db().collection('files').findOne({ userId, _id });
        if (!file) res.status(404).json({ error: 'Not found' });
        await dbClient.client.db().collection('files').updateOne({ userId, _id }, { $set: { isPublic: false } });
        res.status(200).json({
          id: file._id.toString(),
          userId,
          name: file.name,
          type: file.type,
          isPublic: true,
          parentId: file.parentId,
        });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async getFile(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });

      if (user) {
        const _id = new mongodb.ObjectID(req.params.id);
        const size = req.query.size || null;
        const file = await dbClient.client.db().collection('files').findOne({ userId, _id });
        if (!file) res.status(404).json({ error: 'Not found' });
        if (file.isPublic === false) res.status(404).json({ error: 'Not found' });
        if (file.type === 'folder') res.status(400).json({ error: "A folder doesn't have content" });
        if (!file.localPath) res.status(404).json({ error: 'Not found' });
        let filePath = file.localPath;
        if (size) {
          filePath = `${file.localPath}_${size}`;
        }
        fs.readFile(filePath, 'utf-8', (err, data) => {
          if (err) res.status(404).json({ error: 'Not found' });
          res.set('Content-Type', contentType(file.name));
          res.status(200).send(data);
        });
        await dbClient.client.db().collection('users').updateOne({ userId, _id }, { $set: { isPublic: false } });
        res.status(200).json({
          id: file._id.toString(),
          userId,
          name: file.name,
          type: file.type,
          isPublic: true,
          parentId: file.parentId,
        });
      } else {
        res.status(404).json({ error: 'Not Found' });
      }
    } else {
      res.status(404).json({ error: 'Not Found' });
    }
  }
}
