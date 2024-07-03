import sha1 from 'sha1';
import mongodb from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    if (req.header('Authorization')) {
      const credentials = req.header('Authorization').split(' ')[1];
      const decodedString = Buffer.from(credentials, 'base64').toString('utf-8');
      const [email, passwd] = decodedString.split(':');
      const password = sha1(passwd);
      const user = await dbClient.client.db().collection('users').findOne({ email, password });
      if (user) {
        const accessToken = uuidv4();
        const redisKey = `auth_${accessToken}`;
        redisClient.set(redisKey, user._id.toString(), 24 * 60 * 60);
        res.status(200).json({ token: accessToken });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  static async getDisconnect(req, res) {
    if (req.header('X-Token')) {
      const accessToken = req.header('X-Token');
      const redisKey = `auth_${accessToken}`;
      const userId = new mongodb.ObjectID(await redisClient.get(redisKey));
      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });
      if (user) {
        redisClient.del(redisKey);
        res.status(204).end();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}
