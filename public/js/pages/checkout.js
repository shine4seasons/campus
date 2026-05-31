(function () {
const { createElement, createSvgElement, formatVND } = window.AppUtils || {};
const checkoutConfig = window.AppUtils?.readJsonScript
  ? window.AppUtils.readJsonScript('checkout-page-config')
  : {};
    const PRODUCT_ID = checkoutConfig.productId || '';
    const PRODUCT_PRICE = Number(checkoutConfig.productPrice || 0);
    const PRODUCT_STOCK = Number(checkoutConfig.productStock || 1);
    const SELLER_ID = checkoutConfig.sellerId || '';
    const SHIP_FEE = Number(checkoutConfig.shipFee || 0);

    let deliveryMode = 'pickup';
    let paymentMode  = 'cash';
    let orderConvId  = null;
    let placedOrderId = null;
    let successCountdownTimer = null;
    let successRedirectTimer = null;

    // ── Format helpers ──────────────────────────────────────────────────────
    function getOrderQuantity() {
      const el = document.getElementById('order-quantity');
      const qty = Number.parseInt(el?.value, 10) || 1;
      return Math.min(Math.max(qty, 1), PRODUCT_STOCK);
    }

    function updateTotals() {
      const qtyEl = document.getElementById('order-quantity');
      const qty = getOrderQuantity();
      if (qtyEl && String(qtyEl.value) !== String(qty)) qtyEl.value = qty;
      const subtotal = PRODUCT_PRICE * qty;
      const fee = (deliveryMode === 'ship') ? SHIP_FEE : 0;
      const total = subtotal + fee;
      document.getElementById('sum-quantity').textContent = qty;
      document.getElementById('sum-subtotal').textContent = formatVND(subtotal);
      document.getElementById('sum-total').textContent = formatVND(total);
      document.getElementById('bottom-total').textContent = formatVND(total);
    }

    // ── Delivery selection ──────────────────────────────────────────────────
    window.selectDelivery = function(mode) {
      deliveryMode = mode;
      document.getElementById('tab-pickup').classList.toggle('selected', mode === 'pickup');
      document.getElementById('tab-ship').classList.toggle('selected', mode === 'ship');
      document.getElementById('pickup-info').style.display  = mode === 'pickup' ? 'block' : 'none';
      document.getElementById('ship-info').style.display    = mode === 'ship'   ? 'block' : 'none';

      // Update shipping fee
      const fee = (mode === 'ship') ? SHIP_FEE : 0;
      document.getElementById('sum-ship').textContent = fee > 0 ? formatVND(fee) : 'Free';
      document.getElementById('sum-ship').style.color  = fee > 0 ? '#0D0F1A' : '#34C759';
      updateTotals();
    };

    // ── Payment selection ───────────────────────────────────────────────────
    window.selectPayment = function(mode) {
      paymentMode = mode;
      document.getElementById('pay-cash').classList.toggle('selected', mode === 'cash');
      document.getElementById('pay-qr').classList.toggle('selected', mode === 'qr');
      const qrInfo = document.getElementById('qr-info');
      qrInfo.classList.toggle('hidden', mode !== 'qr');
    };


    // ── Validation ──────────────────────────────────────────────────────────
    function clearFieldError(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('input-error');
      const msg = el.parentElement?.querySelector('.field-error');
      if (msg) msg.remove();
    }

    function setFieldError(id, message) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('input-error');
      let msg = el.parentElement?.querySelector('.field-error');
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'field-error';
        el.parentElement.appendChild(msg);
      }
      msg.textContent = message;
    }

    function showToast(message, type = 'error') {
      let toast = document.getElementById('co-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'co-toast';
        toast.className = 'co-toast';
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.dataset.type = type;
      toast.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
    }

    ['addr-name','addr-phone','addr-street','addr-city']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => clearFieldError(id));
      });

    function validate() {
      let firstErrorEl = null;
      const fail = (id, msg) => {
        setFieldError(id, msg);
        if (!firstErrorEl) firstErrorEl = document.getElementById(id);
      };

      if (deliveryMode === 'ship') {
        const name   = document.getElementById('addr-name').value.trim();
        const phone  = document.getElementById('addr-phone').value.trim();
        const street = document.getElementById('addr-street').value.trim();
        const city   = document.getElementById('addr-city').value.trim();
        if (!name)   fail('addr-name', 'Please enter your full name');
        if (!phone || !/^[0-9+\s().-]{8,}$/.test(phone)) fail('addr-phone', 'Enter a valid phone number');
        if (!street) fail('addr-street', 'Enter your street address');
        if (!city)   fail('addr-city', 'Enter your city / province');
      }
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior:'smooth', block:'center' });
        firstErrorEl.focus({ preventScroll:true });
        return false;
      }
      return true;
    }

    // ── Place order ─────────────────────────────────────────────────────────
    window.closeConfirm = function() {
      document.getElementById('confirm-overlay').classList.remove('show');
    };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeConfirm();
    });
    document.getElementById('confirm-overlay').addEventListener('click', e => {
      if (e.target.id === 'confirm-overlay') closeConfirm();
    });

    function createConfirmRow(label, value, strongStyle, className = 'ccr') {
      return createElement('div', {
        className,
        children: [
          createElement('span', { text: label }),
          createElement('strong', { style: strongStyle || {}, text: value })
        ]
      });
    }

    function setPlaceButton(button, loading) {
      if (loading) {
        button.replaceChildren(
          createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', class: 'spin' }, [
            createSvgElement('path', { d: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83' })
          ]),
          document.createTextNode(' Processing...')
        );
        return;
      }

      button.replaceChildren(
        createSvgElement('svg', { width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', viewBox: '0 0 24 24' }, [
          createSvgElement('polyline', { points: '20 6 9 17 4 12' })
        ]),
        document.createTextNode(' Place order')
      );
    }

    window.placeOrder = function() {
      if (!validate()) return;
      // Build summary rows for confirmation
      const rows = document.getElementById('confirm-rows');
      const total = document.getElementById('sum-total').textContent;
      const qty = getOrderQuantity();
      const delivery = deliveryMode === 'pickup' ? 'Pick up' : 'Ship to address';
      const payment = paymentMode === 'cash' ? 'Cash on pickup' : 'QR Transfer';
      let addr = '';
      if (deliveryMode === 'ship') {
        addr = [document.getElementById('addr-street').value, document.getElementById('addr-district').value, document.getElementById('addr-city').value].filter(Boolean).join(', ');
      } else {
        addr = document.getElementById('checkout-f-location').value || 'Pickup location to be confirmed via chat';
      }
      rows.replaceChildren(
        createConfirmRow('Delivery', delivery),
        createConfirmRow('Payment', payment),
        createConfirmRow('Quantity', String(qty)),
        createConfirmRow(deliveryMode === 'ship' ? 'Ship to' : 'Pickup', addr, { textAlign: 'right', maxWidth: '60%' }),
        createConfirmRow('Total', total, null, 'ccr ccr-total')
      );
      document.getElementById('confirm-overlay').classList.add('show');
    };

    window.confirmAndPlace = async function() {
      closeConfirm();
      await doPlaceOrder();
    };

    async function doPlaceOrder() {
      const btn = document.getElementById('place-btn');
      const form = document.querySelector('.main');
      btn.disabled = true;
      setPlaceButton(btn, true);
      // Disable all form inputs while submitting
      form?.querySelectorAll('input, textarea, button:not(#place-btn)').forEach(el => el.disabled = true);
      const restoreForm = () => {
        btn.disabled = false;
        setPlaceButton(btn, false);
        form?.querySelectorAll('input, textarea, button:not(#place-btn)').forEach(el => el.disabled = false);
      };

      const orderData = {
        productId:    PRODUCT_ID,
        quantity:     getOrderQuantity(),
        deliveryMode,
        paymentMode,
        note: document.getElementById('order-note').value.trim(),
        shippingAddress: deliveryMode === 'ship' ? {
          name:     document.getElementById('addr-name').value.trim(),
          phone:    document.getElementById('addr-phone').value.trim(),
          street:   document.getElementById('addr-street').value.trim(),
          district: document.getElementById('addr-district').value.trim(),
          city:     document.getElementById('addr-city').value.trim(),
          lat:      document.getElementById('ship-f-lat').value,
          lng:      document.getElementById('ship-f-lng').value
        } : null,
        pickupLocation: deliveryMode === 'pickup' ? {
          address: document.getElementById('checkout-f-location').value,
          lat:     document.getElementById('checkout-f-lat').value,
          lng:     document.getElementById('checkout-f-lng').value
        } : null
      };

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
          credentials: 'include'
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          orderConvId = json.conversationId || null;
          placedOrderId = json.orderId || null;
          if (paymentMode === 'qr' && json.paymentId) {
            window.location.href = '/checkout/payment/' + json.paymentId;
          } else {
            showOrderSuccessOverlay();
          }
        } else {
          showToast(json.message || `Order failed (${res.status}). Please try again.`);
          restoreForm();
        }
      } catch (err) {
        window.AppUtils?.reportClientError('Order error:', err);
        showToast('Network error. Check your connection and try again.');
        restoreForm();
      }
    }

    function showOrderSuccessOverlay() {
      const overlay = document.getElementById('success-overlay');
      const countdownEl = document.getElementById('success-countdown');
      let remaining = 5;
      countdownEl.textContent = `Auto return home in ${remaining}s`;
      overlay.classList.add('show');

      clearInterval(successCountdownTimer);
      clearTimeout(successRedirectTimer);

      successCountdownTimer = setInterval(() => {
        remaining -= 1;
        countdownEl.textContent = `Auto return home in ${Math.max(remaining, 0)}s`;
        if (remaining <= 0) clearInterval(successCountdownTimer);
      }, 1000);

      successRedirectTimer = setTimeout(() => {
        window.location.href = '/';
      }, 5000);
    }

    window.goHomeNow = function() {
      clearInterval(successCountdownTimer);
      clearTimeout(successRedirectTimer);
      window.location.href = '/';
    };

    window.goToOrderTracking = function() {
      clearInterval(successCountdownTimer);
      clearTimeout(successRedirectTimer);
      if (placedOrderId) {
        window.location.href = `/orders/tracking/${placedOrderId}`;
        return;
      }
      window.location.href = '/orders-buyer';
    };

    // ── Checkout map integration ──────────────────
    let checkoutMapInstance = null;
    let checkoutCurrentMarker = null;
    let currentMapContext = 'pickup'; // 'pickup' or 'ship'

    window.toggleCheckoutMap = function(show, context = 'pickup') {
      currentMapContext = context;
      const wrap = document.getElementById('checkout-map-wrap');
      
      // If ship, show the map wrap inside the ship-info
      if (context === 'ship') {
        const shipInfo = document.getElementById('ship-info');
        if (show) shipInfo.appendChild(wrap);
      } else {
        const pickupInfo = document.getElementById('pickup-info');
        if (show) pickupInfo.appendChild(wrap);
      }

      wrap.style.display = show ? 'block' : 'none';
      if (show && !checkoutMapInstance) {
        initCheckoutMap();
      } else if (show) {
        setTimeout(() => {
          checkoutMapInstance.resize();
          // Auto geolocate for ship if no addr yet
          if (context === 'ship' && !document.getElementById('ship-f-lat').value) {
            geolocateCheckout();
          }
        }, 100);
      }
    }

    function initCheckoutMap() {
      const latVal = parseFloat(document.getElementById('checkout-f-lat').value) || 21.0285;
      const lngVal = parseFloat(document.getElementById('checkout-f-lng').value) || 105.8542;
      const hasExisting = !!document.getElementById('checkout-f-lat').value;

      const map = new maplibregl.Map({
        container: 'checkout-location-map',
        style: {
          version: 8,
          sources: { 'osm': { type:'raster', tiles: window.AppUtils.mapServices.rasterTiles, tileSize:256 } },
          layers: [{ id:'osm', type:'raster', source:'osm' }]
        },
        center: [lngVal, latVal],
        zoom: 13
      });
      checkoutMapInstance = map;

      if (hasExisting) {
        checkoutCurrentMarker = new maplibregl.Marker().setLngLat([lngVal, latVal]).addTo(map);
      } else if (navigator.geolocation && (currentMapContext === 'ship' || !hasExisting)) {
        // Auto geolocate if no existing location
        geolocateCheckout();
      }

      map.on('click', function(e) {
        const { lng, lat } = e.lngLat;
        if (checkoutCurrentMarker) checkoutCurrentMarker.remove();
        checkoutCurrentMarker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
        updateCheckoutLocation(lat, lng);
      });

      initCheckoutAutocomplete(map);
    }

    async function updateCheckoutLocation(lat, lng) {
      try {
        await reverseGeocodeCheckout(lat, lng);
      } catch (err) { window.AppUtils?.reportClientError('Geocoding failed:', err); }
    }

    async function reverseGeocodeCheckout(lat, lng) {
      const res  = await fetch(window.AppUtils.buildUrl(window.AppUtils.mapServices.reverseGeocode, { format: 'json', lat, lon: lng }));
      const data = await res.json();
      
      if (currentMapContext === 'ship') {
        const addr = data.address || {};
        const street = addr.road || addr.suburb || '';
        const houseNum = addr.house_number || '';
        document.getElementById('addr-street').value = (houseNum ? houseNum + ' ' : '') + street;
        document.getElementById('addr-district').value = addr.district || addr.suburb || addr.city_district || '';
        document.getElementById('addr-city').value = addr.city || addr.state || addr.province || '';
        document.getElementById('ship-f-lat').value = lat;
        document.getElementById('ship-f-lng').value = lng;
      } else {
        document.getElementById('checkout-f-lat').value = lat;
        document.getElementById('checkout-f-lng').value = lng;
        document.getElementById('checkout-f-location').value = data.display_name;
        const addrEl = document.querySelector('.pickup-box-addr');
        if (addrEl) addrEl.textContent = data.display_name;
      }
      
      return data.display_name;
    }

    async function searchLocationCheckout(query) {
      const res  = await fetch(window.AppUtils.buildUrl(window.AppUtils.mapServices.autocomplete, { q: query, limit: 5 }));
      const data = await res.json();
      return data.features || [];
    }

    function initCheckoutAutocomplete(map) {
      const input    = document.getElementById('checkout-location-search');
      const dropdown = document.getElementById('checkout-location-dropdown');
      let timeout;

      input.addEventListener('input', function() {
        clearTimeout(timeout);
        const query = this.value.trim();
        if (query.length < 2) { dropdown.style.display = 'none'; return; }
        timeout = setTimeout(async () => {
          try {
            const results = await searchLocationCheckout(query);
            showCheckoutDropdown(results, map);
          } catch (err) { window.AppUtils?.reportClientError('Search failed:', err); }
        }, 300);
      });

      document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target))
          dropdown.style.display = 'none';
      });
    }

    function showCheckoutDropdown(results, map) {
      const dropdown = document.getElementById('checkout-location-dropdown');
      if (!results.length) { dropdown.style.display = 'none'; return; }
      dropdown.replaceChildren(...results.map((r) => createElement('div', {
        className: 'dropdown-item',
        dataset: {
          lat: r.geometry.coordinates[1],
          lng: r.geometry.coordinates[0],
          name: encodeURIComponent(r.properties.name || r.properties.city || r.properties.country || '')
        },
        children: [
          createElement('div', { className: 'dropdown-name', text: r.properties.name || 'Unknown' }),
          createElement('div', { className: 'dropdown-address', text: `${r.properties.city || ''} ${r.properties.country || ''}`.trim() })
        ]
      })));
      dropdown.style.display = 'block';
    }

    window.selectCheckoutLocation = function(lat, lng, name) {
      const map = checkoutMapInstance;
      if (checkoutCurrentMarker) checkoutCurrentMarker.remove();
      checkoutCurrentMarker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
      map.setCenter([lng, lat]);
      map.setZoom(16);
      updateCheckoutLocation(lat, lng);
      document.getElementById('checkout-location-dropdown').style.display = 'none';
      document.getElementById('checkout-location-search').value = name;
    };

    window.geolocateCheckout = function() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (checkoutCurrentMarker) checkoutCurrentMarker.remove();
        checkoutCurrentMarker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(checkoutMapInstance);
        checkoutMapInstance.setCenter([lng, lat]);
        checkoutMapInstance.setZoom(16);
        await updateCheckoutLocation(lat, lng);
      });
    }

    window.saveCheckoutLocation = function() {
      // simply close map; data is already written to hidden inputs and pickup-box-addr
      window.toggleCheckoutMap(false);
    }

    document.getElementById('checkout-location-dropdown')?.addEventListener('click', function(event) {
      const item = event.target.closest('.dropdown-item[data-lat][data-lng][data-name]');
      if (!item) return;
      window.selectCheckoutLocation(Number(item.dataset.lat), Number(item.dataset.lng), decodeURIComponent(item.dataset.name || ''));
    });

    document.getElementById('order-quantity')?.addEventListener('input', updateTotals);

    document.addEventListener('click', function(event) {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      if (action === 'select-delivery') window.selectDelivery(target.dataset.mode);
      if (action === 'select-payment') window.selectPayment(target.dataset.mode);
      if (action === 'open-map') window.toggleCheckoutMap(true, target.dataset.context || 'pickup');
      if (action === 'close-map') window.toggleCheckoutMap(false);
      if (action === 'geolocate') window.geolocateCheckout();
      if (action === 'save-location') window.saveCheckoutLocation();
      if (action === 'place-order') window.placeOrder();
      if (action === 'close-confirm') window.closeConfirm();
      if (action === 'confirm-place') window.confirmAndPlace();
      if (action === 'go-home-now') window.goHomeNow();
      if (action === 'go-order-tracking') window.goToOrderTracking();
    });
})();
