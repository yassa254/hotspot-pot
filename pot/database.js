/**
 * AirPulse MikroTik Hotspot — Payment Database Engine
 * Manages payment records with Name, Paid Amount, MAC Address, and IP Address.
 * Full CRUD, search, filter, sort, pagination, and CSV export.
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

  // Instant click feedback
  document.querySelectorAll('button, .btn-pill-outlined, .filter-pill').forEach(el => {
    el.addEventListener('pointerdown', () => {
      playClickSound();
      triggerHaptic(8);
    }, { passive: true });
  });

  // ------------------------------------------------------------------------
  // 2. LocalStorage Management & Default Data
  // ------------------------------------------------------------------------
  const DB_STORAGE_KEY = 'airpulse_payment_records';
  const RECORDS_PER_PAGE = 10;

  const sampleNames = [
    'John Kamau', 'Grace Wanjiku', 'Peter Ochieng', 'Mary Akinyi',
    'David Mwangi', 'Faith Nyambura', 'James Kipchoge', 'Sarah Wambui',
    'Michael Otieno', 'Esther Muthoni', 'Kevin Njoroge', 'Angela Chebet',
    'Brian Kiprono', 'Lucy Wairimu', 'Dennis Mutua', 'Caroline Wangari',
    'Patrick Kimani', 'Mercy Nduta', 'Stephen Ndirangu', 'Joyce Adhiambo'
  ];

  const planOptions = [
    { name: '12 Hours', price: 20 },
    { name: '24 Hours', price: 30 },
    { name: '2 Days', price: 50 },
    { name: '5 Days', price: 100 },
    { name: '7 Days', price: 200 },
    { name: 'Monthly', price: 700 }
  ];

  const statusOptions = ['Completed', 'Completed', 'Completed', 'Completed', 'Pending', 'Completed'];

  function generateRandomMac() {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    }
    return mac;
  }

  function generateRandomIp() {
    const subnet = Math.floor(Math.random() * 200) + 20;
    return `192.168.88.${subnet}`;
  }

  const kenyanBanks = [
    'Equity Bank', 'KCB Bank', 'Co-operative Bank', 'NCBA Bank',
    'Stanbic Bank', 'Absa Bank', 'DTB Bank', 'Standard Chartered'
  ];

  function generateTransactionId() {
    return 'TUMA-BNK-' + Math.floor(100000 + Math.random() * 900000);
  }

  function randomDateWithinDays(maxDaysAgo) {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * maxDaysAgo);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    now.setDate(now.getDate() - daysAgo);
    now.setHours(now.getHours() - hoursAgo);
    now.setMinutes(now.getMinutes() - minutesAgo);
    return now.toISOString();
  }

  function generateDefaultRecords() {
    const records = [];
    for (let i = 0; i < 25; i++) {
      const plan = planOptions[Math.floor(Math.random() * planOptions.length)];
      const bank = kenyanBanks[Math.floor(Math.random() * kenyanBanks.length)];
      const isBankDirect = Math.random() > 0.35;
      records.push({
        id: generateTransactionId(),
        name: sampleNames[Math.floor(Math.random() * sampleNames.length)],
        amount: plan.price,
        bank: bank,
        account: '0180293847291',
        channel: isBankDirect ? 'Tuma Bank Transfer' : 'Tuma STK to Bank',
        mac: generateRandomMac(),
        ip: generateRandomIp(),
        plan: `${plan.name} — KES ${plan.price}`,
        status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
        date: randomDateWithinDays(45),
        phone: `+2547${Math.floor(Math.random() * 90000000 + 10000000)}`
      });
    }
    // Sort by date descending
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    return records;
  }

  function getStoredRecords() {
    try {
      const data = localStorage.getItem(DB_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return generateDefaultRecords();
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {}
  }

  let records = getStoredRecords();

  // ------------------------------------------------------------------------
  // 3. State Management
  // ------------------------------------------------------------------------
  let currentPage = 1;
  let currentFilter = 'all';
  let currentSearch = '';
  let currentSort = { field: 'date', direction: 'desc' };
  let editingRecordId = null;

  // DOM References
  const searchInput = document.getElementById('db-search-input');
  const recordsTbody = document.getElementById('records-tbody');
  const emptyState = document.getElementById('db-empty-state');
  const tableWrapper = document.querySelector('.db-table-wrapper');
  const paginationInfo = document.getElementById('pagination-info');
  const paginationPages = document.getElementById('pagination-pages');
  const btnPrevPage = document.getElementById('btn-prev-page');
  const btnNextPage = document.getElementById('btn-next-page');

  // Metrics
  const metricTotalRecords = document.getElementById('metric-total-records');
  const metricTotalRevenue = document.getElementById('metric-total-revenue');
  const metricUniqueClients = document.getElementById('metric-unique-clients');
  const metricLastEntry = document.getElementById('metric-last-entry');
  const dbRecordCount = document.getElementById('db-record-count');

  // Modal elements
  const recordModalScrim = document.getElementById('record-modal-scrim');
  const btnCloseRecordModal = document.getElementById('btn-close-record-modal');
  const formAddRecord = document.getElementById('form-add-record');
  const modalTimestamp = document.getElementById('modal-timestamp');
  const recordModalTitle = document.getElementById('record-modal-title');

  // Detail modal
  const detailModalScrim = document.getElementById('detail-modal-scrim');
  const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
  const btnCloseDetailBottom = document.getElementById('btn-close-detail-bottom');
  const detailReceiptContent = document.getElementById('detail-receipt-content');

  // ------------------------------------------------------------------------
  // 4. Filtering & Sorting Logic
  // ------------------------------------------------------------------------
  function getFilteredRecords() {
    let filtered = [...records];

    // Apply date filter
    const now = new Date();
    if (currentFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date.split('T')[0] === todayStr);
    } else if (currentFilter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(r => new Date(r.date) >= weekAgo);
    } else if (currentFilter === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(r => new Date(r.date) >= monthAgo);
    }

    // Apply search
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.mac.toLowerCase().includes(q) ||
        r.ip.toLowerCase().includes(q) ||
        r.amount.toString().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.plan.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      let valA, valB;
      switch (currentSort.field) {
        case 'id': valA = a.id; valB = b.id; break;
        case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
        case 'amount': valA = a.amount; valB = b.amount; break;
        case 'mac': valA = a.mac; valB = b.mac; break;
        case 'ip': valA = a.ip; valB = b.ip; break;
        case 'plan': valA = a.plan; valB = b.plan; break;
        case 'date': valA = new Date(a.date); valB = new Date(b.date); break;
        case 'status': valA = a.status; valB = b.status; break;
        default: valA = a.id; valB = b.id;
      }

      if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  // ------------------------------------------------------------------------
  // 5. Render Functions
  // ------------------------------------------------------------------------
  function formatDate(isoStr) {
    const d = new Date(isoStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  }

  function formatDateShort(isoStr) {
    const d = new Date(isoStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  }

  function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      case 'refunded': return 'status-refunded';
      default: return 'status-completed';
    }
  }

  function updateMetrics() {
    const totalRecords = records.length;
    const totalRevenue = records
      .filter(r => r.status === 'Completed')
      .reduce((sum, r) => sum + r.amount, 0);
    const uniqueMacs = new Set(records.map(r => r.mac)).size;

    if (metricTotalRecords) metricTotalRecords.textContent = totalRecords;
    if (metricTotalRevenue) metricTotalRevenue.innerHTML = `KES <small>${totalRevenue.toLocaleString()}</small>`;
    if (metricUniqueClients) metricUniqueClients.textContent = uniqueMacs;
    if (dbRecordCount) dbRecordCount.textContent = `${totalRecords} Entries`;

    if (metricLastEntry && records.length > 0) {
      const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
      metricLastEntry.textContent = formatDateShort(sorted[0].date);
    } else if (metricLastEntry) {
      metricLastEntry.textContent = '—';
    }
  }

  function renderTable() {
    const filtered = getFilteredRecords();
    const totalPages = Math.max(1, Math.ceil(filtered.length / RECORDS_PER_PAGE));

    // Clamp current page
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * RECORDS_PER_PAGE;
    const endIdx = Math.min(startIdx + RECORDS_PER_PAGE, filtered.length);
    const pageRecords = filtered.slice(startIdx, endIdx);

    // Show/hide table vs empty state
    if (filtered.length === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (document.getElementById('db-pagination')) document.getElementById('db-pagination').style.display = 'none';
    } else {
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';
      if (document.getElementById('db-pagination')) document.getElementById('db-pagination').style.display = 'flex';
    }

    // Render rows
    recordsTbody.innerHTML = '';
    pageRecords.forEach((record, idx) => {
      const tr = document.createElement('tr');
      tr.style.animationDelay = `${(idx + 1) * 0.03}s`;

      tr.innerHTML = `
        <td class="td-id">${record.id}</td>
        <td class="td-name">${escapeHtml(record.name)}</td>
        <td class="td-amount">KES ${record.amount.toLocaleString()}</td>
        <td class="td-mac">${record.mac}</td>
        <td class="td-ip">${record.ip}</td>
        <td class="td-plan">${record.plan}</td>
        <td class="td-date">${formatDate(record.date)}</td>
        <td>
          <span class="status-badge ${getStatusBadgeClass(record.status)}">
            <span class="status-dot"></span>
            ${record.status}
          </span>
        </td>
        <td>
          <div class="td-actions">
            <button class="row-action-btn" data-view-id="${record.id}" title="View Details">VIEW</button>
            <button class="row-action-btn delete-btn" data-delete-id="${record.id}" title="Delete Record">&times;</button>
          </div>
        </td>
      `;

      recordsTbody.appendChild(tr);
    });

    // Wire row action listeners
    recordsTbody.querySelectorAll('[data-view-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view-id');
        openDetailModal(id);
      });
    });

    recordsTbody.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-id');
        deleteRecord(id);
      });
    });

    // Pagination info
    if (paginationInfo) {
      paginationInfo.textContent = filtered.length > 0
        ? `Showing ${startIdx + 1}–${endIdx} of ${filtered.length} records`
        : 'No records';
    }

    // Pagination buttons
    if (btnPrevPage) btnPrevPage.disabled = currentPage <= 1;
    if (btnNextPage) btnNextPage.disabled = currentPage >= totalPages;

    // Page number buttons
    if (paginationPages) {
      paginationPages.innerHTML = '';
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-num-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
          currentPage = i;
          renderTable();
        });
        paginationPages.appendChild(btn);
      }
    }

    // Update sort header visual
    document.querySelectorAll('.th-sortable').forEach(th => {
      const field = th.getAttribute('data-sort');
      th.classList.toggle('sort-active', field === currentSort.field);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) {
        if (field === currentSort.field) {
          arrow.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
        } else {
          arrow.textContent = '';
        }
      }
    });

    updateMetrics();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ------------------------------------------------------------------------
  // 6. CRUD Operations
  // ------------------------------------------------------------------------
  function addRecord(recordData) {
    const newRecord = {
      id: generateTransactionId(),
      name: recordData.name,
      amount: parseInt(recordData.amount, 10),
      mac: recordData.mac.toUpperCase(),
      ip: recordData.ip,
      plan: recordData.plan,
      status: recordData.status || 'Completed',
      date: new Date().toISOString(),
      phone: recordData.phone || ''
    };

    records.unshift(newRecord);
    saveRecords(records);
    currentPage = 1;
    renderTable();
    playSuccessChime();
    triggerHaptic([20, 80, 40]);
    showToast(`Payment record for "${newRecord.name}" added successfully!`);
  }

  function deleteRecord(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    if (confirm(`Delete payment record for "${record.name}" (${record.id})?`)) {
      records = records.filter(r => r.id !== id);
      saveRecords(records);
      renderTable();
      showToast(`Record "${record.id}" deleted.`);
    }
  }

  function clearAllRecords() {
    if (confirm('Are you sure you want to delete ALL payment records? This cannot be undone.')) {
      records = [];
      saveRecords(records);
      currentPage = 1;
      renderTable();
      showToast('All payment records cleared.');
    }
  }

  // ------------------------------------------------------------------------
  // 7. Add Record Modal
  // ------------------------------------------------------------------------
  function openRecordModal() {
    editingRecordId = null;
    recordModalTitle.textContent = 'Add Payment Record';

    // Reset form
    formAddRecord.reset();
    if (modalTimestamp) {
      modalTimestamp.textContent = formatDate(new Date().toISOString());
    }

    recordModalScrim.classList.add('active');
    recordModalScrim.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      const nameInput = document.getElementById('input-client-name');
      if (nameInput) nameInput.focus();
    }, 150);
  }

  function closeRecordModal() {
    recordModalScrim.classList.remove('active');
    recordModalScrim.setAttribute('aria-hidden', 'true');
    editingRecordId = null;
  }

  // Open modal triggers
  const btnAddRecord = document.getElementById('btn-add-record');
  const btnHeroAddRecord = document.getElementById('btn-hero-add-record');
  const btnEmptyAdd = document.getElementById('btn-empty-add');

  if (btnAddRecord) btnAddRecord.addEventListener('click', openRecordModal);
  if (btnHeroAddRecord) btnHeroAddRecord.addEventListener('click', openRecordModal);
  if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openRecordModal);

  if (btnCloseRecordModal) btnCloseRecordModal.addEventListener('click', closeRecordModal);
  if (recordModalScrim) {
    recordModalScrim.addEventListener('click', (e) => {
      if (e.target === recordModalScrim) closeRecordModal();
    });
  }

  // Auto-fill sample button
  const btnGenerateRandom = document.getElementById('btn-generate-random');
  if (btnGenerateRandom) {
    btnGenerateRandom.addEventListener('click', () => {
      const plan = planOptions[Math.floor(Math.random() * planOptions.length)];
      document.getElementById('input-client-name').value = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      document.getElementById('input-paid-amount').value = plan.price;
      document.getElementById('input-mac-address').value = generateRandomMac();
      document.getElementById('input-ip-address').value = generateRandomIp();
      document.getElementById('select-plan-type').value = `${plan.name} — KES ${plan.price}`;
      document.getElementById('select-record-status').value = 'Completed';
      playClickSound();
      triggerHaptic(10);
    });
  }

  // Form submission
  if (formAddRecord) {
    formAddRecord.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('input-client-name').value.trim();
      const amount = document.getElementById('input-paid-amount').value;
      const mac = document.getElementById('input-mac-address').value.trim();
      const ip = document.getElementById('input-ip-address').value.trim();
      const plan = document.getElementById('select-plan-type').value;
      const status = document.getElementById('select-record-status').value;

      if (!name || !amount || !mac || !ip) {
        showToast('Please fill in all required fields.');
        return;
      }

      addRecord({ name, amount, mac, ip, plan, status });
      closeRecordModal();
      formAddRecord.reset();
    });
  }

  // ------------------------------------------------------------------------
  // 8. Detail Modal
  // ------------------------------------------------------------------------
  function openDetailModal(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    if (detailReceiptContent) {
      detailReceiptContent.innerHTML = `
        <div class="detail-row">
          <span class="detail-label">TRANSACTION ID</span>
          <span class="detail-value">${record.id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">CLIENT NAME</span>
          <span class="detail-value">${escapeHtml(record.name)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">PAID AMOUNT</span>
          <span class="detail-value highlight">KES ${record.amount.toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">MAC ADDRESS</span>
          <span class="detail-value">${record.mac}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">IP ADDRESS</span>
          <span class="detail-value">${record.ip}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">PLAN</span>
          <span class="detail-value">${record.plan}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">DATE & TIME</span>
          <span class="detail-value">${formatDate(record.date)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">STATUS</span>
          <span class="detail-value">
            <span class="status-badge ${getStatusBadgeClass(record.status)}">
              <span class="status-dot"></span>
              ${record.status}
            </span>
          </span>
        </div>
        ${record.phone ? `
        <div class="detail-row">
          <span class="detail-label">PHONE</span>
          <span class="detail-value">${record.phone}</span>
        </div>` : ''}
      `;
    }

    detailModalScrim.classList.add('active');
    detailModalScrim.setAttribute('aria-hidden', 'false');
  }

  function closeDetailModal() {
    detailModalScrim.classList.remove('active');
    detailModalScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnCloseDetailModal) btnCloseDetailModal.addEventListener('click', closeDetailModal);
  if (btnCloseDetailBottom) btnCloseDetailBottom.addEventListener('click', closeDetailModal);
  if (detailModalScrim) {
    detailModalScrim.addEventListener('click', (e) => {
      if (e.target === detailModalScrim) closeDetailModal();
    });
  }

  // ------------------------------------------------------------------------
  // 9. Search, Filter & Sort Handlers
  // ------------------------------------------------------------------------
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      currentPage = 1;
      renderTable();
    });
  }

  // Filter pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      currentPage = 1;
      renderTable();
    });
  });

  // Column sort
  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
      }
      currentPage = 1;
      renderTable();
    });
  });

  // Pagination
  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      const filtered = getFilteredRecords();
      const totalPages = Math.ceil(filtered.length / RECORDS_PER_PAGE);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });
  }

  // ------------------------------------------------------------------------
  // 10. Export CSV
  // ------------------------------------------------------------------------
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (records.length === 0) {
        showToast('No records to export.');
        return;
      }

      const headers = ['Transaction ID', 'Client Name', 'Paid Amount (KES)', 'MAC Address', 'IP Address', 'Plan', 'Status', 'Date', 'Phone'];
      const csvRows = [headers.join(',')];

      records.forEach(r => {
        csvRows.push([
          r.id,
          `"${r.name}"`,
          r.amount,
          r.mac,
          r.ip,
          `"${r.plan}"`,
          r.status,
          formatDate(r.date),
          r.phone || ''
        ].join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `airpulse_payments_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      playSuccessChime();
      showToast(`Exported ${records.length} records to CSV.`);
    });
  }

  // Clear all
  const btnClearAll = document.getElementById('btn-clear-all');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', clearAllRecords);
  }

  // ------------------------------------------------------------------------
  // 11. Keyboard Shortcuts
  // ------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRecordModal();
      closeDetailModal();
    }
  });

  // ------------------------------------------------------------------------
  // 12. Toast Notification Helper
  // ------------------------------------------------------------------------
  const toastContainer = document.getElementById('toast-container');
  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'apple-toast';
    toast.innerHTML = `
      <span style="color:var(--color-periwinkle-annotation);">✓</span>
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
  // 13. Initial Render
  // ------------------------------------------------------------------------
  renderTable();

});
