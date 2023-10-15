import { Client } from 'pg';
import { spawn, exec } from 'child_process';
import fs from 'fs';

/**
 * I was not able to get this one working.Here's a sample of the errors from FFMPEG 
    ffmpeg stderr: Stream mapping:
    Stream #0:0 -> #0:0 (mpeg1video (native) -> mjpeg (native))

    ffmpeg stderr: Cannot determine format of input stream 0:0 after EOF
    Error marking filters as finished

    ffmpeg stderr: Conversion failed!
 */

// Database connection setup
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'mysecretpassword',
  database: 'video',
});

const connectDB = async () => {
  await client.connect();
};
const getVideoCodec = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(
      'ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 src/sample.mpeg',
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
};

const fetchAndConvertFrame = async (frameNumber: number) => {
  await connectDB();
  const codec = await getVideoCodec();
  console.log(codec);
  const res = await client.query(
    'SELECT frame_data FROM video_frames WHERE frame_number = $1',
    [frameNumber],
  );
  if (res.rows.length === 0) {
    console.log(`No frame found for frame_number: ${frameNumber}`);
    await client.end();
    return;
  }

  const frameData = res.rows[0].frame_data;
  const ffmpegPath = 'ffmpeg';
  const ffmpeg = spawn(ffmpegPath, [
    '-f',
    'image2pipe',
    '-vcodec',
    codec, // specify the codec
    '-i',
    'pipe:0',
    'output.jpg',
  ]);

  ffmpeg.stdin.write(frameData);
  ffmpeg.stdin.end();
  ffmpeg.stderr.on('data', data => {
    console.error(`ffmpeg stderr: ${data}`);
  });

  ffmpeg.on('close', code => {
    if (code !== 0) {
      console.log(`ffmpeg process exited with code ${code}`);
    } else {
      console.log('Frame converted to output.jpg');
    }
    client.end();
  });
};

// Fetch and convert frame number 1 as an example
fetchAndConvertFrame(1);
