import { Client } from 'pg';
import { spawn } from 'child_process';
import fs from 'fs';

// Database connection
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'mysecretpassword',
  database: 'video',
});

const connectDB = async () => {
  console.log(`connecting to db`);
  await client.connect();
  console.log(`connected to db`);
};

const migrateDB = async () => {
  const createTableQuery = `
      CREATE TABLE IF NOT EXISTS video_frames (
        id SERIAL PRIMARY KEY,
        frame_data BYTEA,
        frame_number INT
      );
    `;

  await client.query(createTableQuery);
};

const extractFrames = async () => {
  await connectDB();
  await migrateDB(); // Run the migration

  const ffmpegPath = 'ffmpeg'; // Update this if ffmpeg is not in your PATH
  let frameNumber = 0;

  const ffmpeg = spawn(ffmpegPath, [
    '-i',
    'sample.mpeg',
    '-vf',
    'fps=1',
    '-f',
    'image2pipe',
    '-',
  ]);

  ffmpeg.stdout.on('data', async data => {
    frameNumber++;
    const frameData = data.toString('base64');
    await client.query(
      'INSERT INTO video_frames(frame_data, frame_number) VALUES($1, $2)',
      [frameData, frameNumber],
    );
  });

  ffmpeg.on('close', async code => {
    if (code !== 0) {
      console.log(`ffmpeg process exited with code ${code}`);
    }
    await client.end();
    console.log('All frames saved.');
  });
};

// Kick off the process
extractFrames();
