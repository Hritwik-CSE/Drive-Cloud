// ========================================
// CloudMount – Authentication Module
// ========================================
// Handles OAuth 2.0 flows for each cloud provider.
// Currently uses simulated auth. Replace the simulated
// functions with real OAuth when you have API credentials.

import { config } from '../config.js';

// In-memory token store (backed by localStorage for persistence)
const TOKEN_STORAGE_KEY = 'cloudmount_tokens';

function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveTokens(tokens) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

let tokens = loadTokens();

// ── Simulated OAuth ────────────────────────────────────

function simulateDelay() {
  const { min, max } = config.simulatedLatency;
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulatedLogin(provider) {
  await simulateDelay();
  // Simulate a successful OAuth response
  const fakeToken = {
    accessToken: `simulated_${provider}_token_${Date.now()}`,
    refreshToken: `simulated_${provider}_refresh_${Date.now()}`,
    expiresAt: Date.now() + 3600 * 1000, // 1 hour
    provider,
    email: getSimulatedEmail(provider),
  };
  tokens[provider] = fakeToken;
  saveTokens(tokens);
  return fakeToken;
}

function getSimulatedEmail(provider) {
  const emails = {
    gdrive: 'user@gmail.com',
    mega: 'user@mega.nz',
  };
  return emails[provider] || 'user@cloud.com';
}

// ── Real OAuth (stubs – fill in with real SDK calls) ───

async function realLogin(provider) {
  switch (provider) {
    case 'gdrive':
      return loginWithGoogle();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function loginWithGoogle() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: config.googleDrive.clientId,
      scope: config.googleDrive.scopes,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        const token = {
          accessToken: response.access_token,
          refreshToken: null, // Google GIS doesn't provide refresh tokens in browser
          expiresAt: Date.now() + response.expires_in * 1000,
          provider: 'gdrive',
          email: null, // We'll fetch this after login
        };
        tokens['gdrive'] = token;
        saveTokens(tokens);

        // Fetch user email
        fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        })
          .then(res => res.json())
          .then(data => {
            token.email = data.user.emailAddress;
            saveTokens(tokens);
          });

        resolve(token);
      },
      error_callback: (err) => {
        reject(new Error(err?.type === 'popup_closed' ? 'Login cancelled' : 'Google Login Failed'));
      }
    });
    client.requestAccessToken();
  });
}


// ── Public API ─────────────────────────────────────────

export async function login(provider) {
  if (config.useSimulatedApi) {
    return simulatedLogin(provider);
  }
  return realLogin(provider);
}

export async function logout(provider) {
  if (config.useSimulatedApi) {
    await simulateDelay();
  }
  delete tokens[provider];
  saveTokens(tokens);
}

export function getToken(provider) {
  const token = tokens[provider];
  if (!token) return null;

  // Check expiry
  if (token.expiresAt && Date.now() > token.expiresAt) {
    // Token expired – in real use, attempt a refresh here
    delete tokens[provider];
    saveTokens(tokens);
    return null;
  }
  return token.accessToken;
}

export function isAuthenticated(provider) {
  return !!getToken(provider);
}

export function getAuthEmail(provider) {
  const token = tokens[provider];
  return token ? token.email : null;
}
