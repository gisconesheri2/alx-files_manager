import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AppController {
  static getStatus(_req, res) {
    res.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static getStats(_req, res) {
    Promise.all([dbClient.nbUsers(), dbClient.nbFiles()])
      .then(([userCount, fileCount]) => {
        res.status(200).json({
          users: userCount,
          files: fileCount,
        });
      });
  }
}
