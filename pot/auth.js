/**
 * AirPulse operator authentication (client-side session gate).
 * Protects dashboard, devices, and database pages from hotspot clients.
 * Change the default password immediately after first login.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'airpulse_admin_session';
  var CRED_KEY = 'airpulse_admin_credentials';
  var DEFAULT_USER = 'admin';
  var DEFAULT_PASSWORD = 'AirPulse#Admin';
  var SESSION_HOURS = 12;

  function toHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function sha256(text) {
    var encoded = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', encoded).then(toHex);
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      if (!session || !session.user || !session.expiresAt) return null;
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function currentUser() {
    var session = getSession();
    return session ? session.user : '';
  }

  function hasCustomCredentials() {
    try {
      return !!localStorage.getItem(CRED_KEY);
    } catch (e) {
      return false;
    }
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    var next = 'admin-login.html';
    if (global.location) global.location.replace(next);
  }

  function requireAdmin() {
    if (isLoggedIn()) {
      document.documentElement.classList.remove('auth-pending');
      return true;
    }
    var page = '';
    try {
      page = (location.pathname.split('/').pop() || 'dashboard.html');
    } catch (e) {
      page = 'dashboard.html';
    }
    location.replace('admin-login.html?next=' + encodeURIComponent(page));
    return false;
  }

  function getStoredCredentials() {
    try {
      var raw = localStorage.getItem(CRED_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function login(username, password) {
    var user = (username || '').trim();
    var pass = password || '';
    if (!user || !pass) {
      return Promise.resolve({ ok: false, error: 'Enter username and password.' });
    }

    return sha256(pass).then(function (passHash) {
      var stored = getStoredCredentials();
      var expectedUser;
      var expectedHashPromise;

      if (stored && stored.username && stored.passwordHash) {
        expectedUser = stored.username;
        expectedHashPromise = Promise.resolve(stored.passwordHash);
      } else {
        expectedUser = DEFAULT_USER;
        expectedHashPromise = sha256(DEFAULT_PASSWORD);
      }

      return expectedHashPromise.then(function (expectedHash) {
        if (user !== expectedUser || passHash !== expectedHash) {
          return { ok: false, error: 'Invalid administrator credentials.' };
        }

        var session = {
          user: expectedUser,
          expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, user: expectedUser, mustChangePassword: !hasCustomCredentials() };
      });
    });
  }

  function changePassword(currentPassword, newPassword, newUsername) {
    if (!isLoggedIn()) {
      return Promise.resolve({ ok: false, error: 'Not signed in.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return Promise.resolve({ ok: false, error: 'New password must be at least 8 characters.' });
    }

    return login(currentUser(), currentPassword).then(function (result) {
      if (!result.ok) {
        return { ok: false, error: 'Current password is incorrect.' };
      }
      var nextUser = (newUsername || currentUser()).trim() || currentUser();
      return sha256(newPassword).then(function (hash) {
        localStorage.setItem(CRED_KEY, JSON.stringify({
          username: nextUser,
          passwordHash: hash,
          updatedAt: new Date().toISOString()
        }));
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          user: nextUser,
          expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000
        }));
        return { ok: true };
      });
    });
  }

  function bindAdminChrome() {
    var userEl = document.getElementById('admin-user-label');
    if (userEl) userEl.textContent = currentUser() || 'admin';

    document.querySelectorAll('[data-admin-logout]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        logout();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', bindAdminChrome);

  global.AirPulseAuth = {
    isLoggedIn: isLoggedIn,
    currentUser: currentUser,
    requireAdmin: requireAdmin,
    login: login,
    logout: logout,
    changePassword: changePassword,
    hasCustomCredentials: hasCustomCredentials
  };
})(window);
