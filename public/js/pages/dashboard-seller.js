(() => {
  const { createElement, formatVND } = window.AppUtils || {};

  if (!createElement || !formatVND) return;

  const MIN_PAYOUT_AMOUNT = 50000;
  const state = {
    summary: null,
    loading: false,
    withdrawOpen: false,
  };

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  function setTableMessage(tbody, colspan, message) {
    const row = createElement('tr');
    row.appendChild(createElement('td', {
      attrs: { colspan: String(colspan) },
      style: { textAlign: 'center', padding: '32px', color: 'var(--t2)' },
      text: message
    }));
    tbody.replaceChildren(row);
  }

  function createBadge(text, className) {
    return createElement('span', {
      className,
      style: { fontSize: '11px' },
      text
    });
  }

  function syncWithdrawPanelState() {
    const panel = document.getElementById('withdrawPanel');
    const trigger = document.querySelector('[data-action="toggle-withdraw-panel"]');
    if (panel) panel.hidden = !state.withdrawOpen;
    if (trigger) trigger.setAttribute('aria-expanded', state.withdrawOpen ? 'true' : 'false');
    if (state.withdrawOpen && typeof window.lucide?.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function openWithdrawModal() {
    state.withdrawOpen = true;
    syncWithdrawPreview();
    syncWithdrawPanelState();
  }

  function closeWithdrawModal() {
    state.withdrawOpen = false;
    syncWithdrawPanelState();
  }

  function resetWithdrawForm() {
    const amountInput = document.getElementById('withdrawAmount');
    const amountRange = document.getElementById('withdrawAmountRange');
    const bankNameInput = document.getElementById('bankName');
    const accountNumberInput = document.getElementById('accountNumber');
    const accountNameInput = document.getElementById('accountName');
    const available = state.summary?.wallet?.availableBalance || 0;

    if (amountInput) amountInput.value = String(available || '');
    if (amountRange) {
      amountRange.max = String(available || 0);
      amountRange.value = String(available || 0);
    }
    if (bankNameInput) bankNameInput.value = '';
    if (accountNumberInput) accountNumberInput.value = '';
    if (accountNameInput) accountNameInput.value = '';
    updatePresetState(100);
    syncWithdrawPreview();
  }

  function updateWithdrawHint(availableBalance) {
    const hint = document.getElementById('withdraw-available-hint');
    const sliderMaxNode = document.getElementById('withdraw-slider-max');
    if (hint) {
      hint.textContent = `Available: ${formatVND(availableBalance)}`;
    }
    if (sliderMaxNode) {
      sliderMaxNode.textContent = formatVND(availableBalance);
    }
  }

  function syncWithdrawPreview() {
    const amountInput = document.getElementById('withdrawAmount');
    const amountRange = document.getElementById('withdrawAmountRange');
    const previewNode = document.getElementById('withdraw-preview-amount');
    const balanceNode = document.getElementById('withdraw-balance-display');
    const amountDisplayNode = document.getElementById('withdraw-amount-display');
    const availableBalance = Number(state.summary?.wallet?.availableBalance || 0);
    const enteredAmount = Number(amountInput?.value || 0);
    const nextAmount = Number.isFinite(enteredAmount) && enteredAmount > 0 ? enteredAmount : 0;

    if (previewNode) previewNode.textContent = formatVND(nextAmount);
    if (balanceNode) balanceNode.textContent = formatVND(availableBalance);
    if (amountDisplayNode) amountDisplayNode.textContent = formatVND(nextAmount);
    if (amountRange) amountRange.value = String(nextAmount);
  }

  function applyWithdrawPreset(percent) {
    const amountInput = document.getElementById('withdrawAmount');
    const amountRange = document.getElementById('withdrawAmountRange');
    const availableBalance = Number(state.summary?.wallet?.availableBalance || 0);
    if (!amountInput || !availableBalance) return;

    const presetAmount = percent >= 100
      ? availableBalance
      : Math.max(MIN_PAYOUT_AMOUNT, Math.floor((availableBalance * percent) / 100));

    const nextAmount = Math.min(presetAmount, availableBalance);
    amountInput.value = String(nextAmount);
    if (amountRange) amountRange.value = String(nextAmount);
    updatePresetState(percent);
    syncWithdrawPreview();
  }

  function updatePresetState(activePercent = 0) {
    document.querySelectorAll('[data-withdraw-preset]').forEach((button) => {
      const percent = Number(button.dataset.withdrawPreset || 0);
      button.classList.toggle('active', percent === activePercent);
    });
  }

  function renderWalletSummary(summary) {
    state.summary = summary;
    const wallet = summary?.wallet || {};
    const payoutStats = summary?.payoutStats || {};
    const availableBalance = wallet.availableBalance || 0;
    const pendingBalance = wallet.pendingBalance || 0;
    const totalSales = wallet.totalSales || 0;

    const availableText = formatVND(availableBalance);
    const pendingText = formatVND(pendingBalance);

    const textMap = new Map([
      ['wallet-available-quick', `${availableText} available`],
      ['wallet-available-balance', availableText],
      ['wallet-available-stat', availableText],
      ['wallet-pending-stat', pendingText],
      ['wallet-processing-count', String(payoutStats.PROCESSING || 0)],
      ['wallet-processing-count-hero', String(payoutStats.PROCESSING || 0)],
      ['wallet-paid-count', String(payoutStats.PAID || 0)],
      ['wallet-total-sales', `Total settled sales: ${formatVND(totalSales)}`],
      ['wallet-available-stat-hero', availableText],
    ]);

    textMap.forEach((text, id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    });

    const pendingNode = document.getElementById('wallet-pending-balance');
    if (pendingNode) {
      pendingNode.innerHTML = '';
      pendingNode.append(
        createElement('i', {
          attrs: { 'data-lucide': 'clock' },
          style: { width: '14px', height: '14px' }
        }),
        document.createTextNode(` Pending: ${pendingText}`)
      );
    }

    const note = document.getElementById('wallet-status-note');
    if (note) {
      const textNode = note.querySelector('.alert-box-text');
      if (textNode) {
        if (availableBalance > 0) {
          textNode.textContent = `You can withdraw ${availableText} now. ${pendingBalance > 0 ? `${pendingText} is still waiting for order completion.` : 'No funds are currently waiting for settlement.'}`;
        } else if (pendingBalance > 0) {
          textNode.textContent = `${pendingText} is being held until your QR orders are marked completed.`;
        } else {
          textNode.textContent = 'No settled wallet balance yet. Completed QR orders will appear here automatically.';
        }
      }
    }

    updateWithdrawHint(availableBalance);
    const amountRange = document.getElementById('withdrawAmountRange');
    if (amountRange) {
      amountRange.max = String(availableBalance);
      amountRange.value = String(Math.min(Number(amountRange.value || availableBalance), availableBalance));
    }
    updatePresetState(100);
    syncWithdrawPreview();
    if (typeof window.lucide?.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function renderTransactions(transactions = []) {
    const tbody = document.getElementById('walletTransactions');
    if (!tbody) return;

    if (!transactions.length) {
      setTableMessage(tbody, 5, 'No transactions yet');
      return;
    }

    const statusClass = {
      PENDING: 'badge-pending',
      COMPLETED: 'badge-completed',
      FAILED: 'badge-cancelled'
    };

    tbody.replaceChildren(...transactions.map((transaction) => {
      const row = createElement('tr');
      const amount = Number(transaction.amount || 0);
      row.append(
        createElement('td', {
          style: { fontSize: '13px', color: 'var(--t2)' },
          text: new Date(transaction.createdAt).toLocaleDateString()
        }),
        createElement('td', {
          children: [
            createBadge(transaction.type, `badge ${amount >= 0 ? 'badge-completed' : 'badge-cancelled'}`)
          ]
        }),
        createElement('td', {
          children: [
            createBadge(transaction.status || 'COMPLETED', `badge ${statusClass[transaction.status] || 'badge-pending'}`)
          ]
        }),
        createElement('td', {
          style: { fontSize: '13px' },
          text: transaction.description || ''
        }),
        createElement('td', {
          style: { fontWeight: '700', color: amount >= 0 ? 'var(--success)' : 'var(--error)' },
          text: `${amount >= 0 ? '+' : ''}${formatVND(amount)}`
        })
      );
      return row;
    }));
  }

  function renderPayoutRequests(payouts = []) {
    const tbody = document.getElementById('payoutRequestsTable');
    if (!tbody) return;

    if (!payouts.length) {
      setTableMessage(tbody, 5, 'No payout requests yet');
      return;
    }

    const statusClass = {
      PENDING: 'badge-pending',
      PROCESSING: 'badge-info',
      PAID: 'badge-completed',
      REJECTED: 'badge-cancelled'
    };

    tbody.replaceChildren(...payouts.map((payout) => {
      const row = createElement('tr');
      const bankCell = createElement('td', { style: { fontSize: '13px' } });
      bankCell.append(
        document.createTextNode(payout.bankInfo?.bankName || '-'),
        createElement('br'),
        createElement('span', {
          style: { color: 'var(--t3)' },
          text: payout.bankInfo?.accountNumber || ''
        })
      );

      const transferCell = createElement('td', { style: { fontSize: '13px' } });
      if (payout.transferReference) {
        transferCell.append(
          createElement('strong', { text: payout.transferReference }),
          payout.transferNote ? createElement('div', {
            style: { color: 'var(--t3)', marginTop: '4px' },
            text: payout.transferNote
          }) : null
        );
      } else {
        transferCell.appendChild(createElement('span', { style: { color: 'var(--t3)' }, text: '-' }));
      }

      row.append(
        createElement('td', {
          style: { fontSize: '13px', color: 'var(--t2)' },
          text: new Date(payout.createdAt).toLocaleDateString()
        }),
        createElement('td', {
          style: { fontWeight: '700' },
          text: formatVND(payout.amount || 0)
        }),
        bankCell,
        createElement('td', {
          children: [
            createBadge(payout.status, `badge ${statusClass[payout.status] || 'badge-pending'}`)
          ]
        }),
        transferCell
      );
      return row;
    }));
  }

  async function refreshWalletData() {
    if (state.loading) return;
    state.loading = true;

    try {
      const response = await fetch('/api/wallet/summary');
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to load wallet data');
      }

      renderWalletSummary(json.data);
      renderTransactions(json.data.transactions || []);
      renderPayoutRequests(json.data.payouts || []);
    } catch (error) {
      window.AppUtils?.reportClientError('Fetch wallet summary error:', error);
      toast(error.message || 'Could not load wallet data', 'err');
    } finally {
      state.loading = false;
    }
  }

  async function submitWithdraw() {
    const amountInput = document.getElementById('withdrawAmount');
    const bankNameInput = document.getElementById('bankName');
    const accountNumberInput = document.getElementById('accountNumber');
    const accountNameInput = document.getElementById('accountName');
    const submitButton = document.getElementById('submit-withdraw-btn');

    const amount = Number(amountInput?.value || 0);
    const availableBalance = Number(state.summary?.wallet?.availableBalance || 0);
    const bankName = bankNameInput?.value?.trim() || '';
    const accountNumber = accountNumberInput?.value?.trim() || '';
    const accountName = accountNameInput?.value?.trim().toUpperCase() || '';

    if (!Number.isFinite(amount) || amount < MIN_PAYOUT_AMOUNT) {
      toast('Minimum withdrawal is 50,000 VND', 'err');
      return;
    }
    if (amount > availableBalance) {
      toast('Withdrawal amount exceeds available balance', 'err');
      return;
    }
    if (!bankName || !accountNumber || !accountName) {
      toast('Please fill all bank details', 'err');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

    try {
      const response = await fetch('/api/wallet/payout-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bankInfo: { bankName, accountNumber, accountName }
        })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Could not submit payout request');
      }

      renderWalletSummary(json.data);
      renderTransactions(json.data.transactions || []);
      renderPayoutRequests(json.data.payouts || []);
      closeWithdrawModal();
      resetWithdrawForm();
      toast('Payout request submitted successfully', 'ok');
    } catch (error) {
      toast(error.message || 'Network error', 'err');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Request';
      }
    }
  }

  window.openWithdrawModal = openWithdrawModal;
  window.closeWithdrawModal = closeWithdrawModal;
  window.submitWithdraw = submitWithdraw;
  window.showSection = function showSection(id) {
    const navItem = document.querySelector(`.nav-item[data-section="${id}"]`);
    if (navItem) {
      navItem.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (id === 'sWallet') refreshWalletData();
    }
  };

  document.addEventListener('click', (event) => {
    const hrefTarget = event.target.closest('[data-href]');
    if (hrefTarget) {
      window.location.href = hrefTarget.dataset.href;
      return;
    }

    const toastTarget = event.target.closest('[data-toast-message]');
    if (toastTarget) {
      toast(toastTarget.dataset.toastMessage, toastTarget.dataset.toastType || 'info');
      return;
    }

    const sectionTarget = event.target.closest('[data-action="show-section"][data-section]');
    if (sectionTarget) {
      window.showSection(sectionTarget.dataset.section);
      return;
    }

    const navTarget = event.target.closest('#sellerNav .nav-item[data-section]');
    if (navTarget) {
      nav(navTarget, navTarget.dataset.section);
      return;
    }

    const presetTarget = event.target.closest('[data-withdraw-preset]');
    if (presetTarget) {
      applyWithdrawPreset(Number(presetTarget.dataset.withdrawPreset || 0));
      return;
    }

    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    if (actionTarget.dataset.action === 'toggle-withdraw-panel') {
      if (state.withdrawOpen) closeWithdrawModal();
      else openWithdrawModal();
    }
    if (actionTarget.dataset.action === 'open-withdraw-modal') openWithdrawModal();
    if (actionTarget.dataset.action === 'close-withdraw-modal' || actionTarget.dataset.action === 'close-withdraw-panel') closeWithdrawModal();
    if (actionTarget.dataset.action === 'submit-withdraw') submitWithdraw();
  });

  const withdrawAmountInput = document.getElementById('withdrawAmount');
  if (withdrawAmountInput) {
    withdrawAmountInput.addEventListener('input', syncWithdrawPreview);
  }

  const withdrawAmountRange = document.getElementById('withdrawAmountRange');
  if (withdrawAmountRange) {
    withdrawAmountRange.addEventListener('input', () => {
      const amountInput = document.getElementById('withdrawAmount');
      if (amountInput) amountInput.value = withdrawAmountRange.value;
      updatePresetState(0);
      syncWithdrawPreview();
    });
  }

  syncWithdrawPanelState();

  if (window.INITIAL_SECTION === 'sWallet') {
    refreshWalletData();
  }
})();
