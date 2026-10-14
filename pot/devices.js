/**
 * Apple Design System — MikroTik Device Manager Logic
 * Manages RouterOS gateway provisioning, API handshakes,
 * live telemetry simulation, and CLI script generation.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------------------
  // 1. Audio-Haptic Engine
  // ------------------------------------------------------------------------
  let audioContext = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  function playClickSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.04);
    } catch (e) {}
  }

  function playSuccessChime() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioContext) return;
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1318.51, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  function triggerHaptic(duration = 10) {
    if (navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (e) {}
    }
  }

  // Sound Toggle Button
  const soundToggleBtn = document.getElementById('sound-toggle');
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggleBtn.classList.toggle('muted', !soundEnabled);
      if (soundEnabled) {
        initAudio();
        playClickSound();
        triggerHaptic(10);
      }
    });
  }

  // Instant pointerdown feedback
  document.querySelectorAll('button, .nav-brand, .router-card').forEach(el => {
    el.addEventListener('pointerdown', () => {
      playClickSound();
      triggerHaptic(8);
    }, { passive: true });
  });

  // ------------------------------------------------------------------------
  // 2. Initial Data & LocalStorage Management
  // ------------------------------------------------------------------------
  const STORAGE_KEY = 'airpulse_mikrotik_devices';

  const defaultDevices = [
    {
      id: 'mt-01',
      name: 'Main-Lobby-Core-AP',
      model: 'hAP ax³ (Wi-Fi 6)',
      site: 'Main Terminal Lobby',
      host: '192.168.88.1',
      port: 8728,
      hotspotServer: 'hotspot1',
      dnsDomain: 'wifi.airpulse.net',
      status: 'online',
      ping: '9ms',
      activeClients: 114,
      cpu: '5%',
      uptime: '18d 04h',
      rosVersion: 'v7.14.3'
    },
    {
      id: 'mt-02',
      name: 'East-Wing-CCR-Gateway',
      model: 'CCR2004-16G-2S+',
      site: 'East Lounge & Food Court',
      host: '192.168.89.1',
      port: 8728,
      hotspotServer: 'hotspot-east',
      dnsDomain: 'east.airpulse.net',
      status: 'online',
      ping: '14ms',
      activeClients: 89,
      cpu: '3%',
      uptime: '42d 11h',
      rosVersion: 'v7.15.1'
    },
    {
      id: 'mt-03',
      name: 'Outdoor-Campus-AP',
      model: 'RB750Gr3 (hEX)',
      site: 'Garden & Quad',
      host: '192.168.90.1',
      port: 8728,
      hotspotServer: 'hotspot-garden',
      dnsDomain: 'garden.airpulse.net',
      status: 'online',
      ping: '18ms',
      activeClients: 45,
      cpu: '8%',
      uptime: '9d 16h',
      rosVersion: 'v7.13.2'
    }
  ];

  function getStoredDevices() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultDevices;
  }

  function saveDevices(devices) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    } catch (e) {}
  }

  let devices = getStoredDevices();

  // ------------------------------------------------------------------------
  // 3. UI Rendering & Fleet Telemetry Updates
  // ------------------------------------------------------------------------
  const devicesContainer = document.getElementById('devices-container');
  const metricTotalRouters = document.getElementById('metric-total-routers');
  const metricActiveClients = document.getElementById('metric-active-clients');
  const fleetSummaryText = document.getElementById('fleet-summary-text');
  const searchInput = document.getElementById('device-search-input');

  function renderDevices(filterQuery = '') {
    devicesContainer.innerHTML = '';

    const query = filterQuery.trim().toLowerCase();
    const filtered = devices.filter(d => 
      d.name.toLowerCase().includes(query) ||
      d.host.toLowerCase().includes(query) ||
      d.site.toLowerCase().includes(query) ||
      d.model.toLowerCase().includes(query)
    );

    // Update fleet metrics
    if (metricTotalRouters) metricTotalRouters.textContent = devices.length;
    const totalClients = devices.reduce((sum, d) => sum + (d.activeClients || 0), 0);
    if (metricActiveClients) metricActiveClients.textContent = totalClients;
    if (fleetSummaryText) fleetSummaryText.textContent = `${devices.length} Gateways Synchronized`;

    if (filtered.length === 0) {
      devicesContainer.innerHTML = `
        <div class="empty-devices-box">
          <div class="empty-icon">📡</div>
          <h3 class="empty-title">${query ? 'No Gateways Found' : 'No MikroTik Devices Configured'}</h3>
          <p class="empty-desc">${query ? `No routers match "${filterQuery}". Try checking the IP or name.` : 'Get started by adding your first MikroTik RouterOS gateway.'}</p>
          <button class="btn-apple-large" id="empty-state-add-btn">
            + Add MikroTik Gateway
          </button>
        </div>
      `;
      const emptyAddBtn = document.getElementById('empty-state-add-btn');
      if (emptyAddBtn) emptyAddBtn.addEventListener('click', openAddModal);
      return;
    }

    filtered.forEach(device => {
      const card = document.createElement('article');
      card.className = 'router-card';
      card.id = `card-${device.id}`;

      card.innerHTML = `
        <div>
          <div class="router-card-header">
            <span class="router-status-badge ${device.status === 'offline' ? 'offline' : ''}">
              <span class="dot"></span>
              <span>${device.status === 'offline' ? 'Offline' : `Online &bull; ${device.ping}`}</span>
            </span>

            <button class="router-delete-btn" data-delete-id="${device.id}" title="Remove Router" aria-label="Remove Router">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>

          <div class="router-main-info">
            <h3 class="router-name">${device.name}</h3>
            <div class="router-meta-row">
              <span class="router-site-pill">${device.site || 'Default Site'}</span>
              <span>&bull;</span>
              <span>${device.model}</span>
            </div>
          </div>

          <div class="router-specs-grid">
            <div class="spec-cell">
              <span class="spec-label">IP &amp; Port</span>
              <span class="spec-value">${device.host}:${device.port}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">Hotspot Server</span>
              <span class="spec-value">${device.hotspotServer}</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">Connected Clients</span>
              <span class="spec-value text-emerald">${device.activeClients} active</span>
            </div>
            <div class="spec-cell">
              <span class="spec-label">RouterOS Version</span>
              <span class="spec-value">${device.rosVersion || 'v7.14.3'}</span>
            </div>
          </div>
        </div>

        <div class="router-card-actions">
          <button class="btn-card-action" data-ping-id="${device.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Test Ping</span>
          </button>

          <a href="index.html" class="btn-card-action primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>Open Portal</span>
          </a>
        </div>
      `;

      devicesContainer.appendChild(card);
    });

    // Wire action listeners
    devicesContainer.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-delete-id');
        deleteDevice(id);
      });
    });

    devicesContainer.querySelectorAll('[data-ping-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-ping-id');
        testDevicePing(id, btn);
      });
    });
  }

  // Ping simulation on individual card
  function testDevicePing(deviceId, buttonElement) {
    const origHtml = buttonElement.innerHTML;
    buttonElement.innerHTML = `<span class="mini-spinner" style="width:12px;height:12px;"></span><span>Pinging...</span>`;
    buttonElement.style.pointerEvents = 'none';

    setTimeout(() => {
      const pingMs = Math.floor(Math.random() * 12) + 8;
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        device.ping = `${pingMs}ms`;
        device.status = 'online';
        saveDevices(devices);
      }
      playSuccessChime();
      triggerHaptic(15);
      showToast(`Ping to ${device ? device.name : 'Gateway'}: ${pingMs}ms (Healthy)`);
      renderDevices(searchInput ? searchInput.value : '');
    }, 700);
  }

  // Delete Device
  function deleteDevice(deviceId) {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    if (confirm(`Remove "${dev.name}" from managed MikroTik gateways?`)) {
      devices = devices.filter(d => d.id !== deviceId);
      saveDevices(devices);
      renderDevices(searchInput ? searchInput.value : '');
      showToast(`Gateway "${dev.name}" removed.`);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderDevices(e.target.value);
    });
  }

  // ------------------------------------------------------------------------
  // 4. Add Device Modal Management
  // ------------------------------------------------------------------------
  const addDeviceScrim = document.getElementById('add-device-scrim');
  const addDeviceSheet = document.getElementById('add-device-sheet');
  const btnCloseDeviceModal = document.getElementById('btn-close-device-modal');
  const btnTriggerAddModal = document.getElementById('btn-trigger-add-modal');
  const btnHeroAddDevice = document.getElementById('btn-hero-add-device');
  const mobileBtnAddDevice = document.getElementById('mobile-btn-add-device');
  const formAddDevice = document.getElementById('form-add-device');

  // Test connection result elements
  const btnTestConnection = document.getElementById('btn-test-connection');
  const testStateIdle = document.getElementById('test-state-idle');
  const testStateLoading = document.getElementById('test-state-loading');
  const testStateSuccess = document.getElementById('test-state-success');
  const testTargetIp = document.getElementById('test-target-ip');

  function openAddModal() {
    resetTestState();
    addDeviceScrim.classList.add('active');
    addDeviceScrim.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      const nameInput = document.getElementById('input-device-name');
      if (nameInput) nameInput.focus();
    }, 150);
  }

  function closeAddModal() {
    addDeviceScrim.classList.remove('active');
    addDeviceScrim.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (btnTriggerAddModal) btnTriggerAddModal.addEventListener('click', openAddModal);
  if (btnHeroAddDevice) btnHeroAddDevice.addEventListener('click', openAddModal);
  if (mobileBtnAddDevice) {
    mobileBtnAddDevice.addEventListener('click', () => {
      toggleMobileMenu(true);
      openAddModal();
    });
  }
  if (btnCloseDeviceModal) btnCloseDeviceModal.addEventListener('click', closeAddModal);

  addDeviceScrim.addEventListener('click', (e) => {
    if (e.target === addDeviceScrim) closeAddModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAddModal();
  });

  // Swipe dismiss on grab bar
  const deviceGrabBar = document.getElementById('device-sheet-grab-bar');
  if (deviceGrabBar && addDeviceSheet) {
    let startY = 0;
    let isDragging = false;
    let currentY = 0;

    deviceGrabBar.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      isDragging = true;
      deviceGrabBar.setPointerCapture(e.pointerId);
      addDeviceSheet.style.transition = 'none';
    });

    deviceGrabBar.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      if (deltaY > 0) {
        currentY = deltaY;
        addDeviceSheet.style.transform = `translateY(${deltaY}px)`;
      }
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      addDeviceSheet.style.transition = '';
      if (currentY > 80) {
        closeAddModal();
        addDeviceSheet.style.transform = '';
      } else {
        addDeviceSheet.style.transform = 'translateY(0)';
      }
    };

    deviceGrabBar.addEventListener('pointerup', endDrag);
    deviceGrabBar.addEventListener('pointercancel', endDrag);
  }

  // ------------------------------------------------------------------------
  // 5. Test Connection / Handshake Simulation
  // ------------------------------------------------------------------------
  function resetTestState() {
    testStateIdle.style.display = 'flex';
    testStateLoading.style.display = 'none';
    testStateSuccess.style.display = 'none';
  }

  if (btnTestConnection) {
    btnTestConnection.addEventListener('click', () => {
      const hostInput = document.getElementById('input-device-host');
      const host = hostInput ? (hostInput.value.trim() || '192.168.88.1') : '192.168.88.1';
      testTargetIp.textContent = host;

      testStateIdle.style.display = 'none';
      testStateLoading.style.display = 'flex';
      testStateSuccess.style.display = 'none';

      btnTestConnection.disabled = true;

      setTimeout(() => {
        testStateLoading.style.display = 'none';
        testStateSuccess.style.display = 'flex';
        btnTestConnection.disabled = false;
        playSuccessChime();
        triggerHaptic([15, 60, 25]);
      }, 1400);
    });
  }

  // ------------------------------------------------------------------------
  // 6. Save Device Submission
  // ------------------------------------------------------------------------
  if (formAddDevice) {
    formAddDevice.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('input-device-name').value.trim();
      const model = document.getElementById('select-device-model').value;
      const site = document.getElementById('input-device-site').value.trim() || 'Zone 1';
      const host = document.getElementById('input-device-host').value.trim();
      const port = parseInt(document.getElementById('input-device-port').value, 10) || 8728;
      const hotspotServer = document.getElementById('input-hotspot-server').value.trim() || 'hotspot1';
      const dnsDomain = document.getElementById('input-hotspot-dns').value.trim() || 'wifi.airpulse.net';

      const newDevice = {
        id: 'mt-' + Date.now().toString(36),
        name,
        model,
        site,
        host,
        port,
        hotspotServer,
        dnsDomain,
        status: 'online',
        ping: `${Math.floor(Math.random() * 10) + 9}ms`,
        activeClients: Math.floor(Math.random() * 40) + 12,
        cpu: `${Math.floor(Math.random() * 6) + 2}%`,
        uptime: 'Just provisioned',
        rosVersion: 'v7.14.3'
      };

      devices.unshift(newDevice);
      saveDevices(devices);

      playSuccessChime();
      triggerHaptic([20, 80, 40]);
      closeAddModal();
      formAddDevice.reset();
      resetTestState();

      renderDevices(searchInput ? searchInput.value : '');
      showToast(`Gateway "${newDevice.name}" provisioned successfully!`);

      // Scroll smoothly to list
      const listElem = document.getElementById('gateways-list');
      if (listElem) listElem.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ------------------------------------------------------------------------
  // 7. RouterOS CLI Script Copy
  // ------------------------------------------------------------------------
  const btnCopyScript = document.getElementById('btn-copy-script');
  const copyBtnText = document.getElementById('copy-btn-text');
  const mikrotikScriptText = document.getElementById('mikrotik-script-text');

  if (btnCopyScript && mikrotikScriptText) {
    btnCopyScript.addEventListener('click', () => {
      const code = mikrotikScriptText.innerText;
      navigator.clipboard.writeText(code).then(() => {
        btnCopyScript.classList.add('copied');
        copyBtnText.textContent = 'Copied to Clipboard!';
        playSuccessChime();
        triggerHaptic(20);
        showToast('MikroTik setup script copied to clipboard.');

        setTimeout(() => {
          btnCopyScript.classList.remove('copied');
          copyBtnText.textContent = 'Copy Script';
        }, 2500);
      }).catch(() => {
        showToast('Unable to copy automatically. Please select text manually.');
      });
    });
  }

  // ------------------------------------------------------------------------
  // 8. Toast Feedback Helper
  // ------------------------------------------------------------------------
  const toastContainer = document.getElementById('toast-container');
  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'apple-toast';
    toast.innerHTML = `
      <span style="color:var(--apple-emerald);">✓</span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ------------------------------------------------------------------------
  // 9. Mobile Nav Menu Toggle
  // ------------------------------------------------------------------------
  const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
  const mobileNavPanel = document.getElementById('mobile-nav-panel');

  function toggleMobileMenu(forceClose = false) {
    const isOpen = forceClose ? false : !mobileNavPanel.classList.contains('open');
    if (mobileToggleBtn) mobileToggleBtn.classList.toggle('open', isOpen);
    if (mobileNavPanel) mobileNavPanel.classList.toggle('open', isOpen);
  }

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => toggleMobileMenu());
  }

  // Initial render
  renderDevices();

});
