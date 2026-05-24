(() => {
  const { createElement } = window.AppUtils || {};

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

  function openWithdrawModal() {
    document.getElementById('withdrawModal').classList.add('show');
  }

  function closeWithdrawModal() {
    document.getElementById('withdrawModal').classList.remove('show');
  }

  async function submitWithdraw() {
    const amount = document.getElementById('withdrawAmount').value;
    const bankName = document.getElementById('bankName').value;
    const accountNumber = document.getElementById('accountNumber').value;
    const accountName = document.getElementById('accountName').value;

    if (!amount || amount < 50000) return showToast('Minimum withdrawal is 50,000 VND', 'err');
    if (!bankName || !accountNumber || !accountName) return showToast('Please fill all bank details', 'err');

    try {
      const res = await fetch('/api/wallet/payout-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, bankInfo: { bankName, accountNumber, accountName } })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Payout request submitted successfully!', 'ok');
        setTimeout(() => location.reload(), 900);
      } else {
        showToast('Error: ' + json.message, 'err');
      }
    } catch (err) {
      showToast('Network error', 'err');
    }
  }

  async function fetchTransactions() {
    try {
      const res = await fetch('/api/wallet/transactions');
      const json = await res.json();
      const tbody = document.getElementById('walletTransactions');
      if (!tbody) return;
      if (json.success && json.data.length > 0) {
        tbody.replaceChildren(...json.data.map((t) => {
          const row = createElement('tr');
          row.append(
            createElement('td', {
              style: { fontSize: '13px', color: 'var(--t2)' },
              text: new Date(t.createdAt).toLocaleDateString()
            }),
            createElement('td', {
              children: [createBadge(t.type, `badge ${t.amount >= 0 ? 'badge-completed' : 'badge-cancelled'}`)]
            }),
            createElement('td', { style: { fontSize: '13px' }, text: t.description || '' }),
            createElement('td', {
              style: { fontWeight: '700', color: t.amount >= 0 ? 'var(--success)' : 'var(--error)' },
              text: `${t.amount >= 0 ? '+' : ''}${window.AppUtils.formatVND(t.amount)}`
            })
          );
          return row;
        }));
      } else {
        setTableMessage(tbody, 4, 'No transactions yet');
      }
    } catch (err) {
      console.error('Fetch transactions error:', err);
    }
  }

  async function fetchPayoutRequests() {
    try {
      const res = await fetch('/api/wallet/payout-requests');
      const json = await res.json();
      const tbody = document.getElementById('payoutRequestsTable');
      if (!tbody) return;

      if (!json.success || !json.data.length) {
        setTableMessage(tbody, 4, 'No payout requests yet');
        return;
      }

      const statusClass = {
        PENDING: 'badge-pending',
        PROCESSING: 'badge-pending',
        PAID: 'badge-completed',
        REJECTED: 'badge-cancelled'
      };

      tbody.replaceChildren(...json.data.map((p) => {
        const row = createElement('tr');
        const bankCell = createElement('td', { style: { fontSize: '13px' } });
        bankCell.appendChild(document.createTextNode(p.bankInfo?.bankName || '-'));
        bankCell.appendChild(createElement('br'));
        bankCell.appendChild(createElement('span', {
          style: { color: 'var(--t3)' },
          text: p.bankInfo?.accountNumber || ''
        }));

        row.append(
          createElement('td', {
            style: { fontSize: '13px', color: 'var(--t2)' },
            text: new Date(p.createdAt).toLocaleDateString()
          }),
          createElement('td', {
            style: { fontWeight: '700' },
            text: window.AppUtils.formatVND(p.amount)
          }),
          bankCell,
          createElement('td', {
            children: [createBadge(p.status, `badge ${statusClass[p.status] || 'badge-pending'}`)]
          })
        );
        return row;
      }));
    } catch (err) {
      console.error('Fetch payout requests error:', err);
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
      if (id === 'sWallet') {
        fetchTransactions();
        fetchPayoutRequests();
      }
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
      showToast(toastTarget.dataset.toastMessage, toastTarget.dataset.toastType || 'info');
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

    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    if (actionTarget.dataset.action === 'open-withdraw-modal') openWithdrawModal();
    if (actionTarget.dataset.action === 'close-withdraw-modal') closeWithdrawModal();
    if (actionTarget.dataset.action === 'submit-withdraw') submitWithdraw();
  });
})();
