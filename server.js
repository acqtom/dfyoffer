// Entry point. `npm start` runs it locally; Vercel detects a root-level
// server.js that starts listening and deploys it as the app's function.
const http = require('node:http');
const handler = require('./lib/server');

const PORT = process.env.PORT || 3000;

http.createServer(handler).listen(PORT, () => {
  console.log(`Paidcoaching hub running at http://localhost:${PORT}`);
});
