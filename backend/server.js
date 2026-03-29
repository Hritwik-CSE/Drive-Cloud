const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Track active transcoding jobs
const activeJobs = new Map();

app.get('/api/video/:fileId/index.m3u8', (req, res) => {
  const { fileId } = req.params;
  const token = req.query.token;

  if (!token) {
    return res.status(401).send('Missing token');
  }

  const outDir = path.join(tempDir, fileId);
  const m3u8File = path.join(outDir, 'index.m3u8');

  // If already fully transcoded or currently transcoding
  if (fs.existsSync(m3u8File)) {
    return res.sendFile(m3u8File);
  }

  if (activeJobs.has(fileId)) {
    const checkInterval = setInterval(() => {
      if (fs.existsSync(m3u8File)) {
        clearInterval(checkInterval);
        return res.sendFile(m3u8File);
      }
    }, 1000);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!res.headersSent) {
        res.status(504).send('Transcoding timeout');
      }
    }, 30000);
    return;
  }

  // Create directory
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Setup FFmpeg
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  activeJobs.set(fileId, true);

  console.log(`Starting FFmpeg transcode for ${fileId}...`);

  const ffmpegCommand = ffmpeg(driveUrl)
    .inputOptions([
      // Add custom header using native FFmpeg option
      `-headers`,
      `Authorization: Bearer ${token}\r\n`
    ])
    .outputOptions([
      '-profile:v baseline', // compatibility
      '-level 3.0',
      '-start_number 0',
      '-hls_time 10',          // 10 second segments
      '-hls_list_size 0',      // Keep all segments for VOD
      '-f hls'
    ])
    .output(m3u8File)
    .on('start', (commandLine) => {
      console.log('Spawned FFmpeg with command: ' + commandLine);
    })
    .on('end', () => {
      console.log(`Transcoding finished for ${fileId}`);
      activeJobs.delete(fileId);
    })
    .on('error', (err, stdout, stderr) => {
      console.error('Error transcoding: ' + err.message);
      // Only delete if it severely failed before creating the m3u8
      if (!fs.existsSync(m3u8File)) {
         activeJobs.delete(fileId);
         fs.rmSync(outDir, { recursive: true, force: true });
      }
    });

  ffmpegCommand.run();

  // Wait for the m3u8 file to be created before sending response
  const checkInterval = setInterval(() => {
    if (fs.existsSync(m3u8File)) {
      clearInterval(checkInterval);
      return res.sendFile(m3u8File);
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(checkInterval);
    if (!res.headersSent) {
      res.status(504).send('Transcoding took too long to start');
    }
  }, 30000);
});

// Serve static segments
app.use('/api/video', express.static(tempDir));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HLS Video Backend running on http://localhost:${PORT}`);
});
