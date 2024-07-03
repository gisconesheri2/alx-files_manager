import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST === undefined ? 'localhost' : process.env.DB_HOST;
    const port = process.env.DB_PORT === undefined ? 27017 : process.env.DB_PORT;
    const database = process.env.DB_DATABASE === undefined ? 'files_manager' : process.env.DB_DATABASE;

    this.url = `mongodb://${host}:${port}/${database}`;
    this.client = new MongoClient(this.url, { useUnifiedTopology: true });
    this.client.connect();
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
