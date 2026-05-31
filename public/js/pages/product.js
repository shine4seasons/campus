(function () {
    const productConfig = window.AppUtils?.readJsonScript
      ? window.AppUtils.readJsonScript('product-page-config')
      : {};
    const PRODUCT_ID = productConfig.productId || '';
    const IS_AUTH = !!productConfig.isAuth;
    const IS_ADMIN = !!productConfig.isAdmin;
    const IMAGES = Array.isArray(productConfig.images) ? productConfig.images : [];
    let interestedState = false;

    const PRODUCT_META = productConfig.productMeta || {
      id: PRODUCT_ID,
      title: '',
      price: '',
      image: '',
      url: '/products/' + PRODUCT_ID
    };
    let interestRequestInFlight = false;

    // ── Gallery ──────────────────────────────────────────────────────────
    window.setImg = function (i) {
      const main = document.getElementById('main-img');
      if (main && IMAGES[i]) main.src = IMAGES[i];
      document.querySelectorAll('.pdp-thumb').forEach((t, j) => t.classList.toggle('active', j === i));
    };

    window.openImageModal = function (src) {
      const modal = document.getElementById('image-modal');
      const modalImg = document.getElementById('image-modal-img');
      if (!modal || !modalImg || !src) return;
      modalImg.src = src;
      modalImg.style.transform = 'scale(1) translate(0, 0)';
      modal.classList.add('open');
      currentZoom = 1;
      panX = 0;
      panY = 0;
      updateZoomLevel();
    };

    window.closeImageModal = function () {
      const modal = document.getElementById('image-modal');
      if (!modal) return;
      modal.classList.remove('open');
      const modalImg = document.getElementById('image-modal-img');
      if (modalImg) modalImg.src = '';
      currentZoom = 1;
      panX = 0;
      panY = 0;
    };

    // ── Image Zoom & Pan ─────────────────────────────────────────────
    let currentZoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 5;
    const ZOOM_STEP = 0.2;

    function updateZoomLevel() {
      const zoomLevelEl = document.getElementById('zoom-level');
      if (zoomLevelEl) {
        zoomLevelEl.textContent = Math.round(currentZoom * 100) + '%';
      }
    }

    function updateImageTransform() {
      const img = document.getElementById('image-modal-img');
      if (img) {
        img.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
      }
    }

    window.zoomIn = function () {
      if (currentZoom < MAX_ZOOM) {
        currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
        updateImageTransform();
        updateZoomLevel();
      }
    };

    window.zoomOut = function () {
      if (currentZoom > MIN_ZOOM) {
        currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
        panX = 0;
        panY = 0;
        updateImageTransform();
        updateZoomLevel();
      }
    };

    window.resetZoom = function () {
      currentZoom = 1;
      panX = 0;
      panY = 0;
      updateImageTransform();
      updateZoomLevel();
    };

    // Zoom with mouse wheel
    document.addEventListener('wheel', function (e) {
      const modal = document.getElementById('image-modal');
      if (!modal || !modal.classList.contains('open')) return;
      e.preventDefault();
      if (e.deltaY < 0) {
        window.zoomIn();
      } else {
        window.zoomOut();
      }
    }, { passive: false });

    // Pan with mouse drag
    const img = document.getElementById('image-modal-img');
    if (img) {
      img.addEventListener('mousedown', function (e) {
        const modal = document.getElementById('image-modal');
        if (!modal || !modal.classList.contains('open')) return;
        isDragging = true;
        dragStartX = e.clientX - panX;
        dragStartY = e.clientY - panY;
        img.classList.add('dragging');
      });

      document.addEventListener('mousemove', function (e) {
        if (!isDragging || currentZoom <= 1) return;
        panX = e.clientX - dragStartX;
        panY = e.clientY - dragStartY;
        updateImageTransform();
      });

      document.addEventListener('mouseup', function () {
        isDragging = false;
        img.classList.remove('dragging');
      });

      // Touch zoom (pinch)
      let touchDistance = 0;
      img.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          touchDistance = Math.sqrt(dx * dx + dy * dy);
        } else if (e.touches.length === 1) {
          isDragging = true;
          dragStartX = e.touches[0].clientX - panX;
          dragStartY = e.touches[0].clientY - panY;
        }
      });

      img.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDistance = Math.sqrt(dx * dx + dy * dy);
          const delta = newDistance - touchDistance;
          if (delta > 5) {
            window.zoomIn();
          } else if (delta < -5) {
            window.zoomOut();
          }
          touchDistance = newDistance;
        } else if (isDragging && e.touches.length === 1 && currentZoom > 1) {
          panX = e.touches[0].clientX - dragStartX;
          panY = e.touches[0].clientY - dragStartY;
          updateImageTransform();
        }
      });

      img.addEventListener('touchend', function () {
        isDragging = false;
      });
    }

    // ── Interested ───────────────────────────────────────────────────────
    function applyHeartState(active) {
      const icon = document.getElementById('heart-icon');
      if (icon) {
        icon.style.fill = active ? '#ffffff' : 'none';
        icon.style.stroke = active ? '#ffffff' : 'currentColor';
      }
      const btn = document.getElementById('btn-interested');
      if (btn) {
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(!!active));
        if (active) {
          btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
          btn.style.borderColor = 'rgba(220, 38, 38, 0.45)';
          btn.style.color = '#ffffff';
          btn.style.boxShadow = '0 14px 28px rgba(239, 68, 68, 0.24)';
        } else {
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
          btn.style.boxShadow = '';
        }
        const label = btn.querySelector('[data-interest-label]');
        if (label) label.textContent = active ? 'Remove from Interests' : 'Add to Interests';
      }
    }

    // Initialize favorite state from server on load
    if (IS_AUTH && !IS_ADMIN) {
      fetch('/api/products/favorites/ids', { credentials: 'include' })
        .then(r => r.json())
        .then(json => {
          if (json && json.success && Array.isArray(json.data)) {
            interestedState = json.data.includes(PRODUCT_ID);
            applyHeartState(interestedState);
          }
        })
        .catch(() => {});
    }

    window.toggleInterested = async function () {
      if (IS_ADMIN) return;
      if (!IS_AUTH) { if (typeof showToast === 'function') showToast('Please sign in to mark interest', 'err'); return; }
      if (interestRequestInFlight) return;
      interestRequestInFlight = true;
      const btn = document.getElementById('btn-interested');
      if (btn) btn.disabled = true;
      interestedState = !interestedState;
      applyHeartState(interestedState);
      try {
        const res = await fetch('/api/products/' + PRODUCT_ID + '/interested', { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update interest');
        if (data && typeof data.isFavorited === 'boolean') {
          interestedState = data.isFavorited;
          applyHeartState(interestedState);
        }
        const countEl = document.getElementById('int-count');
        if (countEl && typeof data.interested === 'number') {
          countEl.textContent = '(' + data.interested + ')';
        }
      } catch {
        interestedState = !interestedState;
        applyHeartState(interestedState);
        if (typeof showToast === 'function') showToast('Could not update interests', 'err');
      } finally {
        interestRequestInFlight = false;
        if (btn) btn.disabled = false;
      }
    };

    // ── Chat — redirect to /messages with conversation pre-selected ──────
    window.initChat = async function () {
      if (IS_ADMIN) return;
      const btn = document.getElementById('btn-msg-seller');
      if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
      try {
        const res = await fetch('/api/chat/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: PRODUCT_ID }),
          credentials: 'include'
        });
        const json = await res.json();
        if (json.success) {
          window.location.href = '/messages?id=' + json.conversationId
            + '&product=' + encodeURIComponent(JSON.stringify(PRODUCT_META));
        } else {
          if (typeof showToast === 'function') showToast(json.message, 'err');
          if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'err');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      }
    };

    // ── Owner: mark sold ─────────────────────────────────────────────────
    window.markSold = async function () {
      const confirmed = await showConfirm({
        title: 'Mark as Sold',
        message: 'Are you sure you want to mark this item as sold?',
        confirmText: 'Mark as Sold'
      });
      if (confirmed) markAsSoldExec();
    };

    async function markAsSoldExec() {
      try {
        const res = await fetch('/api/products/' + PRODUCT_ID + '/mark-sold', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error((await res.json()).message);
        if (typeof showToast === 'function') showToast('Status updated!', 'ok');
        setTimeout(() => location.reload(), 1000);
      } catch (err) { if (typeof showToast === 'function') showToast(err.message, 'err'); }
    }

    // ── Owner: delete ────────────────────────────────────────────────────
    window.deleteProduct = async function () {
      const confirmed = await showConfirm({
        title: 'Delete Product',
        message: 'Are you sure you want to delete this product? This action cannot be undone.',
        confirmText: 'Delete',
        type: 'danger'
      });
      if (confirmed) deleteProductExec();
    };

    async function deleteProductExec() {
      try {
        const res = await fetch('/api/products/' + PRODUCT_ID, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error((await res.json()).message);
        if (typeof showToast === 'function') showToast('Product deleted', 'ok');
        setTimeout(() => window.location.href = '/', 1200);
      } catch (err) { if (typeof showToast === 'function') showToast(err.message, 'err'); }
    }

    // ── Buy Now — go to checkout ─────────────────────────────────────────
    window.goCheckout = function () {
      if (IS_ADMIN) return;
      if (!IS_AUTH) { if (typeof showToast === 'function') showToast('Please sign in to purchase', 'err'); return; }
      window.location.href = '/checkout/' + PRODUCT_ID;
    };

    // ── Submit Product Rating ─────────────────────────────────────────────
    window.submitProductRating = async function () {
      if (IS_ADMIN) return;
      const stars = document.querySelectorAll('#rating-stars .star.selected');
      const score = stars.length > 0 ? stars[stars.length - 1].dataset.score : 0;
      const comment = document.getElementById('rating-comment').value.trim();

      if (!score || score < 1 || score > 5) {
        if (typeof showToast === 'function') showToast('Please select a rating', 'err');
        return;
      }

      try {
        const success = await submitRating('product', PRODUCT_ID, score, comment);
        if (success) {
          resetRatingForm();
          // Reload ratings
          setTimeout(() => {
            loadRatings('product', PRODUCT_ID, 'product-ratings-list-content');
            loadRatingStats('product', PRODUCT_ID, 'product-rating-stats-content');
          }, 500);
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('Error: ' + err.message, 'err');
      }
    };

    window.resetRatingForm = function() {
      document.getElementById('rating-comment').value = '';
      document.querySelectorAll('#rating-stars .star').forEach(s => {
        s.classList.remove('star-filled', 'selected');
        s.classList.add('star-empty');
      });
    };

    // ── Report Modal ──────────────────────────────────────────────────────
    let reportTargetType = '';
    let reportTargetId = '';

    window.showReportModal = function (targetType, targetId) {
      if (IS_ADMIN) return;
      reportTargetType = targetType;
      reportTargetId = targetId;
      document.getElementById('report-modal').style.display = 'flex';
      const modalTitle = document.getElementById('report-modal-title');
      if (modalTitle) modalTitle.textContent = targetType === 'user' ? 'Report this seller' : 'Report this product';
      document.getElementById('report-reason').value = '';
      document.getElementById('report-content').value = '';
      document.getElementById('report-char-count').textContent = '0';
    };

    window.closeReportModal = function () {
      document.getElementById('report-modal').style.display = 'none';
    };

    window.submitReport = async function () {
      if (IS_ADMIN) return;
      const reason = document.getElementById('report-reason').value;
      const content = document.getElementById('report-content').value;

      if (!reason) {
        if (typeof showToast === 'function') showToast('Please select a reason', 'err');
        return;
      }

      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetType: reportTargetType,
            targetId: reportTargetId,
            reason,
            content
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to submit report');

        if (typeof showToast === 'function') showToast('Report submitted. Thank you!', 'ok');
        closeReportModal();
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'err');
      }
    };

    // Character counter for report textarea
    document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;

        if (action === 'set-image') {
          const index = Number(actionEl.dataset.index);
          if (Number.isInteger(index)) window.setImg(index);
          return;
        }

        if (action === 'open-image') {
          const main = document.getElementById('main-img');
          if (main && main.src) window.openImageModal(main.src);
          return;
        }

        if (action === 'close-image-modal') {
          const modal = document.getElementById('image-modal');
          const content = event.target.closest('.image-modal-content');
          if (content && !event.target.closest('[data-action="close-image-modal"]')) return;
          if (modal && modal.classList.contains('open')) window.closeImageModal();
          return;
        }

        if (action === 'zoom-in') return window.zoomIn();
        if (action === 'zoom-out') return window.zoomOut();
        if (action === 'zoom-reset') return window.resetZoom();
        if (action === 'mark-sold') return window.markSold();
        if (action === 'delete-product') return window.deleteProduct();
        if (action === 'init-chat') return window.initChat();
        if (action === 'toggle-interested') return window.toggleInterested();
        if (action === 'submit-rating') return window.submitProductRating();
        if (action === 'reset-rating') return window.resetRatingForm();
        if (action === 'go-checkout') return window.goCheckout();
        if (action === 'close-report-modal') return window.closeReportModal();
        if (action === 'submit-report') return window.submitReport();

        if (action === 'report-seller') {
          const sellerId = actionEl.dataset.sellerId || '';
          if (sellerId) window.showReportModal('user', sellerId);
          return;
        }

        if (action === 'report-product') {
          const productId = actionEl.dataset.productId || PRODUCT_ID;
          if (productId) window.showReportModal('product', productId);
          return;
        }

        if (action === 'open-related') {
          const productId = actionEl.dataset.productId || '';
          if (productId) window.location.href = '/products/' + productId;
        }
      });

      const ratingStars = document.getElementById('rating-stars');
      if (ratingStars) {
        ratingStars.addEventListener('mouseover', (event) => {
          const star = event.target.closest('.star[data-score]');
          if (!star) return;
          const score = Number(star.dataset.score);
          if (Number.isInteger(score)) updateRatingHover(star, score);
        });
        ratingStars.addEventListener('mouseout', (event) => {
          if (event.target.closest('.star[data-score]')) clearRatingHover();
        });
        ratingStars.addEventListener('click', (event) => {
          const star = event.target.closest('.star[data-score]');
          if (!star) return;
          const score = Number(star.dataset.score);
          if (Number.isInteger(score)) selectRating(star, score);
        });
      }

      const textarea = document.getElementById('report-content');
      if (textarea) {
        textarea.addEventListener('input', () => {
          document.getElementById('report-char-count').textContent = textarea.value.length;
        });
      }
    });
// Initialize product rating on page load
    document.addEventListener('DOMContentLoaded', async () => {
      const productId = productConfig.productId || '';

      // Load product rating stats (overview)
      if (productId && typeof loadRatingStats === 'function') {
        loadRatingStats('product', productId, 'product-rating-stats-content');
      }

      // Load product ratings list
      if (productId && typeof loadRatings === 'function') {
        loadRatings('product', productId, 'product-ratings-list-content');
      }

      // Initialize Map
      const lat = productConfig.mapLat;
      const lng = productConfig.mapLng;
      const address = productConfig.mapAddress || '';

      if (lat && lng && document.getElementById('product-map') && typeof L !== 'undefined') {
        try {
          const map = L.map('product-map').setView([lat, lng], 15);
          L.tileLayer(window.AppUtils.mapServices.leafletTiles, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(map);

          L.marker([lat, lng]).addTo(map)
            .bindPopup(address || 'Pickup Location')
            .openPopup();
        } catch (e) {
          window.AppUtils?.reportClientError('Leaflet error:', e);
        }
      } else if (document.getElementById('product-map')) {
        document.getElementById('product-map').style.display = 'none';
      }

      // Initialize all icons on page
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
})();
