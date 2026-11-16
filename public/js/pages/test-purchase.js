(function () {
  'use strict';
  const config = JSON.parse(document.getElementById('hct-flow-config').textContent);
  const cart = window.HCTCart;
  const receiptKey = 'hct-last-test-receipt';
  const status = document.getElementById('hct-flow-status');
  const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('hct-error', error);
  }
  function line(label, value, total = false) {
    const row = node('div', undefined, 'hct-line' + (total ? ' hct-total' : ''));
    row.append(node('span', label), node('span', value));
    return row;
  }
  function fingerprint(items) { return JSON.stringify(items); }
  function imageUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  async function fetchRows(items) {
    return Promise.all(items.map(async item => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/products/' + item.id, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (response.status === 404) return { ...item, unavailable: true, title: 'Listing no longer available' };
        if (!response.ok) throw new Error('Could not check your items. Please refresh and try again.');
        const payload = await response.json();
        const product = payload.data;
        if (!payload.success || !product || String(product._id).toLowerCase() !== item.id) throw new Error('Invalid listing response. Please try again.');
        const sellerId = String(product.seller?._id || product.seller || '');
        const stock = product.quantity === undefined ? 1 : product.quantity;
        const validStock = Number.isInteger(stock) && stock > 0;
        const validPrice = typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0;
        const unavailable = product.status !== 'active' || !validStock || !validPrice || Boolean(config.userId && sellerId === config.userId);
        return { ...item, title: product.title || 'Untitled listing', price: product.price, condition: product.condition || '', stock: validStock ? Math.min(stock, 99) : 0, image: imageUrl(product.images?.[0]), unavailable };
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('The availability check timed out. Please refresh and try again.');
        throw error;
      } finally { clearTimeout(timeout); }
    }));
  }
  if (config.page === 'confirmation') {
    try {
      const receipt = JSON.parse(sessionStorage.getItem(receiptKey));
      if (!receipt || !/^DEMO-[A-Z0-9-]+$/.test(receipt.code) || !Array.isArray(receipt.items) || !receipt.items.length || receipt.items.length > 50 || !Number.isFinite(Date.parse(receipt.date))) throw new Error();
      if (!receipt.items.every(item => typeof item.title === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99 && Number.isFinite(item.price) && item.price >= 0)) throw new Error();
      const target = document.getElementById('hct-receipt');
      target.append(node('h2', 'Test completed'), line('Test reference', receipt.code), line('Date', new Date(receipt.date).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (Vietnam time)'), line('Mock pickup', receipt.pickup), line('Payment status', 'SIMULATED — no payment collected'));
      let total = 0;
      for (const item of receipt.items) {
        total += item.price * item.quantity;
        target.append(line(item.title + ' × ' + item.quantity, money(item.price * item.quantity)));
      }
      target.append(line('Pickup fee', money(0)), line('Test total', money(total), true), node('p', 'This test is complete. For any actual exchange, contact each seller and agree the item condition and pickup details first.'));
      message('Your test confirmation is available in this tab.');
    } catch (_) {
      message('No test receipt is available in this tab. Add an item to your cart and complete Test checkout first.', true);
    }
    return;
  }
  const target = document.getElementById('hct-cart-items');
  const form = document.getElementById('hct-checkout-form');
  const proceed = document.getElementById('hct-checkout-button');
  const confirm = document.getElementById('hct-confirm-button');
  let currentRows = [];
  let reviewedCart = '';
  let generation = 0;
  let ready = false;
  let submitting = false;
  function enable(value) {
    ready = value;
    if (proceed) proceed.disabled = !value;
    if (confirm) confirm.disabled = !value;
  }
  function render(rows) {
    target.replaceChildren();
    if (!rows.length) target.append(node('h2', 'Your cart is empty'), node('p', 'Open a product and choose Add to cart to get started.'));
    for (const item of rows) {
      const row = node('article', undefined, 'hct-item');
      const image = node('img');
      image.alt = item.title;
      if (item.image) image.src = item.image;
      else image.hidden = true;
      const body = node('div');
      const link = node('a', item.title);
      link.href = '/products/' + item.id;
      const heading = node('h2');
      heading.append(link);
      body.append(heading);
      if (item.unavailable) body.append(node('p', 'Unavailable for checkout. Remove this item to continue.', 'hct-error'));
      else {
        body.append(node('p', money(item.price) + ' each · Condition: ' + item.condition + ' · Stock: ' + item.stock));
        if (item.quantity > item.stock) body.append(node('p', 'Quantity exceeds current stock. Reduce it in your cart.', 'hct-error'));
      }
      if (config.page === 'cart') {
        const label = node('label', 'Quantity');
        const input = node('input');
        input.type = 'number'; input.min = '1'; input.max = String(item.stock || 99); input.step = '1'; input.value = String(item.quantity);
        input.disabled = item.unavailable;
        input.setAttribute('aria-label', 'Quantity for ' + item.title);
        input.addEventListener('change', () => {
          try { cart.set(item.id, Number(input.value), item.stock); load(); }
          catch (error) { input.value = String(item.quantity); message(error.message, true); }
        });
        label.append(input); body.append(label);
        const remove = node('button', 'Remove');
        remove.type = 'button'; remove.setAttribute('aria-label', 'Remove ' + item.title);
        remove.addEventListener('click', () => { try { cart.remove(item.id); load(); } catch (error) { message(error.message, true); } });
        body.append(remove);
      } else body.append(node('p', 'Quantity: ' + item.quantity));
      row.append(image, body); target.append(row);
    }
    const total = rows.reduce((sum, item) => sum + (item.unavailable ? 0 : item.price * item.quantity), 0);
    document.getElementById('hct-total').textContent = money(total);
    document.getElementById('hct-count').textContent = rows.reduce((sum, item) => sum + item.quantity, 0);
    const valid = rows.length > 0 && rows.every(item => !item.unavailable && item.quantity <= item.stock);
    enable(valid);
    message(!rows.length ? 'Your cart is empty.' : valid ? 'Current prices and availability checked. Items are not reserved.' : 'Some items need attention. Update your cart before continuing.', !valid && rows.length > 0);
  }
  async function load() {
    const call = ++generation;
    enable(false);
    message('Checking current prices and availability…');
    try {
      const items = cart.read();
      const rows = await fetchRows(items);
      if (call !== generation) return;
      currentRows = rows; reviewedCart = fingerprint(items); render(rows);
    } catch (error) { if (call === generation) message(error.message, true); }
  }
  const retry = node('button', 'Refresh availability', 'hct-button secondary');
  retry.type = 'button'; retry.addEventListener('click', () => { if (!submitting) load(); });
  status.after(retry);
  if (proceed) proceed.addEventListener('click', () => { if (ready) window.location.href = '/test-checkout'; });
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || submitting || !form.reportValidity()) return;
    submitting = true; enable(false); message('Rechecking your order…');
    try {
      const items = cart.read();
      if (fingerprint(items) !== reviewedCart) { await load(); message('Your cart changed. Review it again before confirming.', true); return; }
      const rows = await fetchRows(items);
      if (fingerprint(cart.read()) !== reviewedCart) { await load(); message('Your cart changed. Review it again before confirming.', true); return; }
      const changed = rows.some((item, index) => item.unavailable || item.quantity > item.stock || item.price !== currentRows[index].price || item.title !== currentRows[index].title || item.condition !== currentRows[index].condition);
      if (changed) { currentRows = rows; render(rows); message('A listing changed. Review the updated details before confirming again.', true); return; }
      const pickup = document.getElementById('hct-pickup').value;
      if (!['HANU main gate', 'HANU library entrance'].includes(pickup)) throw new Error('Choose a campus pickup location.');
      const receipt = { code: 'DEMO-' + crypto.randomUUID().toUpperCase(), date: new Date().toISOString(), pickup, items: rows.map(item => ({ id: item.id, title: item.title, quantity: item.quantity, price: item.price })) };
      try { sessionStorage.setItem(receiptKey, JSON.stringify(receipt)); }
      catch (_) { throw new Error('The test receipt could not be saved. Enable site storage and try again.'); }
      cart.clear();
      window.location.href = '/test-confirmation';
    } catch (error) { message(error.message, true); enable(currentRows.length > 0 && currentRows.every(item => !item.unavailable && item.quantity <= item.stock)); }
    finally { submitting = false; }
  });
  window.addEventListener('storage', event => { if ((event.key === 'hct-cart-v1' || event.key === null) && !submitting) load(); });
  load();
})();
