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
client.on('error', err => {
  console.error('Database client error:', err.stack);
});
const connectDB = async () => {
  await client.connect();
};

const fetchFrames = async () => {
  await connectDB();

  const res = await client.query(
    'SELECT frame_data, frame_number FROM video_frames ORDER BY frame_number ASC',
  );
  if (res.rows.length === 0) {
    console.log(`No frames found`);
    await client.end();
    return;
  }
  console.log(`making frames dir`);
  // Create directory to store frames
  if (!fs.existsSync('frames')) {
    fs.mkdirSync('frames');
  }
  console.log(`made frames dir`);

  console.log(`saving frames to dir`);
  // Save frames to disk
  res.rows.forEach(row => {
    const frameData = row.frame_data;
    const frameNumber = row.frame_number;
    fs.writeFileSync(`frames/frame${frameNumber}.jpg`, frameData);
  });
  console.log(`saved frames to dir`);
  client.end();
};

const createVideoFromFrames = () => {
  console.log(`calling ffmpeg`);
  const ffmpeg = spawn('ffmpeg', [
    '-framerate',
    '30', // Frame rate
    '-i',
    'frames/frame%d.jpg', // Input frames
    '-c:v',
    'libx264', // Video codec
    'output.mp4', // Output file
  ]);

  ffmpeg.stderr.on('data', data => {
    console.error(`ffmpeg stderr: ${data}`);
  });

  ffmpeg.on('close', code => {
    if (code !== 0) {
      console.log(`ffmpeg process exited with code ${code}`);
    } else {
      console.log('Frames converted to output.mp4');
    }
  });
};

// Fetch frames and create video
fetchFrames().then(() => {
  createVideoFromFrames();
});
