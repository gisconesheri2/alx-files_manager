import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.isClientCOnnected = true;
    this.client = redis.createClient();
    this.client.on('error', (err) => {
      console.log(err);
      this.isClientCOnnected = false;
    });
    this.client.on('connect', () => {
      this.isClientCOnnected = true;
    });
  }

  isAlive() {
    return this.isClientCOnnected;
  }

  async get(key) {
    return promisify(this.client.get).bind(this.client)(key);
  }

  async set(key, val, expDuration) {
    return promisify(this.client.set).bind(this.client)(key, val, 'EX', expDuration);
  }

  async del(key) {
    return promisify(this.client.del).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
