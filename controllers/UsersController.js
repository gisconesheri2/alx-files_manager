/* eslint-disable no-else-return */
/* eslint-disable no-useless-return */
import sha1 from 'sha1';
import mongodb from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class UsersController {
  static async postNew(req, res) {
    if (req.header('Content-Type') === 'application/json') {
      const data = req.body;
      if (!data.email) {
        res.status(400).json({
          error: 'Missing email',
        });
      }
      if (!data.password) {
        res.status(400).json({
          error: 'Missing password',
        });
      }
      const user = await dbClient.client.db().collection('users').findOne({ email: data.email });
      if (user) {
        res.status(400).json({ error: 'Already exist' });
        return;
      }
      data.password = sha1(data.password);
      const result = await dbClient.client.db().collection('users').insertOne(data);
      const userId = result.insertedId.toString();
      res.status(201).json({ email: data.email, id: userId });
    }
  }

  static async getMe(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });
      if (user) {
        res.status(200).json({ id: userId, email: user.email });
        return;
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}
