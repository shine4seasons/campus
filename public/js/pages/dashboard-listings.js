document.addEventListener('click', function handleDashboardListingsClick(event) {
  const toastTarget = event.target.closest('[data-toast-message]');
  if (toastTarget && typeof showToast === 'function') {
    showToast(toastTarget.dataset.toastMessage, toastTarget.dataset.toastType || 'info');
  }
});
