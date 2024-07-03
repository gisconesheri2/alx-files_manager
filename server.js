import express from 'express';

const PORT = process.env.PORT || 5000;

const allRouter = require('./routes/index');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use('/', allRouter);

app.listen(PORT, () => {
  console.log(`Server listening on PORT ${PORT}`);
});

module.exports = app;
