(function () {
  const { createElement } = window.AppUtils || {};
  const config = window.ORDER_TRACKING_CONFIG || {};
  const order = config.order;
  const isBuyer = !!config.isBuyer;
  const isSeller = !!config.isSeller;
  const disputeOrderId = config.orderId;

  if (!order) return;

  const map = L.map('map').setView([21.0285, 105.8542], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  let buyerPos = null;
  let sellerPos = null;

  if (order.deliveryMode === 'ship' && order.shippingAddress && order.shippingAddress.lat) {
    buyerPos = [order.shippingAddress.lat, order.shippingAddress.lng];
  } else if (order.buyer && order.buyer.location && order.buyer.location.lat) {
    buyerPos = [order.buyer.location.lat, order.buyer.location.lng];
  }

  if (order.deliveryMode === 'pickup' && order.pickupLocation && order.pickupLocation.lat) {
    sellerPos = [order.pickupLocation.lat, order.pickupLocation.lng];
  } else if (order.product && order.product.location && order.product.location.lat) {
    sellerPos = [order.product.location.lat, order.product.location.lng];
  } else if (order.seller && order.seller.location && order.seller.location.lat) {
    sellerPos = [order.seller.location.lat, order.seller.location.lng];
  }

  if (!buyerPos) buyerPos = [21.0285, 105.8542];
  if (!sellerPos) sellerPos = [21.0435, 105.8542];

  const buyerMarker = L.marker(buyerPos, {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzFCNUVGRiIgLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSI2IiBmaWxsPSJ3aGl0ZSIgLz48L3N2Zz4=',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    })
  }).addTo(map).bindPopup(isBuyer ? '<strong>Destination (You)</strong><br>Your Location' : '<strong>Destination</strong><br>Buyer Location');

  const sellerMarker = L.marker(sellerPos, {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzE2YTM0YSIgLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSI2IiBmaWxsPSJ3aGl0ZSIgLz48L3N2Zz4=',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    })
  }).addTo(map).bindPopup(isSeller ? '<strong>Origin (You)</strong><br>Your Location' : '<strong>Origin</strong><br>Seller Location');

  function calcDist(pointA, pointB) {
    const earthRadiusKm = 6371;
    const dLat = (pointB[0] - pointA[0]) * Math.PI / 180;
    const dLon = (pointB[1] - pointA[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(pointA[0] * Math.PI / 180) *
      Math.cos(pointB[0] * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let routeLine = L.polyline([buyerPos, sellerPos], { color: '#fbbf24', dashArray: '8, 8' }).addTo(map);
  let routingControl = null;

  function drawRoute() {
    const dist = calcDist(buyerPos, sellerPos);
    document.getElementById('distanceValue').textContent = dist.toFixed(1) + ' km';
    document.getElementById('estimatedTime').textContent = `Est. delivery time: ${Math.round(dist * 6)} mins`;

    if (routeLine) routeLine.setLatLngs([buyerPos, sellerPos]);

    if (routingControl) {
      try {
        map.removeControl(routingControl);
      } catch (error) {}
    }

    try {
      routingControl = L.Routing.control({
        waypoints: [L.latLng(sellerPos), L.latLng(buyerPos)],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false
      }).addTo(map);
    } catch (error) {}

    const bounds = L.latLngBounds([buyerPos, sellerPos]);
    map.fitBounds(bounds.pad(0.5));
  }

  drawRoute();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const livePos = [position.coords.latitude, position.coords.longitude];
        if (isBuyer) {
          buyerPos = livePos;
          buyerMarker.setLatLng(buyerPos);
          buyerMarker.bindPopup('<strong>Destination (You)</strong><br>Your Live Location').openPopup();
        } else if (isSeller) {
          sellerPos = livePos;
          sellerMarker.setLatLng(sellerPos);
          sellerMarker.bindPopup('<strong>Origin (You)</strong><br>Your Live Location').openPopup();
        }
        drawRoute();
      },
      (error) => {
        window.AppUtils?.reportClientWarn('Geolocation error or permission denied:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  let disputeEvidenceUrls = [];
  const backdrop = document.getElementById('dispute-modal-backdrop');
  const evInput = document.getElementById('dispute-evidence-input');
  const evList = document.getElementById('dispute-evidence-list');
  const evAdd = document.getElementById('dispute-evidence-add');

  window.openDisputeModal = function openDisputeModal() {
    backdrop.classList.add('show');
  };

  window.closeDisputeModal = function closeDisputeModal() {
    backdrop.classList.remove('show');
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target.id === 'dispute-modal-backdrop') window.closeDisputeModal();
  });

  evAdd.addEventListener('click', () => evInput.click());

  evInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please pick an image', 'err');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'err');
      return;
    }
    if (disputeEvidenceUrls.length >= 6) {
      showToast('Maximum 6 images', 'err');
      return;
    }

    evAdd.textContent = '...';
    evAdd.disabled = true;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload/chat', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Upload failed');
      disputeEvidenceUrls.push(json.url);
      addEvidenceThumb(json.url);
    } catch (error) {
      showToast('Upload failed: ' + error.message, 'err');
    } finally {
      evAdd.textContent = '+';
      evAdd.disabled = false;
      evInput.value = '';
    }
  });

  function addEvidenceThumb(url) {
    const thumb = document.createElement('div');
    thumb.className = 'dispute-evidence-thumb';
    const image = createElement('img', { attrs: { src: url, alt: 'evidence' } });
    const button = createElement('button', { attrs: { type: 'button' }, text: 'x' });
    button.addEventListener('click', () => {
      disputeEvidenceUrls = disputeEvidenceUrls.filter((item) => item !== url);
      thumb.remove();
    });
    thumb.append(image, button);
    evList.insertBefore(thumb, evAdd);
  }

  window.submitDispute = async function submitDispute() {
    const category = document.getElementById('dispute-category').value;
    const reason = document.getElementById('dispute-reason').value.trim();
    const description = document.getElementById('dispute-description').value.trim();
    const button = document.getElementById('dispute-submit-btn');

    if (!reason) {
      showToast('Please enter a short reason', 'err');
      return;
    }

    button.disabled = true;
    button.textContent = 'Submitting...';

    try {
      const response = await fetch('/api/orders/' + disputeOrderId + '/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, reason, description, evidenceImages: disputeEvidenceUrls })
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Failed');

      button.textContent = 'Submitted';
      showToast('Dispute submitted successfully', 'ok');
      setTimeout(() => location.reload(), 600);
    } catch (error) {
      showToast('Could not submit: ' + error.message, 'err');
      button.disabled = false;
      button.textContent = 'Submit report';
    }
  };

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    if (target.dataset.action === 'open-dispute-modal') window.openDisputeModal();
    if (target.dataset.action === 'close-dispute-modal') window.closeDisputeModal();
    if (target.dataset.action === 'submit-dispute') window.submitDispute();
  });
})();
