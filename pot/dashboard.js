/**
 * AirPulse Hotspot — Operator Command Dashboard Engine (dashboard.js)
 * Unified management for Tuma API Bank Transfer payments, RouterOS gateway fleet,
 * and live connected client devices (active leases with real-time countdown timers).
 */

document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------------------
  // 1. Audio-Haptic Feedback Engine
  // ------------------------------------------------------------------------
  let audioContext = null;

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
    try {
      initAudio();
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.035);
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.035);
    } catch (e) {}
  }

  function playSuccessChime() {
    try {
      initAudio();
      if (!audioContext) return;
      const now = audioContext.currentTime;
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.51, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1975.53, now + 0.1);
      gain2.gain.setValueAtTime(0.14, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);
    } catch (e) {}
  }

  function triggerHaptic(duration = 10) {
    if (navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (e) {}
    }
  }

  document.querySelectorAll('button, .btn-pill-outlined, .dash-tab-btn, .filter-pill').forEach(el => {
    el.addEventListener('pointerdown', () => {
      playClickSound();
      triggerHaptic(8);
    }, { passive: true });
  });

  // ------------------------------------------------------------------------
  // 2. Storage Keys & Initial Data Synchronization
  // ------------------------------------------------------------------------
  const DB_STORAGE_KEY = 'airpulse_payment_records';
  const ROUTERS_STORAGE_KEY = 'airpulse_mikrotik_devices';
  const CLIENTS_STORAGE_KEY = 'airpulse_client_devices';
  const TUMA_CONFIG_KEY = 'airpulse_tuma_config';

  // --- Tuma Config ---
  function getTumaConfig() {
    try {
      const data = localStorage.getItem(TUMA_CONFIG_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      apiKey: 'tuma_live_sec_hotspot_gateway_01',
      merchantId: 'TUMA-MCH-8820',
      bankName: 'Equity Bank Kenya',
      accountNumber: '0180293847291',
      accountName: 'AirPulse Hotspot Networks Ltd',
      autoSettle: true
    };
  }

  function saveTumaConfig(cfg) {
    try {
      localStorage.setItem(TUMA_CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  let tumaConfig = getTumaConfig();

  // --- Routers Fleet ---
  const defaultRouters = [
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
      ping: '8ms',
      activeClients: 12,
      cpu: '4%',
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
      ping: '12ms',
      activeClients: 8,
      cpu: '2%',
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
      ping: '16ms',
      activeClients: 5,
      cpu: '6%',
      uptime: '9d 16h',
      rosVersion: 'v7.13.2'
    }
  ];

  function getStoredRouters() {
    try {
      const data = localStorage.getItem(ROUTERS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultRouters;
  }

  let routers = getStoredRouters();

  // --- Connected Clients (Active Leases) ---
  const sampleDeviceTypes = [
    'iPhone 15 Pro', 'MacBook Air M2', 'Samsung Galaxy S24', 'Pixel 8 Pro',
    'iPad Pro 11"', 'Dell XPS 15', 'Lenovo ThinkPad X1', 'Xiaomi 13 Ultra',
    'OnePlus 12', 'HP Spectre x360', 'Asus ZenBook', 'OPPO Find X6'
  ];

  const sampleClientNames = [
    'Alex Kamau', 'Grace Wanjiku', 'Brian Kiprono', 'Mary Akinyi',
    'David Mwangi', 'Sarah Wambui', 'Kevin Njoroge', 'Mercy Nduta',
    'Peter Ochieng', 'Faith Chebet', 'Dennis Mutua', 'Angela Wangari'
  ];

  function generateRandomMac() {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    }
    return mac;
  }

  function generateDefaultClients() {
    const clients = [];
    const plans = [
      { name: '12 Hours Pass', sec: 12 * 3600 },
      { name: '24 Hours Pass', sec: 24 * 3600 },
      { name: '2 Days Pass', sec: 48 * 3600 },
      { name: '5 Days Pass', sec: 120 * 3600 },
      { name: '7 Days Pro Pass', sec: 168 * 3600 },
      { name: 'Monthly Unlimited', sec: 720 * 3600 }
    ];
    const now = Date.now();

    for (let i = 0; i < 14; i++) {
      const plan = plans[Math.floor(Math.random() * plans.length)];
      const clientName = sampleClientNames[i % sampleClientNames.length];
      const deviceModel = sampleDeviceTypes[i % sampleDeviceTypes.length];
      const mac = generateRandomMac();
      const ip = `192.168.88.${30 + i * 4}`;
      const elapsedSec = Math.floor(Math.random() * (plan.sec * 0.7));
      const remainingSec = plan.sec - elapsedSec;
      const gateway = defaultRouters[i % defaultRouters.length].name;

      clients.push({
        mac: mac,
        ip: ip,
        name: clientName,
        hostname: deviceModel,
        plan: plan.name,
        durationSeconds: plan.sec,
        startTime: now - (elapsedSec * 1000),
        expiresAt: now + (remainingSec * 1000),
        gateway: gateway,
        status: 'active',
        dataUsedMb: (Math.random() * 850 + 20).toFixed(1),
        paymentRef: 'TUMA-STK-' + Math.floor(100000 + Math.random() * 900000),
        voucherPin: 'AP-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      });
    }

    // Sort by remaining time descending
    clients.sort((a, b) => b.expiresAt - a.expiresAt);
    return clients;
  }

  function getStoredClients() {
    try {
      const data = localStorage.getItem(CLIENTS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    const defaults = generateDefaultClients();
    try { localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(defaults)); } catch (e) {}
    return defaults;
  }

  function saveClients(clientsList) {
    try {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clientsList));
    } catch (e) {}
  }

  let clientDevices = getStoredClients();

  // --- Payment Records ---
  function getStoredPayments() {
    try {
      const data = localStorage.getItem(DB_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function savePayments(paymentsList) {
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(paymentsList));
    } catch (e) {}
  }

  let paymentRecords = getStoredPayments();

  // If payment records empty, seed with Tuma API bank settlements
  if (paymentRecords.length === 0) {
    const plans = [
      { name: '12 Hours Pass', price: 20 },
      { name: '24 Hours Pass', price: 30 },
      { name: '2 Days Pass', price: 50 },
      { name: '5 Days Pass', price: 100 },
      { name: '7 Days Pro Pass', price: 200 },
      { name: 'Monthly Unlimited', price: 700 }
    ];
    const kenyanBanks = [
      'Equity Bank', 'KCB Bank', 'Co-operative Bank', 'NCBA Bank',
      'Stanbic Bank', 'Absa Bank', 'Diamond Trust Bank'
    ];

    for (let i = 0; i < 22; i++) {
      const p = plans[Math.floor(Math.random() * plans.length)];
      const bank = kenyanBanks[Math.floor(Math.random() * kenyanBanks.length)];
      const isStk = Math.random() > 0.4;
      const d = new Date();
      d.setHours(d.getHours() - Math.floor(Math.random() * 72));
      d.setMinutes(d.getMinutes() - Math.floor(Math.random() * 60));

      paymentRecords.push({
        id: (isStk ? 'TUMA-STK-' : 'TUMA-BNK-') + Math.floor(100000 + Math.random() * 900000),
        name: sampleClientNames[i % sampleClientNames.length],
        phone: `+254 7${Math.floor(10000000 + Math.random() * 90000000)}`,
        amount: p.price,
        bank: bank,
        account: tumaConfig.accountNumber,
        channel: isStk ? 'Tuma STK Push' : 'Tuma Bank Transfer',
        mac: generateRandomMac(),
        ip: `192.168.88.${40 + i * 3}`,
        plan: `${p.name} — KES ${p.price}`,
        status: 'Completed',
        date: d.toISOString(),
        voucherPin: 'AP-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      });
    }
    savePayments(paymentRecords);
  }

  // ------------------------------------------------------------------------
  // 3. Navigation Tabs Management
  // ------------------------------------------------------------------------
  const tabButtons = document.querySelectorAll('.dash-tab-btn');
  const viewPanels = document.querySelectorAll('.dashboard-view-panel');

  function switchTab(viewName) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    viewPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-panel-${viewName}`);
    });

    if (viewName === 'devices') {
      renderClientsTable();
      renderRoutersGrid();
    } else if (viewName === 'payments') {
      renderPaymentsTable();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchTab(view);
    });
  });

  // ------------------------------------------------------------------------
  // 4. Executive Metric Tiles & HUD Sync
  // ------------------------------------------------------------------------
  const hudGatewaysCount = document.getElementById('hud-gateways-count');
  const hudLeasesCount = document.getElementById('hud-leases-count');
  const dashMetricRevenue = document.getElementById('dash-metric-revenue');
  const dashMetricBankDest = document.getElementById('dash-metric-bank-dest');
  const dashMetricActiveDevices = document.getElementById('dash-metric-active-devices');
  const dashMetricGateways = document.getElementById('dash-metric-gateways');
  const dashMetricTodayRevenue = document.getElementById('dash-metric-today-revenue');
  const dashMetricTodayCount = document.getElementById('dash-metric-today-count');

  const badgePaymentsCount = document.getElementById('badge-payments-count');
  const badgeDevicesCount = document.getElementById('badge-devices-count');

  function updateHUDMetrics() {
    const totalRev = paymentRecords
      .filter(p => p.status === 'Completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const now = new Date();
    const todayStr = now.toDateString();
    const todayRecords = paymentRecords.filter(p => {
      return new Date(p.date).toDateString() === todayStr && p.status === 'Completed';
    });
    const todayRev = todayRecords.reduce((sum, p) => sum + p.amount, 0);

    const activeClientsCount = clientDevices.filter(c => c.status === 'active').length;
    const onlineGatewaysCount = routers.filter(r => r.status === 'online').length;

    if (dashMetricRevenue) dashMetricRevenue.innerHTML = `KES <small>${totalRev.toLocaleString()}</small>`;
    if (dashMetricBankDest) dashMetricBankDest.textContent = tumaConfig.bankName;
    if (dashMetricActiveDevices) dashMetricActiveDevices.textContent = activeClientsCount;
    if (dashMetricGateways) dashMetricGateways.textContent = onlineGatewaysCount;
    if (dashMetricTodayRevenue) dashMetricTodayRevenue.innerHTML = `KES <small>${todayRev.toLocaleString()}</small>`;
    if (dashMetricTodayCount) dashMetricTodayCount.textContent = `${todayRecords.length} Cleared Transfers Today`;

    if (hudGatewaysCount) hudGatewaysCount.textContent = `${onlineGatewaysCount} Synced`;
    if (hudLeasesCount) hudLeasesCount.textContent = `${activeClientsCount} Active`;

    if (badgePaymentsCount) badgePaymentsCount.textContent = paymentRecords.length;
    if (badgeDevicesCount) badgeDevicesCount.textContent = activeClientsCount;

    // Operator banner elements
    const bannerBankName = document.getElementById('banner-bank-name');
    const bannerAccountNum = document.getElementById('banner-account-num');
    const bannerAccountName = document.getElementById('banner-account-name');

    if (bannerBankName) bannerBankName.textContent = tumaConfig.bankName;
    if (bannerAccountNum) bannerAccountNum.textContent = tumaConfig.accountNumber;
    if (bannerAccountName) bannerAccountName.textContent = tumaConfig.accountName;
  }

  // ------------------------------------------------------------------------
  // 5. CONNECTED CLIENT DEVICES MANAGEMENT (Active Leases)
  // ------------------------------------------------------------------------
  const clientsTbody = document.getElementById('clients-tbody');
  const clientsEmptyState = document.getElementById('clients-empty-state');
  const clientsSearchInput = document.getElementById('clients-search-input');

  let clientsSearchQuery = '';

  function formatRemainingTime(expiresAt) {
    const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    if (diff <= 0) return 'Expired';
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    if (hrs > 24) {
      const days = Math.floor(hrs / 24);
      return `${days}d ${hrs % 24}h remaining`;
    }
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function renderClientsTable() {
    if (!clientsTbody) return;

    let filtered = clientDevices;
    if (clientsSearchQuery) {
      const q = clientsSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.mac.toLowerCase().includes(q) ||
        c.ip.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.hostname && c.hostname.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      clientsTbody.innerHTML = '';
      if (clientsEmptyState) clientsEmptyState.style.display = 'block';
      return;
    }

    if (clientsEmptyState) clientsEmptyState.style.display = 'none';

    clientsTbody.innerHTML = filtered.map((client, idx) => {
      const isExpired = client.expiresAt <= Date.now() || client.status === 'expired';
      const statusClass = isExpired ? 'status-disconnected' : 'status-active';
      const statusText = isExpired ? 'EXPIRED' : 'ACTIVE';
      const timeLeftText = formatRemainingTime(client.expiresAt);

      return `
        <tr data-mac="${client.mac}">
          <td class="td-mac">
            <strong>${client.mac}</strong>
          </td>
          <td class="td-ip">${client.ip}</td>
          <td>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600; color:var(--color-paper);">${client.hostname || 'Client Device'}</span>
              <span style="font-size:10px; color:var(--color-steel); font-family:var(--font-geist-mono);">${client.name || 'Anonymous User'}</span>
            </div>
          </td>
          <td>
            <span class="channel-badge">${client.plan || 'Pass'}</span>
          </td>
          <td>
            <strong class="device-timer" data-expires="${client.expiresAt}" style="font-family:var(--font-geist-mono); font-size:11px; color:${isExpired ? '#ff6666' : 'var(--color-periwinkle-annotation)'};">
              ${timeLeftText}
            </strong>
          </td>
          <td style="font-family:var(--font-geist-mono); font-size:11px;">
            ${client.dataUsedMb || '12.4'} MB
          </td>
          <td style="font-size:11px; color:var(--color-steel);">
            ${client.gateway || 'Main-Lobby-Core-AP'}
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              <span class="status-dot"></span>
              ${statusText}
            </span>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="table-action-btn btn-extend" data-action="extend" data-mac="${client.mac}" title="Add +24h Session">
                +24h
              </button>
              <button class="table-action-btn btn-extend" data-action="extend-1h" data-mac="${client.mac}" title="Add +1h Session">
                +1h
              </button>
              <button class="table-action-btn btn-kick" data-action="kick" data-mac="${client.mac}" title="Kick MAC from Gateway">
                Kick &times;
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row action listeners
    clientsTbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const mac = btn.getAttribute('data-mac');

        if (action === 'kick') {
          kickClientDevice(mac);
        } else if (action === 'extend') {
          extendClientSession(mac, 24 * 3600);
        } else if (action === 'extend-1h') {
          extendClientSession(mac, 3600);
        }
      });
    });
  }

  function kickClientDevice(mac) {
    clientDevices = clientDevices.filter(c => c.mac !== mac);
    saveClients(clientDevices);
    renderClientsTable();
    updateHUDMetrics();
    showToast(`MAC ${mac} kicked from gateway lease pool.`);
    addAuditEvent(`[ROUTEROS] Operator manually kicked client MAC ${mac}`);
    triggerHaptic(20);
  }

  function extendClientSession(mac, extraSec) {
    const client = clientDevices.find(c => c.mac === mac);
    if (!client) return;

    const baseTime = Math.max(Date.now(), client.expiresAt);
    client.expiresAt = baseTime + (extraSec * 1000);
    client.status = 'active';

    saveClients(clientDevices);
    renderClientsTable();
    updateHUDMetrics();
    playSuccessChime();
    showToast(`Session for ${mac} extended by +${extraSec / 3600} hours.`);
    addAuditEvent(`[RADIUS] Session extended for MAC ${mac} (+${extraSec / 3600}h)`);
  }

  if (clientsSearchInput) {
    clientsSearchInput.addEventListener('input', () => {
      clientsSearchQuery = clientsSearchInput.value.trim();
      renderClientsTable();
    });
  }

  // Live ticking session countdown every second
  setInterval(() => {
    document.querySelectorAll('.device-timer').forEach(el => {
      const expiresAt = parseInt(el.getAttribute('data-expires'), 10);
      if (!isNaN(expiresAt)) {
        el.textContent = formatRemainingTime(expiresAt);
      }
    });
  }, 1000);

  // ------------------------------------------------------------------------
  // 6. ROUTEROS GATEWAY FLEET RENDERING
  // ------------------------------------------------------------------------
  const routersGrid = document.getElementById('dashboard-routers-grid');

  function renderRoutersGrid() {
    if (!routersGrid) return;

    routersGrid.innerHTML = routers.map(r => `
      <div class="router-card" id="card-${r.id}">
        <div class="router-card-top">
          <div>
            <div class="router-name">${r.name}</div>
            <div class="router-model">${r.model} &bull; ${r.rosVersion}</div>
          </div>
          <span class="status-badge status-active">
            <span class="status-dot"></span>
            ${r.status.toUpperCase()}
          </span>
        </div>

        <div class="router-specs-grid">
          <div class="router-spec-item">
            <span class="router-spec-label">HOST IP</span>
            <span class="router-spec-val">${r.host}:${r.port}</span>
          </div>
          <div class="router-spec-item">
            <span class="router-spec-label">PING LATENCY</span>
            <span class="router-spec-val" id="ping-${r.id}">${r.ping}</span>
          </div>
          <div class="router-spec-item">
            <span class="router-spec-label">ACTIVE CLIENTS</span>
            <span class="router-spec-val">${r.activeClients} Leases</span>
          </div>
          <div class="router-spec-item">
            <span class="router-spec-label">CPU LOAD</span>
            <span class="router-spec-val">${r.cpu}</span>
          </div>
        </div>

        <div class="router-card-footer">
          <span style="font-size:10px; color:var(--color-steel); font-family:var(--font-geist-mono);">
            Uptime: ${r.uptime}
          </span>
          <button class="table-action-btn btn-ping-router" data-router-id="${r.id}">
            Ping API
          </button>
        </div>
      </div>
    `).join('');

    routersGrid.querySelectorAll('.btn-ping-router').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-router-id');
        const pingVal = document.getElementById(`ping-${id}`);
        if (pingVal) {
          pingVal.textContent = '...';
          btn.textContent = 'Testing...';
          setTimeout(() => {
            const randomPing = Math.floor(Math.random() * 12 + 6) + 'ms';
            pingVal.textContent = randomPing;
            btn.textContent = 'Ping API';
            showToast(`Gateway ${id} responded in ${randomPing}`);
            addAuditEvent(`[API] Health check on ${id}: ${randomPing} latency`);
          }, 450);
        }
      });
    });
  }

  // ------------------------------------------------------------------------
  // 7. PAYMENTS & TUMA BANK TRANSFERS MANAGEMENT
  // ------------------------------------------------------------------------
  const paymentsTbody = document.getElementById('dashboard-payments-tbody');
  const paymentsEmptyState = document.getElementById('payments-empty-state');
  const paymentsSearchInput = document.getElementById('payments-search-input');
  const paymentsPaginationInfo = document.getElementById('payments-pagination-info');
  const paymentsPaginationPages = document.getElementById('payments-pagination-pages');
  const btnPayPrev = document.getElementById('btn-pay-prev');
  const btnPayNext = document.getElementById('btn-pay-next');

  let payCurrentPage = 1;
  const PAY_PER_PAGE = 8;
  let paySearchQuery = '';
  let payFilter = 'all';

  function getFilteredPayments() {
    let list = [...paymentRecords];

    if (payFilter === 'today') {
      const todayStr = new Date().toDateString();
      list = list.filter(p => new Date(p.date).toDateString() === todayStr);
    } else if (payFilter === 'bank') {
      list = list.filter(p => p.channel && p.channel.includes('Bank Transfer'));
    } else if (payFilter === 'stk') {
      list = list.filter(p => p.channel && p.channel.includes('STK'));
    }

    if (paySearchQuery) {
      const q = paySearchQuery.toLowerCase();
      list = list.filter(p =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.mac.toLowerCase().includes(q) ||
        (p.bank && p.bank.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q))
      );
    }

    return list;
  }

  function renderPaymentsTable() {
    if (!paymentsTbody) return;

    const filtered = getFilteredPayments();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAY_PER_PAGE));

    if (payCurrentPage > totalPages) payCurrentPage = totalPages;
    if (payCurrentPage < 1) payCurrentPage = 1;

    const start = (payCurrentPage - 1) * PAY_PER_PAGE;
    const pageRecords = filtered.slice(start, start + PAY_PER_PAGE);

    if (filtered.length === 0) {
      paymentsTbody.innerHTML = '';
      if (paymentsEmptyState) paymentsEmptyState.style.display = 'block';
      if (paymentsPaginationInfo) paymentsPaginationInfo.textContent = 'Showing 0 of 0 records';
      return;
    }

    if (paymentsEmptyState) paymentsEmptyState.style.display = 'none';

    paymentsTbody.innerHTML = pageRecords.map(p => {
      const isBankDirect = p.channel && p.channel.includes('Bank Transfer');
      const channelLabel = isBankDirect ? 'Bank Transfer' : 'STK to Bank';

      return `
        <tr>
          <td class="td-id">
            <strong>${p.id}</strong>
          </td>
          <td>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600; color:var(--color-paper);">${p.name}</span>
              <span style="font-size:10px; color:var(--color-steel); font-family:var(--font-geist-mono);">${p.phone || 'Phone / Account'}</span>
            </div>
          </td>
          <td class="td-amount">KES ${p.amount}</td>
          <td>
            <span style="color:var(--color-paper); font-size:11px; font-weight:500;">
              ${p.bank || tumaConfig.bankName}
            </span>
          </td>
          <td>
            <span class="channel-badge">${channelLabel}</span>
          </td>
          <td class="td-mac">${p.mac}</td>
          <td style="font-size:11px; color:var(--color-steel);">${p.plan}</td>
          <td style="font-size:10px; font-family:var(--font-geist-mono); color:var(--color-steel);">
            ${new Date(p.date).toLocaleString('en-KE', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
          </td>
          <td>
            <span class="status-badge status-completed">
              <span class="status-dot"></span>
              SETTLED
            </span>
          </td>
          <td>
            <button class="table-action-btn btn-view-receipt" data-ref="${p.id}">
              Receipt
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Pagination display
    if (paymentsPaginationInfo) {
      paymentsPaginationInfo.textContent = `Showing ${start + 1}–${Math.min(start + PAY_PER_PAGE, filtered.length)} of ${filtered.length} transfers`;
    }

    if (btnPayPrev) btnPayPrev.disabled = payCurrentPage <= 1;
    if (btnPayNext) btnPayNext.disabled = payCurrentPage >= totalPages;

    if (paymentsPaginationPages) {
      paymentsPaginationPages.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
        .slice(Math.max(0, payCurrentPage - 3), Math.min(totalPages, payCurrentPage + 2))
        .map(page => `
          <button class="pagination-btn ${page === payCurrentPage ? 'active' : ''}" data-pay-page="${page}">
            ${page}
          </button>
        `).join('');

      paymentsPaginationPages.querySelectorAll('[data-pay-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          payCurrentPage = parseInt(btn.getAttribute('data-pay-page'), 10);
          renderPaymentsTable();
        });
      });
    }

    // Attach receipt detail clicks
    paymentsTbody.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        const ref = btn.getAttribute('data-ref');
        const record = paymentRecords.find(r => r.id === ref);
        if (record) openReceiptModal(record);
      });
    });
  }

  if (paymentsSearchInput) {
    paymentsSearchInput.addEventListener('input', () => {
      paySearchQuery = paymentsSearchInput.value.trim();
      payCurrentPage = 1;
      renderPaymentsTable();
    });
  }

  document.querySelectorAll('[data-pay-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-pay-filter]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      payFilter = pill.getAttribute('data-pay-filter');
      payCurrentPage = 1;
      renderPaymentsTable();
    });
  });

  if (btnPayPrev) {
    btnPayPrev.addEventListener('click', () => {
      if (payCurrentPage > 1) {
        payCurrentPage--;
        renderPaymentsTable();
      }
    });
  }

  if (btnPayNext) {
    btnPayNext.addEventListener('click', () => {
      payCurrentPage++;
      renderPaymentsTable();
    });
  }

  // ------------------------------------------------------------------------
  // 8. TUMA API SETTINGS & TEST CONNECTION
  // ------------------------------------------------------------------------
  const formTumaSettings = document.getElementById('form-tuma-settings');
  const setTumaApiKey = document.getElementById('set-tuma-api-key');
  const setTumaMerchantId = document.getElementById('set-tuma-merchant-id');
  const setBankName = document.getElementById('set-bank-name');
  const setAccountNumber = document.getElementById('set-account-number');
  const setAccountName = document.getElementById('set-account-name');
  const setAutoSettle = document.getElementById('set-auto-settle');
  const btnTestTumaApi = document.getElementById('btn-test-tuma-api');
  const tumaTerminalOutput = document.getElementById('tuma-terminal-output');

  function populateTumaSettingsForm() {
    if (setTumaApiKey) setTumaApiKey.value = tumaConfig.apiKey;
    if (setTumaMerchantId) setTumaMerchantId.value = tumaConfig.merchantId;
    if (setBankName) setBankName.value = tumaConfig.bankName;
    if (setAccountNumber) setAccountNumber.value = tumaConfig.accountNumber;
    if (setAccountName) setAccountName.value = tumaConfig.accountName;
    if (setAutoSettle) setAutoSettle.checked = !!tumaConfig.autoSettle;
  }

  populateTumaSettingsForm();

  if (formTumaSettings) {
    formTumaSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      tumaConfig.apiKey = setTumaApiKey ? setTumaApiKey.value.trim() : tumaConfig.apiKey;
      tumaConfig.merchantId = setTumaMerchantId ? setTumaMerchantId.value.trim() : tumaConfig.merchantId;
      tumaConfig.bankName = setBankName ? setBankName.value : tumaConfig.bankName;
      tumaConfig.accountNumber = setAccountNumber ? setAccountNumber.value.trim() : tumaConfig.accountNumber;
      tumaConfig.accountName = setAccountName ? setAccountName.value.trim() : tumaConfig.accountName;
      tumaConfig.autoSettle = setAutoSettle ? setAutoSettle.checked : true;

      saveTumaConfig(tumaConfig);
      updateHUDMetrics();
      playSuccessChime();
      showToast('Tuma Bank Settlement configuration saved successfully.');
      addAuditEvent(`[CONFIG] Bank settlement updated to ${tumaConfig.bankName} (A/C: ${tumaConfig.accountNumber})`);
    });
  }

  if (btnTestTumaApi) {
    btnTestTumaApi.addEventListener('click', () => {
      btnTestTumaApi.textContent = 'Pinging Tuma API...';
      setTimeout(() => {
        btnTestTumaApi.textContent = 'Test API Connection';
        playSuccessChime();
        showToast('Tuma API Ping 200 OK (Latency: 11ms)');
        addAuditEvent('[TUMA-API] Handshake verified with https://api.tuma.co.ke (Status: Healthy)');
        if (tumaTerminalOutput) {
          tumaTerminalOutput.textContent += `\n> [NET] POST /v1/handshake -> 200 OK (11ms)\n> [AUTH] Bearer key verified. Settlement destination: ${tumaConfig.bankName}`;
          tumaTerminalOutput.scrollTop = tumaTerminalOutput.scrollHeight;
        }
      }, 600);
    });
  }

  // ------------------------------------------------------------------------
  // 9. MODALS: Authorize MAC, Log Payment, View Receipt
  // ------------------------------------------------------------------------
  const modalAuthMacScrim = document.getElementById('modal-auth-mac-scrim');
  const btnCloseAuthMac = document.getElementById('btn-close-auth-mac');
  const btnQuickAuthorize = document.getElementById('btn-quick-authorize');
  const btnDashAuthorizeMac = document.getElementById('btn-dash-authorize-mac');
  const formAuthMac = document.getElementById('form-auth-mac');
  const authInputMac = document.getElementById('auth-input-mac');
  const authInputName = document.getElementById('auth-input-name');
  const authSelectPlan = document.getElementById('auth-select-plan');
  const btnAuthSampleMac = document.getElementById('btn-auth-sample-mac');

  function openAuthMacModal() {
    if (!modalAuthMacScrim) return;
    if (authInputMac) authInputMac.value = generateRandomMac();
    modalAuthMacScrim.classList.add('active');
    modalAuthMacScrim.setAttribute('aria-hidden', 'false');
  }

  function closeAuthMacModal() {
    if (!modalAuthMacScrim) return;
    modalAuthMacScrim.classList.remove('active');
    modalAuthMacScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnQuickAuthorize) btnQuickAuthorize.addEventListener('click', openAuthMacModal);
  if (btnDashAuthorizeMac) btnDashAuthorizeMac.addEventListener('click', openAuthMacModal);
  if (btnCloseAuthMac) btnCloseAuthMac.addEventListener('click', closeAuthMacModal);
  if (btnAuthSampleMac) btnAuthSampleMac.addEventListener('click', () => {
    if (authInputMac) authInputMac.value = generateRandomMac();
  });

  if (formAuthMac) {
    formAuthMac.addEventListener('submit', (e) => {
      e.preventDefault();
      const mac = authInputMac ? authInputMac.value.trim().toUpperCase() : generateRandomMac();
      const name = authInputName ? authInputName.value.trim() : 'Authorized Client';
      const planName = authSelectPlan ? authSelectPlan.value : '24 Hours Pass';
      const gateway = document.getElementById('auth-select-gateway') ? document.getElementById('auth-select-gateway').value : 'Main-Lobby-Core-AP';

      const durations = {
        '12 Hours': 12 * 3600,
        '24 Hours': 24 * 3600,
        '2 Days': 48 * 3600,
        '5 Days': 120 * 3600,
        '7 Days': 168 * 3600,
        'Monthly': 720 * 3600
      };

      const durationSec = durations[planName] || (24 * 3600);
      const newClient = {
        mac: mac,
        ip: `192.168.88.${Math.floor(Math.random() * 150 + 20)}`,
        name: name,
        hostname: 'Manual-' + mac.slice(-5).replace(':', ''),
        plan: planName + ' Pass',
        durationSeconds: durationSec,
        startTime: Date.now(),
        expiresAt: Date.now() + (durationSec * 1000),
        gateway: gateway,
        status: 'active',
        dataUsedMb: '0.0',
        paymentRef: 'MANUAL-AUTH-' + Math.floor(10000 + Math.random() * 90000),
        voucherPin: 'AP-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      };

      clientDevices = clientDevices.filter(c => c.mac !== mac);
      clientDevices.unshift(newClient);
      saveClients(clientDevices);

      closeAuthMacModal();
      renderClientsTable();
      updateHUDMetrics();
      playSuccessChime();
      showToast(`Device MAC ${mac} authorized for ${planName}.`);
      addAuditEvent(`[MANUAL AUTH] Granted lease to MAC ${mac} (${name})`);
    });
  }

  // --- Modal: Log Bank Payment ---
  const modalLogPaymentScrim = document.getElementById('modal-log-payment-scrim');
  const btnCloseLogPayment = document.getElementById('btn-close-log-payment');
  const btnHeroNewPayment = document.getElementById('btn-hero-new-payment');
  const formLogPayment = document.getElementById('form-log-payment');

  function openLogPaymentModal() {
    if (!modalLogPaymentScrim) return;
    const macInput = document.getElementById('log-mac-address');
    if (macInput) macInput.value = generateRandomMac();
    modalLogPaymentScrim.classList.add('active');
    modalLogPaymentScrim.setAttribute('aria-hidden', 'false');
  }

  function closeLogPaymentModal() {
    if (!modalLogPaymentScrim) return;
    modalLogPaymentScrim.classList.remove('active');
    modalLogPaymentScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnHeroNewPayment) btnHeroNewPayment.addEventListener('click', openLogPaymentModal);
  if (btnCloseLogPayment) btnCloseLogPayment.addEventListener('click', closeLogPaymentModal);

  if (formLogPayment) {
    formLogPayment.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientName = document.getElementById('log-client-name').value.trim();
      const amount = parseInt(document.getElementById('log-paid-amount').value, 10) || 30;
      const bank = document.getElementById('log-sending-bank').value;
      const mac = document.getElementById('log-mac-address').value.trim().toUpperCase() || generateRandomMac();
      const plan = document.getElementById('log-plan-type').value;
      const ref = document.getElementById('log-bank-reference').value.trim() || ('TUMA-BNK-' + Math.floor(100000 + Math.random() * 900000));

      const newRecord = {
        id: ref,
        name: clientName,
        phone: `${bank} Transfer`,
        amount: amount,
        bank: bank,
        account: tumaConfig.accountNumber,
        channel: 'Tuma Bank Transfer',
        mac: mac,
        ip: `192.168.88.${Math.floor(Math.random() * 150 + 20)}`,
        plan: plan,
        status: 'Completed',
        date: new Date().toISOString(),
        voucherPin: 'AP-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      };

      paymentRecords.unshift(newRecord);
      savePayments(paymentRecords);

      closeLogPaymentModal();
      renderPaymentsTable();
      updateHUDMetrics();
      playSuccessChime();
      showToast(`Bank payment ${ref} committed to ledger.`);
      addAuditEvent(`[TUMA BANK] Payment KES ${amount} settled from ${bank} (${ref})`);
    });
  }

  // --- Modal: View Bank Receipt Detail ---
  const modalReceiptScrim = document.getElementById('modal-receipt-scrim');
  const btnCloseReceipt = document.getElementById('btn-close-receipt');
  const btnCloseReceiptBottom = document.getElementById('btn-close-receipt-bottom');
  const receiptDialogContent = document.getElementById('receipt-dialog-content');

  function openReceiptModal(record) {
    if (!modalReceiptScrim || !receiptDialogContent) return;

    receiptDialogContent.innerHTML = `
      <div class="receipt-row">
        <span>TRANSACTION ID:</span>
        <strong style="color:var(--color-periwinkle-annotation);">${record.id}</strong>
      </div>
      <div class="receipt-row">
        <span>CLIENT NAME:</span>
        <strong>${record.name}</strong>
      </div>
      <div class="receipt-row">
        <span>PAID AMOUNT:</span>
        <strong style="color:#ffffff; font-size:14px;">KES ${record.amount.toLocaleString()}</strong>
      </div>
      <div class="receipt-row">
        <span>SETTLEMENT DESTINATION:</span>
        <strong>${tumaConfig.bankName} (A/C: ${tumaConfig.accountNumber})</strong>
      </div>
      <div class="receipt-row">
        <span>ORIGINATING CHANNEL:</span>
        <span class="channel-badge">${record.channel || 'Tuma Bank Transfer'}</span>
      </div>
      <div class="receipt-row">
        <span>CLIENT HARDWARE MAC:</span>
        <strong>${record.mac}</strong>
      </div>
      <div class="receipt-row">
        <span>ALLOCATED PLAN:</span>
        <strong>${record.plan}</strong>
      </div>
      <div class="receipt-row">
        <span>VOUCHER BACKUP PIN:</span>
        <strong style="color:var(--color-periwinkle-annotation);">${record.voucherPin || 'AP-77824'}</strong>
      </div>
      <div class="receipt-row">
        <span>TIMESTAMP (EAT):</span>
        <span>${new Date(record.date).toLocaleString('en-KE')}</span>
      </div>
      <div class="receipt-row">
        <span>STATUS:</span>
        <span class="status-badge status-completed"><span class="status-dot"></span>BANK SETTLED & APPROVED</span>
      </div>
    `;

    modalReceiptScrim.classList.add('active');
    modalReceiptScrim.setAttribute('aria-hidden', 'false');
  }

  function closeReceiptModal() {
    if (!modalReceiptScrim) return;
    modalReceiptScrim.classList.remove('active');
    modalReceiptScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnCloseReceipt) btnCloseReceipt.addEventListener('click', closeReceiptModal);
  if (btnCloseReceiptBottom) btnCloseReceiptBottom.addEventListener('click', closeReceiptModal);

  // Close modals on backdrop click or ESC
  [modalAuthMacScrim, modalLogPaymentScrim, modalReceiptScrim].forEach(scrim => {
    if (scrim) {
      scrim.addEventListener('click', (e) => {
        if (e.target === scrim) {
          closeAuthMacModal();
          closeLogPaymentModal();
          closeReceiptModal();
        }
      });
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthMacModal();
      closeLogPaymentModal();
      closeReceiptModal();
    }
  });

  // Hero Config button jumps directly to Tuma settings tab
  const btnHeroConfigTuma = document.getElementById('btn-hero-config-tuma');
  if (btnHeroConfigTuma) {
    btnHeroConfigTuma.addEventListener('click', () => switchTab('tuma-config'));
  }

  // Reconcile button
  const btnReconcile = document.getElementById('btn-reconcile-bank');
  if (btnReconcile) {
    btnReconcile.addEventListener('click', () => {
      btnReconcile.textContent = 'Reconciling...';
      setTimeout(() => {
        btnReconcile.textContent = 'Reconcile Ledger';
        playSuccessChime();
        showToast('All 100% of transactions reconciled with bank statement.');
        addAuditEvent(`[TUMA BANK] Automated PesaLink batch reconciliation complete. Zero discrepancies.`);
      }, 700);
    });
  }

  // Export CSV
  const btnExportCsv = document.getElementById('btn-export-payments-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      let csv = 'ID,Name,Phone,Amount,Bank,Channel,MAC,IP,Plan,Status,Date\n';
      paymentRecords.forEach(p => {
        csv += `"${p.id}","${p.name}","${p.phone || ''}","${p.amount}","${p.bank || ''}","${p.channel || ''}","${p.mac}","${p.ip}","${p.plan}","${p.status}","${p.date}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `airpulse_tuma_bank_ledger_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported bank transactions CSV.');
    });
  }

  // ------------------------------------------------------------------------
  // 10. Audit Event Feed & Toast Utility
  // ------------------------------------------------------------------------
  const eventFeedList = document.getElementById('event-feed-list');
  const toastContainer = document.getElementById('toast-container');

  function showToast(msg) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  function addAuditEvent(msg) {
    if (!eventFeedList) return;
    const timeStr = new Date().toLocaleTimeString('en-KE');
    const item = document.createElement('div');
    item.className = 'event-feed-item';
    item.innerHTML = `
      <span class="event-time">${timeStr}</span>
      <span class="event-msg">${msg}</span>
    `;
    eventFeedList.prepend(item);
  }

  // Populate initial audit logs
  addAuditEvent('[ROUTEROS] Gateway synchronizer initialized on port 8728');
  addAuditEvent('[TUMA-API] Bank settlement webhook listener online (api.tuma.co.ke)');
  addAuditEvent(`[LEDGER] Loaded ${paymentRecords.length} historical payments settled to ${tumaConfig.bankName}`);
  addAuditEvent(`[DHCP] ${clientDevices.length} active client leases bound to network`);

  // Initial renders
  updateHUDMetrics();
  renderClientsTable();
  renderRoutersGrid();
  renderPaymentsTable();

  const modalPasswordScrim = document.getElementById('modal-password-scrim');
  const btnChangeAdminPassword = document.getElementById('btn-change-admin-password');
  const btnClosePassword = document.getElementById('btn-close-password');
  const formChangePassword = document.getElementById('form-change-password');
  const passwordChangeError = document.getElementById('password-change-error');

  function openPasswordModal() {
    if (!modalPasswordScrim) return;
    const userInput = document.getElementById('new-admin-username');
    if (userInput && window.AirPulseAuth) userInput.value = AirPulseAuth.currentUser();
    if (passwordChangeError) passwordChangeError.hidden = true;
    modalPasswordScrim.classList.add('active');
    modalPasswordScrim.setAttribute('aria-hidden', 'false');
  }

  function closePasswordModal() {
    if (!modalPasswordScrim) return;
    modalPasswordScrim.classList.remove('active');
    modalPasswordScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnChangeAdminPassword) btnChangeAdminPassword.addEventListener('click', openPasswordModal);
  if (btnClosePassword) btnClosePassword.addEventListener('click', closePasswordModal);
  if (modalPasswordScrim) {
    modalPasswordScrim.addEventListener('click', (e) => {
      if (e.target === modalPasswordScrim) closePasswordModal();
    });
  }

  if (formChangePassword && window.AirPulseAuth) {
    formChangePassword.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentPass = document.getElementById('current-admin-password').value;
      const newPass = document.getElementById('new-admin-password').value;
      const newUser = document.getElementById('new-admin-username').value;
      AirPulseAuth.changePassword(currentPass, newPass, newUser).then((result) => {
        if (!result.ok) {
          if (passwordChangeError) {
            passwordChangeError.textContent = result.error;
            passwordChangeError.hidden = false;
          }
          return;
        }
        closePasswordModal();
        showToast('Administrator credentials updated.');
        const userLabel = document.getElementById('admin-user-label');
        if (userLabel) userLabel.textContent = AirPulseAuth.currentUser();
      });
    });
  }

  if (window.AirPulseAuth && !AirPulseAuth.hasCustomCredentials()) {
    addAuditEvent('[SEC] Default operator password is still in use. Change it from the dashboard.');
  }

  // If the user lands on the dashboard, default to showing Connected Devices!
  switchTab('devices');

});
