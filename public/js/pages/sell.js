(function () {
  const { createElement } = window.AppUtils || {};
  const config = window.SELL_PAGE_CONFIG || {};
  const submitUrl = config.submitUrl || '/api/products';
  const submitMethod = config.submitMethod || 'POST';
  const submitLabel = config.submitLabel || 'Post Product Now';
  const existingImages = Array.isArray(config.existingImages) ? config.existingImages : [];
  const draftKey = submitMethod === 'POST' ? 'seller_product_draft_v1' : '';

  let uploadedImages = [];
  let formDirty = false;

  const dropZone = document.getElementById('upload-drop-zone');
  const imageInput = document.getElementById('image-input');
  const imagePreview = document.getElementById('image-preview');
  const sellForm = document.getElementById('sell-form');
  const draftIndicator = document.getElementById('sell-draft-indicator');
  const flowNav = document.getElementById('sell-flow-nav');
  const flowSteps = Array.from(document.querySelectorAll('.sell-flow-step[data-step-target]'));
  const stepCards = Array.from(document.querySelectorAll('.sell-card[data-step-card]'));
  const uploadStatus = document.getElementById('upload-status');
  const imageCountIndicator = document.getElementById('image-count-indicator');
  const locationSummary = document.getElementById('sell-location-summary');
  const submitButton = document.getElementById('btn-submit-sell');

  const notify = (message, type = 'err') => {
    if (typeof showToast === 'function') showToast(message, type);
  };

  function setDraftIndicator(message, dirty = false) {
    if (!draftIndicator) return;
    draftIndicator.textContent = message;
    draftIndicator.classList.toggle('dirty', !!dirty);
  }

  function markDirty(value = true) {
    formDirty = value;
    setDraftIndicator(value ? 'Unsaved changes' : 'Draft saved', value);
  }

  function getDraftPayload() {
    return {
      title: document.getElementById('f-title')?.value || '',
      category: document.getElementById('f-cat')?.value || '',
      price: document.getElementById('f-price')?.value || '',
      quantity: document.getElementById('f-quantity')?.value || '1',
      description: document.getElementById('f-desc')?.value || '',
      condition: document.getElementById('f-condition')?.value || '',
      lat: document.getElementById('f-lat')?.value || '',
      lng: document.getElementById('f-lng')?.value || '',
      location: document.getElementById('f-location')?.value || '',
      images: uploadedImages
    };
  }

  function saveDraft() {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(getDraftPayload()));
      setDraftIndicator('Draft saved');
    } catch {}
  }

  function restoreDraft() {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || existingImages.length) return;
      document.getElementById('f-title').value = draft.title || '';
      document.getElementById('f-price').value = draft.price || '';
      document.getElementById('f-quantity').value = draft.quantity || 1;
      document.getElementById('f-desc').value = draft.description || '';
      document.getElementById('f-condition').value = draft.condition || '';
      document.getElementById('f-lat').value = draft.lat || '';
      document.getElementById('f-lng').value = draft.lng || '';
      document.getElementById('f-location').value = draft.location || '';
      const locationSearch = document.getElementById('location-search');
      if (locationSearch) locationSearch.value = draft.location || '';
      uploadedImages = Array.isArray(draft.images) ? draft.images : [];
      document.querySelectorAll('.cond-opt').forEach((option) => {
        option.classList.toggle('selected', option.dataset.val === (draft.condition || ''));
      });
      if (draft.category) {
        document.getElementById('f-cat').value = draft.category;
        const match = document.querySelector(`.category-option[data-slug="${CSS.escape(draft.category)}"]`);
        if (match) {
          document.getElementById('category-label').textContent = match.dataset.name;
          document.querySelectorAll('.category-option').forEach((opt) => {
            const selected = opt === match;
            opt.classList.toggle('selected', selected);
            opt.setAttribute('aria-selected', selected ? 'true' : 'false');
          });
        }
      }
      setDraftIndicator('Draft restored');
    } catch {}
  }

  function clearDraft() {
    if (!draftKey) return;
    try { localStorage.removeItem(draftKey); } catch {}
  }

  function setFieldState(element, state) {
    if (!element) return;
    element.classList.remove('field-error', 'field-valid');
    if (state === 'error') element.classList.add('field-error');
    if (state === 'valid') element.classList.add('field-valid');
  }

  function validateField(id, predicate) {
    const el = document.getElementById(id);
    const valid = Boolean(predicate(el?.value || ''));
    setFieldState(el, valid ? 'valid' : 'error');
    return valid;
  }

  function validateForm() {
    const validTitle = validateField('f-title', (value) => value.trim().length >= 4);
    const validCategory = validateField('f-cat', (value) => value.trim().length > 0);
    const validPrice = validateField('f-price', (value) => Number(value) > 0);
    const validQuantity = validateField('f-quantity', (value) => Number(value) >= 1);
    const validDesc = validateField('f-desc', (value) => value.trim().length >= 10);
    const validCondition = validateField('f-condition', (value) => value.trim().length > 0);
    const validLocation = validateField('f-location', (value) => value.trim().length > 0);
    return validTitle && validCategory && validPrice && validQuantity && validDesc && validCondition && validLocation;
  }

  function getStepCompletion() {
    return [
      uploadedImages.length > 0,
      Boolean(document.getElementById('f-condition')?.value.trim()),
      Boolean(
        document.getElementById('f-title')?.value.trim().length >= 4
        && document.getElementById('f-cat')?.value.trim()
        && Number(document.getElementById('f-price')?.value) > 0
        && Number(document.getElementById('f-quantity')?.value) >= 1
        && document.getElementById('f-desc')?.value.trim().length >= 10
      ),
      Boolean(document.getElementById('f-location')?.value.trim() && document.getElementById('f-lat')?.value && document.getElementById('f-lng')?.value)
    ];
  }

  function setActiveStep(stepIndex) {
    stepCards.forEach((card, index) => card.classList.toggle('active', index === stepIndex));
    flowSteps.forEach((step, index) => step.classList.toggle('active', index === stepIndex));
  }

  function syncStepState(preferredStep) {
    const completion = getStepCompletion();
    const firstIncomplete = completion.findIndex((step) => !step);
    const activeStep = Number.isInteger(preferredStep)
      ? preferredStep
      : (firstIncomplete === -1 ? completion.length - 1 : firstIncomplete);

    stepCards.forEach((card, index) => {
      card.classList.toggle('completed', completion[index]);
      card.dataset.stepState = completion[index] ? 'done' : (index === activeStep ? 'active' : 'idle');
    });

    flowSteps.forEach((step, index) => {
      step.classList.toggle('done', completion[index]);
      step.classList.toggle('active', index === activeStep);
    });
  }

  function updateImageMeta(message = '') {
    if (imageCountIndicator) imageCountIndicator.textContent = `${uploadedImages.length} / 5 images added`;
    if (!uploadStatus) return;
    uploadStatus.textContent = message || (uploadedImages.length ? 'Cover photo ready' : 'Ready to upload');
  }

  function updateLocationSummary() {
    if (!locationSummary) return;
    const address = document.getElementById('f-location')?.value.trim();
    locationSummary.textContent = address || 'No meetup point selected yet.';
  }

  function initLocationPicker() {
    const latInput = document.getElementById('f-lat');
    const lngInput = document.getElementById('f-lng');
    if (!latInput || !lngInput || typeof maplibregl === 'undefined') return;

    const defaultLat = parseFloat(latInput.value) || 21.0285;
    const defaultLng = parseFloat(lngInput.value) || 105.8542;
    const hasExisting = !!latInput.value;
    const map = new maplibregl.Map({
      container: 'location-map',
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: 'OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [defaultLng, defaultLat],
      zoom: 13
    });
    window.mapInstance = map;

    let marker;
    if (hasExisting) {
      marker = new maplibregl.Marker().setLngLat([defaultLng, defaultLat]).addTo(map);
      window.currentMarker = marker;
    }

    map.on('click', (event) => {
      const { lng, lat } = event.lngLat;
      if (window.currentMarker) window.currentMarker.remove();
      marker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
      window.currentMarker = marker;
      updateLocation(lat, lng);
    });

    initAutocomplete();
  }

  async function updateLocation(lat, lng, options = {}) {
    const { persist = true } = options;
    document.getElementById('f-lat').value = lat;
    document.getElementById('f-lng').value = lng;
    try {
      const address = await reverseGeocode(lat, lng);
      document.getElementById('f-location').value = address;
      document.getElementById('location-search').value = address;
    } catch (error) {
      window.AppUtils?.reportClientError('Geocoding failed:', error);
    } finally {
      updateLocationSummary();
      updatePreview();
      validateForm();
      syncStepState(3);
      if (persist) {
        markDirty(true);
        saveDraft();
      }
    }
  }

  async function reverseGeocode(lat, lng) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    return data.display_name;
  }

  async function searchLocation(query) {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
    const data = await response.json();
    return data.features || [];
  }

  function initAutocomplete() {
    const input = document.getElementById('location-search');
    const dropdown = document.getElementById('location-dropdown');
    if (!input || !dropdown) return;

    let timeout;
    input.addEventListener('input', function onInput() {
      clearTimeout(timeout);
      const query = this.value.trim();
      if (query.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      timeout = setTimeout(async () => {
        try {
          const results = await searchLocation(query);
          showDropdown(results);
        } catch (error) {
          window.AppUtils?.reportClientError('Search failed:', error);
        }
      }, 300);
    });

    document.addEventListener('click', (event) => {
      if (!input.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  function showDropdown(results) {
    const dropdown = document.getElementById('location-dropdown');
    if (!dropdown) return;
    if (!results.length) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.replaceChildren(...results.map((result) => {
      const name = result.properties.name || result.properties.city || result.properties.country || 'Unknown';
      const city = result.properties.city || '';
      const country = result.properties.country || '';
      return createElement('div', {
        className: 'dropdown-item',
        dataset: {
          lat: result.geometry.coordinates[1],
          lng: result.geometry.coordinates[0],
          name: encodeURIComponent(name)
        },
        children: [
          createElement('div', { className: 'dropdown-name', text: name }),
          createElement('div', { className: 'dropdown-address', text: `${city} ${country}`.trim() })
        ]
      });
    }));
    dropdown.style.display = 'block';
  }

  function selectLocation(lat, lng, name) {
    const map = window.mapInstance;
    if (!map) return;
    if (window.currentMarker) window.currentMarker.remove();
    window.currentMarker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
    map.setCenter([lng, lat]);
    map.setZoom(16);
    updateLocation(lat, lng);
    document.getElementById('location-dropdown').style.display = 'none';
    document.getElementById('location-search').value = name;
  }

  function geolocateMe() {
    if (!navigator.geolocation || !window.mapInstance) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (window.currentMarker) window.currentMarker.remove();
      window.currentMarker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(window.mapInstance);
      window.mapInstance.setCenter([lng, lat]);
      window.mapInstance.setZoom(16);
      await updateLocation(lat, lng);
    });
  }

  function initCategoryDropdown() {
    const combo = document.getElementById('category-combobox');
    const trigger = document.getElementById('category-trigger');
    const search = document.getElementById('category-search');
    const hidden = document.getElementById('f-cat');
    const nativeSelect = document.getElementById('f-cat-native');
    const label = document.getElementById('category-label');
    const triggerIcon = trigger?.querySelector('.category-icon i');
    const empty = document.getElementById('category-empty');
    const options = Array.from(document.querySelectorAll('.category-option'));
    let activeIndex = Math.max(0, options.findIndex((option) => option.classList.contains('selected')));

    if (!combo || !trigger || !search || !hidden || !label || !options.length) return;

    const open = () => {
      combo.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      search.value = '';
      filterOptions('');
      setActiveOption(activeIndex);
      setTimeout(() => search.focus(), 0);
    };

    const close = () => {
      combo.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    function setActiveOption(index) {
      const visibleOptions = options.filter((option) => option.style.display !== 'none');
      if (!visibleOptions.length) return;
      activeIndex = Math.max(0, Math.min(index, visibleOptions.length - 1));
      options.forEach((option) => option.classList.remove('active'));
      visibleOptions[activeIndex].classList.add('active');
      visibleOptions[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function filterOptions(query) {
      const normalized = query.trim().toLowerCase();
      let visibleCount = 0;
      options.forEach((option) => {
        const text = `${option.dataset.name} ${option.dataset.slug}`.toLowerCase();
        const matches = !normalized || text.includes(normalized);
        option.style.display = matches ? 'flex' : 'none';
        if (matches) visibleCount += 1;
      });
      empty.style.display = visibleCount ? 'none' : 'block';
      activeIndex = 0;
      setActiveOption(0);
    }

    function selectOption(option) {
      if (!option) return;
      hidden.value = option.dataset.slug;
      if (nativeSelect) nativeSelect.value = option.dataset.slug;
      label.textContent = option.dataset.name;
      if (triggerIcon) triggerIcon.setAttribute('data-lucide', option.dataset.icon);

      options.forEach((candidate) => {
        const selected = candidate === option;
        candidate.classList.toggle('selected', selected);
        candidate.setAttribute('aria-selected', selected ? 'true' : 'false');
      });

      close();
      markDirty(true);
      saveDraft();
      updatePreview();
      syncStepState(2);
      validateForm();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    trigger.addEventListener('click', () => {
      if (combo.classList.contains('open')) close();
      else open();
    });

    options.forEach((option) => option.addEventListener('click', () => selectOption(option)));
    search.addEventListener('input', () => filterOptions(search.value));

    combo.addEventListener('keydown', (event) => {
      const visibleOptions = options.filter((option) => option.style.display !== 'none');
      if (event.key === 'Escape') {
        close();
        trigger.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!combo.classList.contains('open')) open();
        setActiveOption(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveOption(activeIndex - 1);
      } else if (event.key === 'Enter' && combo.classList.contains('open')) {
        event.preventDefault();
        selectOption(visibleOptions[activeIndex]);
      }
    });

    document.addEventListener('click', (event) => {
      if (!combo.contains(event.target)) close();
    });
  }

  function initAIControls() {
    const lengthInput = document.getElementById('ai-length');
    const lengthValue = document.getElementById('ai-length-value');
    if (!lengthInput || !lengthValue) return;

    const syncLength = () => {
      lengthValue.textContent = lengthInput.value;
    };

    lengthInput.addEventListener('input', syncLength);
    syncLength();
  }

  function setupImageUpload() {
    if (!dropZone || !imageInput) return;
    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('is-dragover');
    });
    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragover');
      handleImageFiles(event.dataTransfer.files);
    });
    imageInput.addEventListener('change', (event) => handleImageFiles(event.target.files));
  }

  function handleImageFiles(files) {
    if (uploadedImages.length >= 5) {
      notify('Maximum 5 images allowed');
      return;
    }

    const filesToAdd = Array.from(files).slice(0, 5 - uploadedImages.length);
    if (!filesToAdd.length) return;
    updateImageMeta(`Uploading ${filesToAdd.length} image${filesToAdd.length > 1 ? 's' : ''}...`);
    filesToAdd.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        notify('Only image files are allowed');
        updateImageMeta();
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify('Image must be smaller than 5MB');
        updateImageMeta();
        return;
      }

      const formData = new FormData();
      formData.append('image', file);

      fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            uploadedImages.push(data.url);
            renderImagePreview();
            updatePreview();
            document.getElementById('f-images').value = JSON.stringify(uploadedImages);
            markDirty(true);
            saveDraft();
            updateImageMeta('Upload complete');
            syncStepState(0);
          } else {
            notify('Upload failed: ' + (data.message || 'Unknown error'));
            updateImageMeta('Upload failed');
          }
        })
        .catch((error) => {
          window.AppUtils?.reportClientError('Upload error:', error);
          notify('Network error during upload');
          updateImageMeta('Upload failed');
        });
    });
  }

  function renderImagePreview() {
    if (!imagePreview) return;
    imagePreview.replaceChildren(...uploadedImages.map((url, index) => createElement('div', {
      className: 'sell-image-tile',
      children: [
        createElement('img', { attrs: { src: url, alt: `image ${index + 1}` } }),
        createElement('div', {
          className: 'sell-image-toolbar',
          children: [
            createElement('div', { className: 'sell-image-tag', text: index === 0 ? 'Cover' : `Photo ${index + 1}` }),
            createElement('div', {
              className: 'sell-image-actions',
              children: [
                createElement('button', {
                  attrs: { type: 'button', title: 'Move left' },
                  className: 'sell-image-action',
                  dataset: { action: 'left', index },
                  text: '<'
                }),
                createElement('button', {
                  attrs: { type: 'button', title: 'Move right' },
                  className: 'sell-image-action',
                  dataset: { action: 'right', index },
                  text: '>'
                }),
                createElement('button', {
                  attrs: { type: 'button', title: 'Remove image' },
                  className: 'remove-image-btn',
                  dataset: { index },
                  text: 'x'
                })
              ]
            })
          ]
        })
      ]
    })));
    updateImageMeta();
  }

  function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImagePreview();
    updatePreview();
    document.getElementById('f-images').value = JSON.stringify(uploadedImages);
    markDirty(true);
    saveDraft();
    updateImageMeta(uploadedImages.length ? 'Photos updated' : 'Ready to upload');
    syncStepState(0);
  }

  function moveImage(index, direction) {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= uploadedImages.length) return;
    const [image] = uploadedImages.splice(index, 1);
    uploadedImages.splice(targetIndex, 0, image);
    renderImagePreview();
    updatePreview();
    document.getElementById('f-images').value = JSON.stringify(uploadedImages);
    markDirty(true);
    saveDraft();
  }

  function updatePreview() {
    const title = document.getElementById('f-title').value || 'Product Title';
    const selectedCategoryValue = document.getElementById('f-cat').value;
    const category = selectedCategoryValue ? document.getElementById('category-label').textContent : 'Category';
    const price = document.getElementById('f-price').value || '0';
    const quantity = document.getElementById('f-quantity').value || '1';
    const condition = document.getElementById('f-condition').value || 'Condition';
    const location = document.getElementById('f-location').value || 'Campus meetup';

    const imageWrap = document.getElementById('p-image-wrap');
    const badge = createElement('div', { className: 'preview-card-badge', attrs: { id: 'p-cond' }, text: condition });
    if (uploadedImages.length > 0) {
      imageWrap.replaceChildren(
        badge,
        createElement('img', { attrs: { src: uploadedImages[0], alt: 'preview' }, style: { width: '100%', height: '100%', objectFit: 'cover' } })
      );
    } else {
      imageWrap.replaceChildren(
        badge,
        createElement('i', { attrs: { 'data-lucide': 'image' }, style: { width: '48px', height: '48px', color: 'var(--t3)', opacity: '0.3' } })
      );
    }

    document.getElementById('p-title').textContent = title;
    document.getElementById('p-cat').textContent = category;
    document.getElementById('p-price').textContent = window.AppUtils && window.AppUtils.formatVND
      ? window.AppUtils.formatVND(price)
      : `${Number(price || 0).toLocaleString('vi-VN')} VND`;
    document.getElementById('p-quantity').textContent = 'Stock: ' + quantity;
    document.getElementById('p-location').textContent = location;

    const stepCompletion = getStepCompletion();
    const filled = (stepCompletion.filter(Boolean).length / stepCompletion.length) * 100;
    document.getElementById('sell-progress-fill').style.width = filled + '%';
    syncStepState();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function selectCond(element) {
    document.querySelectorAll('.cond-opt').forEach((option) => option.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('f-condition').value = element.dataset.val;
    markDirty(true);
    saveDraft();
    updatePreview();
    validateForm();
    syncStepState(1);
  }

  async function generateAIDescription() {
    const button = document.getElementById('btn-ai-describe');
    const statusDiv = document.getElementById('ai-status');
    const textarea = document.getElementById('f-desc');
    const title = document.getElementById('f-title').value.trim();
    const category = document.getElementById('f-cat').value;
    const condition = document.getElementById('f-condition').value;
    const price = document.getElementById('f-price').value;
    const location = document.getElementById('f-location').value;
    const tone = document.getElementById('ai-tone').value;
    const language = document.getElementById('ai-language').value;
    const targetWords = Number(document.getElementById('ai-length').value);
    const imageUrl = uploadedImages.find((url) => !url.startsWith('temp-')) || '';

    if (!title) {
      notify('Please enter a title first');
      return;
    }
    if (!category) {
      notify('Please select a category first');
      return;
    }
    if (!condition) {
      notify('Please select the item condition first');
      return;
    }
    if (textarea.value.trim()) {
      if (typeof showConfirm !== 'function') {
        notify('Clear the current description before generating a new one');
        return;
      }
      const replace = await showConfirm({
        title: 'Replace Description',
        message: 'AI will replace the current description. Continue?',
        confirmText: 'Replace',
        type: 'danger'
      });
      if (!replace) return;
    }

    button.disabled = true;
    button.style.opacity = '0.6';
    statusDiv.style.display = 'block';
    statusDiv.textContent = 'Generating description with AI...';

    try {
      const response = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, condition, price, location, imageUrl, tone, language, targetWords })
      });

      const data = await response.json();
      if (data.success && data.description) {
        textarea.value = data.description;
        statusDiv.style.background = '#e8f5e9';
        statusDiv.style.borderLeftColor = '#4caf50';
        statusDiv.style.color = '#2e7d32';
        statusDiv.textContent = 'Description generated successfully.';
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 3000);
        markDirty(true);
        saveDraft();
        updatePreview();
        validateForm();
        syncStepState(2);
      } else {
        statusDiv.style.background = '#ffebee';
        statusDiv.style.borderLeftColor = '#f44336';
        statusDiv.style.color = '#c62828';
        statusDiv.textContent = 'Failed: ' + (data.message || 'Try again');
      }
    } catch (error) {
      statusDiv.style.background = '#ffebee';
      statusDiv.style.borderLeftColor = '#f44336';
      statusDiv.style.color = '#c62828';
      statusDiv.textContent = 'Error: ' + error.message;
    } finally {
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  async function handleSubmit() {
    const button = submitButton || document.querySelector('.btn-submit');
    if (!validateForm()) {
      notify('Please complete the required fields before posting');
      return;
    }
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle" class="sell-submit-icon"></i> Publishing...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const payload = {
      title: document.getElementById('f-title').value,
      category: document.getElementById('f-cat').value,
      price: document.getElementById('f-price').value,
      quantity: document.getElementById('f-quantity').value,
      description: document.getElementById('f-desc').value,
      condition: document.getElementById('f-condition').value,
      images: uploadedImages,
      location: {
        lat: document.getElementById('f-lat').value,
        lng: document.getElementById('f-lng').value,
        address: document.getElementById('f-location').value
      }
    };

    try {
      const response = await fetch(submitUrl, {
        method: submitMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        clearDraft();
        markDirty(false);
        location.href = '/my-products';
      } else {
        notify(data.message || 'Failed to save');
        button.disabled = false;
        button.textContent = submitLabel;
      }
    } catch (error) {
      notify('Network error');
      button.disabled = false;
      button.textContent = submitLabel;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    uploadedImages = [...existingImages];
    restoreDraft();
    if (uploadedImages.length > 0) {
      renderImagePreview();
      document.getElementById('f-images').value = JSON.stringify(uploadedImages);
    }
    updateImageMeta();
    updateLocationSummary();
    initLocationPicker();
    setupImageUpload();
    initCategoryDropdown();
    initAIControls();
    if (sellForm) {
      sellForm.addEventListener('click', (event) => {
        const cond = event.target.closest('.cond-opt[data-val]');
        if (cond) {
          selectCond(cond);
          return;
        }

        const aiBtn = event.target.closest('#btn-ai-describe');
        if (aiBtn) {
          generateAIDescription();
          return;
        }

        const submitBtn = event.target.closest('#btn-submit-sell');
        if (submitBtn) {
          handleSubmit();
        }
      });

      sellForm.addEventListener('input', (event) => {
        const target = event.target;
        if (target && (target.id === 'f-title' || target.id === 'f-price' || target.id === 'f-quantity' || target.id === 'f-desc' || target.id === 'f-location')) {
          markDirty(true);
          saveDraft();
          updatePreview();
          validateForm();
          syncStepState(target.id === 'f-location' ? 3 : 2);
        }
      });

      sellForm.addEventListener('focusin', (event) => {
        const card = event.target.closest('.sell-card[data-step-card]');
        if (!card) return;
        setActiveStep(Number(card.dataset.stepCard));
      });
    }

    if (imagePreview) {
      imagePreview.addEventListener('click', (event) => {
        const moveBtn = event.target.closest('.sell-image-action[data-action][data-index]');
        if (moveBtn) {
          moveImage(Number(moveBtn.dataset.index), moveBtn.dataset.action);
          return;
        }
        const removeBtn = event.target.closest('.remove-image-btn[data-index]');
        if (!removeBtn) return;
        const index = Number(removeBtn.dataset.index);
        if (Number.isInteger(index) && index >= 0) removeImage(index);
      });
    }

    const dropdown = document.getElementById('location-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', (event) => {
        const item = event.target.closest('.dropdown-item[data-lat][data-lng][data-name]');
        if (!item) return;
        selectLocation(Number(item.dataset.lat), Number(item.dataset.lng), decodeURIComponent(item.dataset.name || ''));
      });
    }

    if (flowNav) {
      flowNav.addEventListener('click', (event) => {
        const target = event.target.closest('.sell-flow-step[data-step-target]');
        if (!target) return;
        const card = document.getElementById(target.dataset.stepTarget);
        if (!card) return;
        setActiveStep(Number(card.dataset.stepCard));
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    updatePreview();
    validateForm();
    syncStepState();
    setDraftIndicator(existingImages.length ? 'Editing existing product' : 'Draft saved');
  });

  window.addEventListener('beforeunload', (event) => {
    if (!formDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
