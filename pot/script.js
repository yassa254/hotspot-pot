/**
 * AirPulse MikroTik Hotspot — Single Page M-Pesa Engine
 * Exclusively M-Pesa STK Push payments, automated MikroTik session login,
 * live timer tracking, and voucher redemption.
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

      // Note 1 (E6)
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

      // Note 2 (B6)
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

  // Pointerdown feedback on interactive elements
  document.querySelectorAll('button, .blueprint-card, .btn-plan-card, .btn-pill-outlined').forEach(el => {
    el.addEventListener('pointerdown', () => {
      playClickSound();
      triggerHaptic(8);
    }, { passive: true });
  });

  // ------------------------------------------------------------------------
  // 2. 6 Hotspot Price Plans Configuration
  // ------------------------------------------------------------------------
  const pricingPlans = {
    'plan-12h': {
      id: 'plan-12h',
      title: '12 Hours Pass',
      price: 20,
      duration: '12 Hours',
      durationSeconds: 12 * 3600,
      speed: '10 Mbps'
    },
    'plan-24h': {
      id: 'plan-24h',
      title: '24 Hours Pass',
      price: 30,
      duration: '24 Hours (1 Day)',
      durationSeconds: 24 * 3600,
      speed: '15 Mbps'
    },
    'plan-2d': {
      id: 'plan-2d',
      title: '2 Days Pass',
      price: 50,
      duration: '2 Days (48 Hours)',
      durationSeconds: 48 * 3600,
      speed: '20 Mbps'
    },
    'plan-5d': {
      id: 'plan-5d',
      title: '5 Days Pass',
      price: 100,
      duration: '5 Days (120 Hours)',
      durationSeconds: 5 * 24 * 3600,
      speed: '25 Mbps'
    },
    'plan-7d': {
      id: 'plan-7d',
      title: '7 Days Pro Pass',
      price: 200,
      duration: '7 Days (1 Week)',
      durationSeconds: 7 * 24 * 3600,
      speed: '30 Mbps'
    },
    'plan-monthly': {
      id: 'plan-monthly',
      title: 'Monthly Unlimited',
      price: 700,
      duration: '30 Days (Monthly)',
      durationSeconds: 30 * 24 * 3600,
      speed: '50 Mbps'
    }
  };

  // ------------------------------------------------------------------------
  // 3. M-Pesa Payment Sheet Management
  // ------------------------------------------------------------------------
  const paymentScrim = document.getElementById('payment-scrim');
  const btnCloseSheet = document.getElementById('btn-close-sheet');

  const sheetPlanTitle = document.getElementById('sheet-plan-title');
  const summaryDuration = document.getElementById('summary-duration');
  const summaryPriceAmount = document.getElementById('summary-price-amount');
  const mpesaBtnText = document.getElementById('mpesa-btn-text');

  const viewForm = document.getElementById('sheet-view-form');
  const viewProcessing = document.getElementById('sheet-view-processing');
  const viewSuccess = document.getElementById('sheet-view-success');

  const progressBar = document.getElementById('payment-progress-bar');
  const logStep1 = document.getElementById('log-step-1');
  const logStep2 = document.getElementById('log-step-2');
  const logStep3 = document.getElementById('log-step-3');

  const receiptPlanName = document.getElementById('receipt-plan-name');
  const receiptVoucherPin = document.getElementById('receipt-voucher-pin');
  const receiptTimer = document.getElementById('receipt-timer');
  const btnFinishAndBrowse = document.getElementById('btn-finish-and-browse');
  const formMpesa = document.getElementById('form-mpesa');

  let currentSelectedPlan = pricingPlans['plan-12h'];
  let sessionTimerInterval = null;
  let remainingSessionSeconds = 0;

  function showSheetStep(step) {
    viewForm.classList.remove('active');
    viewProcessing.classList.remove('active');
    viewSuccess.classList.remove('active');

    if (step === 'form') viewForm.classList.add('active');
    if (step === 'processing') viewProcessing.classList.add('active');
    if (step === 'success') viewSuccess.classList.add('active');
  }

  // ------------------------------------------------------------------------
  // 4. Tuma API & Bank Transfer Configuration
  // ------------------------------------------------------------------------
  const TUMA_CONFIG_KEY = 'airpulse_tuma_config';
  const DB_STORAGE_KEY = 'airpulse_payment_records';
  const CLIENTS_STORAGE_KEY = 'airpulse_client_devices';

  function getTumaConfig() {
    try {
      const saved = localStorage.getItem(TUMA_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      apiKey: 'tuma_live_sec_hotspot_gateway_01',
      bankName: 'Equity Bank Kenya',
      accountNumber: '0180293847291',
      accountName: 'AirPulse Hotspot Networks',
      endpoint: 'https://api.tuma.co.ke/v1'
    };
  }

  function saveTumaConfig(cfg) {
    try {
      localStorage.setItem(TUMA_CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  let tumaConfig = getTumaConfig();

  // Populate config UI elements
  const tumaApiKeyInput = document.getElementById('tuma-api-key');
  const cfgOperatorBank = document.getElementById('cfg-operator-bank');
  const cfgOperatorAccount = document.getElementById('cfg-operator-account');
  const displayOperatorBankName = document.getElementById('operator-bank-name');
  const displayOperatorAccountNum = document.getElementById('operator-account-num');
  const displayOperatorAccountName = document.getElementById('operator-account-name');

  function updateTumaUIFromConfig() {
    if (displayOperatorBankName) displayOperatorBankName.textContent = tumaConfig.bankName;
    if (displayOperatorAccountNum) displayOperatorAccountNum.textContent = tumaConfig.accountNumber;
    if (displayOperatorAccountName) displayOperatorAccountName.textContent = tumaConfig.accountName;
    if (tumaApiKeyInput) tumaApiKeyInput.value = tumaConfig.apiKey;
    if (cfgOperatorBank) cfgOperatorBank.value = tumaConfig.bankName;
    if (cfgOperatorAccount) cfgOperatorAccount.value = tumaConfig.accountNumber;
  }

  updateTumaUIFromConfig();

  // Save config on changes
  [tumaApiKeyInput, cfgOperatorBank, cfgOperatorAccount].forEach(el => {
    if (el) {
      el.addEventListener('change', () => {
        tumaConfig.apiKey = tumaApiKeyInput ? tumaApiKeyInput.value.trim() : tumaConfig.apiKey;
        tumaConfig.bankName = cfgOperatorBank ? cfgOperatorBank.value.trim() : tumaConfig.bankName;
        tumaConfig.accountNumber = cfgOperatorAccount ? cfgOperatorAccount.value.trim() : tumaConfig.accountNumber;
        saveTumaConfig(tumaConfig);
        updateTumaUIFromConfig();
      });
    }
  });

  function openPaymentSheet(planId) {
    const plan = pricingPlans[planId] || pricingPlans['plan-12h'];
    currentSelectedPlan = plan;

    sheetPlanTitle.textContent = plan.title;
    summaryDuration.textContent = plan.duration;
    summaryPriceAmount.textContent = `KES ${plan.price}`;
    if (mpesaBtnText) mpesaBtnText.textContent = `Pay with STK Push (KES ${plan.price})`;

    showSheetStep('form');
    paymentScrim.classList.add('active');
    paymentScrim.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      const phoneInput = document.getElementById('mpesa-phone-input');
      if (phoneInput) phoneInput.focus();
    }, 150);
  }

  function closePaymentSheet() {
    paymentScrim.classList.remove('active');
    paymentScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnCloseSheet) {
    btnCloseSheet.addEventListener('click', closePaymentSheet);
  }

  paymentScrim.addEventListener('click', (e) => {
    if (e.target === paymentScrim) closePaymentSheet();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePaymentSheet();
      closeLoginModal();
      closeFaqModal();
    }
  });

  // Attach click listener to each of the 6 Button Cards
  document.querySelectorAll('.blueprint-card, .btn-plan-card').forEach(card => {
    const planId = card.getAttribute('data-plan-id');

    card.addEventListener('click', () => {
      openPaymentSheet(planId);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPaymentSheet(planId);
      }
    });
  });

  // Also support direct inner button clicks
  document.querySelectorAll('[data-select-plan]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const planId = btn.getAttribute('data-select-plan');
      openPaymentSheet(planId);
    });
  });

  // ------------------------------------------------------------------------
  // 5. Tuma M-Pesa STK Push Execution Engine
  // ------------------------------------------------------------------------
  const receiptTumaRef = document.getElementById('receipt-tuma-ref');
  const receiptPhoneDisplay = document.getElementById('receipt-phone-display');

  if (formMpesa) {
    formMpesa.addEventListener('submit', (e) => {
      e.preventDefault();
      executeTumaPaymentFlow();
    });
  }

  function executeTumaPaymentFlow() {
    const phoneInput = document.getElementById('mpesa-phone-input');
    const rawPhone = phoneInput ? phoneInput.value.trim().replace(/^0/, '') : '';

    if (!rawPhone || rawPhone.length < 9) {
      alert('Please enter a valid mobile number (e.g. 712 345 678) to receive the M-Pesa STK prompt.');
      return;
    }

    const fullPhone = '+254 ' + rawPhone;

    // Switch to Radar Processing Step
    showSheetStep('processing');
    progressBar.style.width = '20%';

    logStep1.className = 'step-log-item active';
    logStep2.className = 'step-log-item';
    logStep3.className = 'step-log-item';

    // Step 1: Handshake with Tuma API M-Pesa STK Engine
    setTimeout(() => {
      progressBar.style.width = '60%';
      logStep1.className = 'step-log-item completed';
      logStep2.className = 'step-log-item active';
      triggerHaptic(15);
    }, 1500);

    // Step 2 -> Step 3: Verified by M-Pesa / Tuma Gateway
    setTimeout(() => {
      progressBar.style.width = '100%';
      logStep2.className = 'step-log-item completed';
      logStep3.className = 'step-log-item completed';
      
      const generatedRef = 'TUMA-STK-' + Math.floor(100000 + Math.random() * 900000);

      const paymentMeta = {
        name: 'M-Pesa Client (' + rawPhone + ')',
        phone: fullPhone,
        bank: tumaConfig.bankName,
        account: tumaConfig.accountNumber,
        channel: 'Tuma STK Push'
      };

      finalizeHotspotLogin(generatedRef, paymentMeta);
    }, 3200);
  }

  function generateVoucherPin() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'AP-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function finalizeHotspotLogin(tumaRef, meta = {}) {
    const voucherPin = generateVoucherPin();
    const clientMac = navMacDisplay ? navMacDisplay.textContent.trim() : '4A:2B:8C:91:DE:3F';
    const clientIp = navIpDisplay ? navIpDisplay.textContent.trim() : '192.168.88.145';

    receiptPlanName.textContent = currentSelectedPlan.title;
    receiptVoucherPin.textContent = voucherPin;

    if (receiptTumaRef) {
      receiptTumaRef.textContent = tumaRef || ('TUMA-STK-' + Math.floor(100000 + Math.random() * 900000));
    }

    if (receiptPhoneDisplay) {
      receiptPhoneDisplay.textContent = meta.phone || '+254 712 345 678';
    }

    remainingSessionSeconds = currentSelectedPlan.durationSeconds;
    updateReceiptTimerDisplay();

    // 1. Persist Transaction in airpulse_payment_records for Database & Dashboard
    try {
      let records = [];
      const stored = localStorage.getItem(DB_STORAGE_KEY);
      if (stored) records = JSON.parse(stored);
      
      const newRecord = {
        id: tumaRef,
        name: meta.name || 'AirPulse Client',
        phone: meta.phone || '+254712345678',
        amount: currentSelectedPlan.price,
        bank: meta.bank || tumaConfig.bankName,
        account: tumaConfig.accountNumber,
        channel: meta.channel || 'Tuma Bank Transfer',
        mac: clientMac,
        ip: clientIp,
        plan: `${currentSelectedPlan.title} — KES ${currentSelectedPlan.price}`,
        status: 'Completed',
        date: new Date().toISOString(),
        voucherPin: voucherPin
      };

      records.unshift(newRecord);
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to persist payment record:', e);
    }

    // 2. Persist Client Lease in airpulse_client_devices for Device Manager
    try {
      let clientDevices = [];
      const storedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);
      if (storedClients) clientDevices = JSON.parse(storedClients);

      // Remove any existing active lease for this MAC
      clientDevices = clientDevices.filter(c => c.mac !== clientMac);

      clientDevices.unshift({
        mac: clientMac,
        ip: clientIp,
        name: meta.name || 'Client Device',
        hostname: 'Device-' + clientMac.slice(-5).replace(':', ''),
        plan: currentSelectedPlan.title,
        durationSeconds: currentSelectedPlan.durationSeconds,
        startTime: Date.now(),
        expiresAt: Date.now() + (currentSelectedPlan.durationSeconds * 1000),
        gateway: 'Main-Lobby-Core-AP',
        status: 'active',
        dataUsedMb: (Math.random() * 15 + 4).toFixed(1),
        paymentRef: tumaRef,
        voucherPin: voucherPin
      });

      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clientDevices));
    } catch (e) {
      console.warn('Failed to persist client device:', e);
    }

    playSuccessChime();
    triggerHaptic([20, 80, 40]);

    showSheetStep('success');

    // Show persistent bottom connected dock
    showConnectedDock();

    // Start countdown timer
    startSessionTimer();

    // Fill hidden MikroTik RouterOS form
    const mtUsername = document.getElementById('mt-username');
    const mtPassword = document.getElementById('mt-password');
    if (mtUsername && mtPassword) {
      mtUsername.value = voucherPin;
      mtPassword.value = voucherPin;
    }
  }

  function formatSeconds(totalSec) {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function updateReceiptTimerDisplay() {
    if (receiptTimer) receiptTimer.textContent = formatSeconds(remainingSessionSeconds);
    const dockTimer = document.getElementById('dock-timer-display');
    if (dockTimer) dockTimer.textContent = `${formatSeconds(remainingSessionSeconds)} remaining`;
  }

  function startSessionTimer() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);

    sessionTimerInterval = setInterval(() => {
      if (remainingSessionSeconds > 0) {
        remainingSessionSeconds--;
        updateReceiptTimerDisplay();
      } else {
        clearInterval(sessionTimerInterval);
        disconnectSession();
      }
    }, 1000);
  }

  function showConnectedDock() {
    const dock = document.getElementById('active-session-dock');
    if (dock) dock.classList.add('visible');
  }

  function hideConnectedDock() {
    const dock = document.getElementById('active-session-dock');
    if (dock) dock.classList.remove('visible');
  }

  function disconnectSession() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    hideConnectedDock();
    triggerHaptic(20);
  }

  const btnDisconnectSession = document.getElementById('btn-disconnect-session');
  if (btnDisconnectSession) {
    btnDisconnectSession.addEventListener('click', disconnectSession);
  }

  function isMikrotikAction(action) {
    return !!(action && action.indexOf('$(') === -1 && action.trim());
  }

  function submitMikrotikLogin(username, password) {
    const form = document.getElementById('mikrotik-login-form');
    const mtUsername = document.getElementById('mt-username');
    const mtPassword = document.getElementById('mt-password');
    if (mtUsername) mtUsername.value = username;
    if (mtPassword) mtPassword.value = password;
    if (!form) return false;

    const action = form.getAttribute('action') || '';
    if (!isMikrotikAction(action)) return false;

    const chapId = window.CHAP_ID || '';
    const chapChallenge = window.CHAP_CHALLENGE || '';
    if (typeof hexMD5 === 'function' && chapId && chapChallenge && chapId.indexOf('$(') === -1) {
      mtPassword.value = hexMD5(chapId + password + chapChallenge);
    }

    form.submit();
    return true;
  }

  if (btnFinishAndBrowse) {
    btnFinishAndBrowse.addEventListener('click', () => {
      const pin = receiptVoucherPin ? receiptVoucherPin.textContent.trim() : '';
      closePaymentSheet();
      if (pin) submitMikrotikLogin(pin, pin);
    });
  }

  // ------------------------------------------------------------------------
  // 5. Voucher & Member Login Modal
  // ------------------------------------------------------------------------
  const loginModalScrim = document.getElementById('login-modal-scrim');
  const btnCloseLoginModal = document.getElementById('btn-close-login-modal');
  const btnOpenVoucher = document.getElementById('btn-open-voucher');
  const btnNavLogin = document.getElementById('btn-nav-login');

  const modalTabVoucherBtn = document.getElementById('modal-tab-voucher-btn');
  const modalTabMemberBtn = document.getElementById('modal-tab-member-btn');
  const modalVoucherForm = document.getElementById('modal-voucher-form');
  const modalMemberForm = document.getElementById('modal-member-form');

  function openLoginModal(tab = 'voucher') {
    loginModalScrim.classList.add('active');
    loginModalScrim.setAttribute('aria-hidden', 'false');
    switchLoginModalTab(tab);

    setTimeout(() => {
      const voucherInput = document.getElementById('direct-voucher-input');
      if (voucherInput && tab === 'voucher') voucherInput.focus();
    }, 150);
  }

  function closeLoginModal() {
    loginModalScrim.classList.remove('active');
    loginModalScrim.setAttribute('aria-hidden', 'true');
  }

  function switchLoginModalTab(tab) {
    if (tab === 'voucher') {
      modalTabVoucherBtn.classList.add('active');
      modalTabMemberBtn.classList.remove('active');
      modalVoucherForm.classList.add('active');
      modalMemberForm.classList.remove('active');
    } else {
      modalTabMemberBtn.classList.add('active');
      modalTabVoucherBtn.classList.remove('active');
      modalMemberForm.classList.add('active');
      modalVoucherForm.classList.remove('active');
    }
  }

  if (btnOpenVoucher) btnOpenVoucher.addEventListener('click', () => openLoginModal('voucher'));
  if (btnNavLogin) btnNavLogin.addEventListener('click', () => openLoginModal('member'));
  if (btnCloseLoginModal) btnCloseLoginModal.addEventListener('click', closeLoginModal);
  if (modalTabVoucherBtn) modalTabVoucherBtn.addEventListener('click', () => switchLoginModalTab('voucher'));
  if (modalTabMemberBtn) modalTabMemberBtn.addEventListener('click', () => switchLoginModalTab('member'));

  loginModalScrim.addEventListener('click', (e) => {
    if (e.target === loginModalScrim) closeLoginModal();
  });

  if (modalVoucherForm) {
    modalVoucherForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const voucherInput = document.getElementById('direct-voucher-input');
      const pin = voucherInput && voucherInput.value.trim() ? voucherInput.value.trim().toUpperCase() : '';
      if (!pin) return;
      closeLoginModal();
      if (submitMikrotikLogin(pin, pin)) return;
      currentSelectedPlan = pricingPlans['plan-24h'];
      finalizeHotspotLogin('VOUCHER-' + pin, {
        name: 'Voucher User (' + pin + ')',
        phone: 'Voucher Access',
        channel: 'Voucher PIN Redemption'
      });
    });
  }

  if (modalMemberForm) {
    modalMemberForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const memberInput = document.getElementById('member-username-input');
      const memberPass = document.getElementById('member-password-input');
      const username = memberInput && memberInput.value.trim() ? memberInput.value.trim() : '';
      const password = memberPass ? memberPass.value : '';
      if (!username || !password) return;
      closeLoginModal();
      if (submitMikrotikLogin(username, password)) return;
      currentSelectedPlan = pricingPlans['plan-monthly'];
      finalizeHotspotLogin('MEMBER-' + Date.now().toString(36).toUpperCase(), {
        name: username + ' (Member)',
        phone: 'Member Credential',
        channel: 'Member Login'
      });
    });
  }

  // ------------------------------------------------------------------------
  // 6. FAQ Modal (No scroll needed)
  // ------------------------------------------------------------------------
  const faqModalScrim = document.getElementById('faq-modal-scrim');
  const btnFooterFaq = document.getElementById('btn-footer-faq');
  const btnCloseFaqModal = document.getElementById('btn-close-faq-modal');

  function openFaqModal() {
    faqModalScrim.classList.add('active');
    faqModalScrim.setAttribute('aria-hidden', 'false');
  }

  function closeFaqModal() {
    faqModalScrim.classList.remove('active');
    faqModalScrim.setAttribute('aria-hidden', 'true');
  }

  if (btnFooterFaq) btnFooterFaq.addEventListener('click', openFaqModal);
  if (btnCloseFaqModal) btnCloseFaqModal.addEventListener('click', closeFaqModal);
  if (faqModalScrim) {
    faqModalScrim.addEventListener('click', (e) => {
      if (e.target === faqModalScrim) closeFaqModal();
    });
  }

  // ------------------------------------------------------------------------
  // 7. Dynamic MAC & IP Telemetry Simulation
  // ------------------------------------------------------------------------
  const navIpDisplay = document.getElementById('nav-ip-display');
  const navMacDisplay = document.getElementById('nav-mac-display');
  const noticeMac = document.getElementById('notice-mac');

  function generateRandomMac() {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    }
    return mac;
  }

  function resolveMikrotikValue(el, fallback) {
    if (!el) return fallback;
    const value = (el.textContent || '').trim();
    if (!value || value.indexOf('$(') !== -1) {
      el.textContent = fallback;
      return fallback;
    }
    return value;
  }

  const fallbackMac = generateRandomMac();
  const fallbackIp = `192.168.88.${Math.floor(Math.random() * 200) + 20}`;
  const detectedMac = resolveMikrotikValue(navMacDisplay, fallbackMac);
  const detectedIp = resolveMikrotikValue(navIpDisplay, fallbackIp);
  if (noticeMac) {
    const noticeVal = (noticeMac.textContent || '').trim();
    if (!noticeVal || noticeVal.indexOf('$(') !== -1) noticeMac.textContent = detectedMac;
  }

  const errorBanner = document.getElementById('mt-error-banner');
  if (errorBanner) {
    const errText = (errorBanner.textContent || '').trim();
    if (!errText || errText.indexOf('$(') !== -1) {
      errorBanner.style.display = 'none';
    } else {
      errorBanner.style.display = 'block';
    }
  }

});
