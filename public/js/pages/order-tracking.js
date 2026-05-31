(function () {
  const { createElement } = window.AppUtils || {};
  const config = window.AppUtils?.readJsonScript
    ? window.AppUtils.readJsonScript('order-tracking-config')
    : {};
  const order = config.order;
  const isBuyer = !!config.isBuyer;
  const isSeller = !!config.isSeller;
  const disputeOrderId = config.orderId;

  if (!order) return;

  const map = L.map('map').setView([21.0285, 105.8542], 13);
  L.tileLayer(window.AppUtils.mapServices.leafletTiles, {
    attribution: 'OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  let buyerPos = null;
  let sellerPos = null;
  let routeLine = null;
  let routingControl = null;

  function createMarkerIcon(color) {
    return L.divIcon({
      className: 'tracking-marker-icon',
      html: `<div style="width:32px;height:32px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 6px 14px rgba(15,23,42,0.18);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:999px;background:#fff;"></div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  }

  function getLatLngPoint(point) {
    if (!point) return null;
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }

  function buildShippingAddress() {
    if (!order.shippingAddress) return '';
    return [order.shippingAddress.street, order.shippingAddress.district, order.shippingAddress.city]
      .filter(Boolean)
      .join(', ');
  }

  function buildPickupAddress() {
    return order.pickupLocation && order.pickupLocation.address ? order.pickupLocation.address : '';
  }

  async function geocodeAddress(address) {
    if (!address) return null;
    try {
      const response = await fetch(window.AppUtils.buildUrl(window.AppUtils.mapServices.searchGeocode, { format: 'json', limit: 1, q: address }), {
        headers: { Accept: 'application/json' }
      });
      const results = await response.json();
      if (Array.isArray(results) && results[0] && results[0].lat && results[0].lon) {
        return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
      }
    } catch (error) {}
    return null;
  }

  async function resolveRoutePoints() {
    const sellerPoint = getLatLngPoint(order.seller && order.seller.location)
      || getLatLngPoint(order.product && order.product.location)
      || await geocodeAddress(order.product && order.product.location && order.product.location.address ? order.product.location.address : '');

    const buyerPoint = order.deliveryMode === 'ship'
      ? getLatLngPoint(order.shippingAddress) || await geocodeAddress(buildShippingAddress())
      : getLatLngPoint(order.pickupLocation) || await geocodeAddress(buildPickupAddress());

    sellerPos = sellerPoint || [21.0435, 105.8542];
    buyerPos = buyerPoint || [21.0285, 105.8542];
  }

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

  function drawRoute() {
    const dist = calcDist(buyerPos, sellerPos);
    document.getElementById('distanceValue').textContent = dist.toFixed(1) + ' km';
    document.getElementById('estimatedTime').textContent = `Est. delivery time: ${Math.round(dist * 6)} mins`;

    if (routeLine) {
      routeLine.setLatLngs([sellerPos, buyerPos]);
    } else {
      routeLine = L.polyline([sellerPos, buyerPos], { color: '#fbbf24', dashArray: '8, 8' }).addTo(map);
    }

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

    const bounds = L.latLngBounds([sellerPos, buyerPos]);
    map.fitBounds(bounds.pad(0.5));
  }

  (async function initRouteMap() {
    await resolveRoutePoints();

    const buyerLabel = order.deliveryMode === 'ship' ? 'Buyer shipping address' : 'Buyer pickup point';
    const sellerLabel = 'Seller origin';

    L.marker(sellerPos, {
      icon: createMarkerIcon('#16a34a')
    }).addTo(map).bindPopup('<strong>Origin</strong><br>' + sellerLabel);

    L.marker(buyerPos, {
      icon: createMarkerIcon('#1B5EFF')
    }).addTo(map).bindPopup('<strong>Destination</strong><br>' + buyerLabel);

    drawRoute();
  })();

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
