// ========================================
// CloudMount – Configuration
// ========================================
// Replace these placeholder values with your real API credentials
// from the respective developer consoles.

export const config = {
  // Google Drive API
  // Get credentials at: https://console.cloud.google.com/apis/credentials
  googleDrive: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    scopes: 'https://www.googleapis.com/auth/drive',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    redirectUri: window.location.origin,
  },



  // Simulated mode: set to false when you have real API keys above
  useSimulatedApi: true,

  // Simulated network latency range (ms) for realistic feel
  simulatedLatency: { min: 400, max: 1200 },
};
