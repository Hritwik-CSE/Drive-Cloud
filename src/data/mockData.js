// ========================================
// CloudMount – Mock Cloud Data
// ========================================

export const drives = [
  {
    id: 'gdrive',
    name: 'Google Drive',
    email: 'user@gmail.com',
    icon: '🟦',
    color: '#cccccc',
    connected: true,
    usedGB: 8.4,
    totalGB: 15,
  },

  {
    id: 'mega',
    name: 'MEGA',
    email: 'user@mega.nz',
    icon: '🔴',
    color: '#888888',
    connected: false,
    usedGB: 0,
    totalGB: 20,
  },
];

function file(name, type, size, modified) {
  return { name, type, size, modified, isFolder: false };
}

function folder(name, children, modified) {
  return { name, type: 'folder', size: null, modified, isFolder: true, children };
}

// Public domain sample video URLs
const sampleVideos = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
];

export function getVideoUrl(index = 0) {
  return sampleVideos[index % sampleVideos.length];
}

export const fileSystems = {
  gdrive: [
    folder('Documents', [
      file('Project Brief.pdf', 'document', '2.4 MB', 'Mar 14, 2026'),
      file('Budget 2026.xlsx', 'document', '540 KB', 'Mar 12, 2026'),
      file('Notes.docx', 'document', '128 KB', 'Mar 10, 2026'),
      folder('Contracts', [
        file('NDA_ClientA.pdf', 'document', '1.1 MB', 'Feb 28, 2026'),
        file('Service_Agreement.pdf', 'document', '890 KB', 'Feb 20, 2026'),
      ], 'Feb 28, 2026'),
    ], 'Mar 14, 2026'),
    folder('Photos', [
      file('vacation_001.jpg', 'image', '4.8 MB', 'Mar 8, 2026'),
      file('vacation_002.jpg', 'image', '5.1 MB', 'Mar 8, 2026'),
      file('vacation_003.jpg', 'image', '3.9 MB', 'Mar 8, 2026'),
      file('family_dinner.png', 'image', '6.2 MB', 'Mar 5, 2026'),
      folder('Screenshots', [
        file('screen_2026-03-01.png', 'image', '1.2 MB', 'Mar 1, 2026'),
        file('screen_2026-02-15.png', 'image', '980 KB', 'Feb 15, 2026'),
      ], 'Mar 1, 2026'),
    ], 'Mar 8, 2026'),
    folder('Videos', [
      file('Big Buck Bunny.mp4', 'video', '158 MB', 'Mar 6, 2026'),
      file('Elephants Dream.mp4', 'video', '120 MB', 'Mar 5, 2026'),
      file('Birthday Party.mp4', 'video', '342 MB', 'Feb 20, 2026'),
    ], 'Mar 6, 2026'),
    folder('Music', [
      file('Chill Mix.mp3', 'audio', '8.4 MB', 'Mar 3, 2026'),
      file('Morning Vibes.mp3', 'audio', '6.1 MB', 'Mar 1, 2026'),
      file('Focus Beats.mp3', 'audio', '9.2 MB', 'Feb 28, 2026'),
    ], 'Mar 3, 2026'),
    file('resume_2026.pdf', 'document', '320 KB', 'Mar 15, 2026'),
    file('cover_letter.docx', 'document', '98 KB', 'Mar 15, 2026'),
  ],

  mega: [],
};

export const storageBreakdown = {
  gdrive: [
    { label: 'Videos', size: '3.8 GB', percentage: 45, color: '#e0e0e0' },
    { label: 'Photos', size: '2.1 GB', percentage: 25, color: '#b0b0b0' },
    { label: 'Documents', size: '1.5 GB', percentage: 18, color: '#808080' },
    { label: 'Other', size: '1.0 GB', percentage: 12, color: '#606060' },
  ],

};
