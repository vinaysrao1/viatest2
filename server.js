import express from 'express';
// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Connect 4 API is running' });
});

// Serve static files from production build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.use((req, res) => {
    res.sendFile(`${process.cwd()}/dist/index.html`);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});