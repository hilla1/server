// api/server.js
import app from './app.js';
import serverless from 'serverless-http';

export const handler = serverless(app);
