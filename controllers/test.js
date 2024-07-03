const fs = require('fs');
const { Buffer } = require('buffer');

const data = new Uint8Array(Buffer.from('Hello Node.js'));
fs.mkdir('/tmp/files/1', (err) => {
  if (err !== null || err === null) {
    fs.writeFile('/tmp/files/1/message.txt', data, (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
  }
});
