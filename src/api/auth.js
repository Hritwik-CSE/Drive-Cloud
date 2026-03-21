// ========================================
// CloudMount – Authentication Module
// ========================================

import { config } from '../config.js';

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
  const email = getSimulatedEmail(provider) + `+${Date.now()}@cloud.com`; 
  const id = `${provider}_${email}`;
  
  const fakeToken = {
    id,
    accessToken: `simulated_${provider}_token_${Date.now()}`,
    refreshToken: `simulated_${provider}_refresh_${Date.now()}`,
    expiresAt: Date.now() + 3600 * 1000,
    provider,
    email,
  };
  tokens[id] = fakeToken;
  saveTokens(tokens);
  return fakeToken;
}

function getSimulatedEmail(provider) {
  const emails = {
    gdrive: 'user',
    mega: 'user',
  };
  return emails[provider] || 'user';
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
        
        // Fetch user email to use as ID
        fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        })
          .then(res => res.json())
          .then(data => {
            const email = data.user.emailAddress;
            const id = `gdrive_${email}`;
            const token = {
              id,
              accessToken: response.access_token,
              refreshToken: null,
              expiresAt: Date.now() + response.expires_in * 1000,
              provider: 'gdrive',
              email: email,
            };
            tokens[id] = token;
            saveTokens(tokens);
            resolve(token);
          })
          .catch(err => reject(new Error('Failed to fetch user email')));
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

export async function logout(id) {
  if (config.useSimulatedApi) {
    await simulateDelay();
  }
  delete tokens[id];
  saveTokens(tokens);
}

export function getToken(id) {
  const token = tokens[id];
  if (!token) return null;

  if (token.expiresAt && Date.now() > token.expiresAt) {
    delete tokens[id];
    saveTokens(tokens);
    return null;
  }
  return token.accessToken;
}

export function isAuthenticated(id) {
  return !!getToken(id);
}

export function getAuthEmail(id) {
  const token = tokens[id];
  return token ? token.email : null;
}

export function getAllTokens() {
  // Validate expiry and return all valid tokens
  const activeTokens = [];
  for (const id in tokens) {
    const t = tokens[id];
    if (t.expiresAt && Date.now() > t.expiresAt) {
      delete tokens[id];
    } else {
      activeTokens.push(t);
    }
  }
  saveTokens(tokens);
  return activeTokens;
}

