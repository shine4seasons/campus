(function (root) {
  'use strict';
  const KEY = 'hct-cart-v1';
  function normalize(items) {
    if (!Array.isArray(items)) return [];
    const result = new Map();
    for (const item of items.slice(0, 50)) {
      if (!item || !/^[a-f0-9]{24}$/i.test(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
      const id = item.id.toLowerCase();
      result.set(id, { id, quantity: Math.min(item.quantity, 99) });
    }
    return [...result.values()];
  }
  function createStore(storage, onChange = function () {}) {
    function read() {
      try { return normalize(JSON.parse(storage.getItem(KEY) || '[]')); }
      catch (_) { return []; }
    }
    function write(items) {
      const clean = normalize(items);
      try { storage.setItem(KEY, JSON.stringify(clean)); }
      catch (_) { throw new Error('Your browser could not save the cart. Enable site storage and try again.'); }
      onChange(clean);
      return clean;
    }
    return {
      read,
      add(id, maximum = 99) {
        if (!/^[a-f0-9]{24}$/i.test(id) || !Number.isInteger(maximum) || maximum < 1) throw new Error('This item is unavailable.');
        id = id.toLowerCase();
        const items = read();
        const item = items.find(entry => entry.id === id);
        if (!item && items.length >= 50) throw new Error('Your cart can hold up to 50 different items.');
        const quantity = (item ? item.quantity : 0) + 1;
        if (quantity > Math.min(maximum, 99)) throw new Error('You have reached the available quantity.');
        if (item) item.quantity = quantity;
        else items.push({ id, quantity });
        return write(items);
      },
      set(id, quantity, maximum = 99) {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(maximum, 99)) throw new Error('Enter a quantity within the available stock.');
        return write(read().map(item => item.id === id ? { id, quantity } : item));
      },
      remove(id) { return write(read().filter(item => item.id !== id)); },
      clear() { return write([]); }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createStore, normalize };
  if (!root || !root.document) return;
  // Access localStorage lazily: some browsers block its getter in private mode.
  const storage = { getItem: key => root.localStorage.getItem(key), setItem: (key, value) => root.localStorage.setItem(key, value) };
  root.HCTCart = createStore(storage, () => root.dispatchEvent(new Event('hct:cart')));
  function updateBadge() {
    const count = root.HCTCart.read().reduce((sum, item) => sum + item.quantity, 0);
    root.document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = String(count); });
  }
  root.addEventListener('storage', event => { if (event.key === KEY || event.key === null) updateBadge(); });
  root.addEventListener('hct:cart', updateBadge);
  root.document.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-add]');
    if (!button) return;
    try {
      if (button.dataset.cartNext && root.HCTCart.read().some(item => item.id === button.dataset.cartAdd.toLowerCase())) {
        root.location.href = '/test-checkout'; return;
      }
      root.HCTCart.add(button.dataset.cartAdd, Number(button.dataset.cartStock));
      if (button.dataset.cartNext) { root.location.href = '/test-checkout'; return; }
      const message = root.document.getElementById('hct-product-cart-status');
      if (message) message.textContent = 'Added to cart. Open your cart to review your items.';
      if (typeof root.showToast === 'function') root.showToast('Added to cart', 'ok');
    } catch (error) {
      const message = root.document.getElementById('hct-product-cart-status');
      if (message) message.textContent = error.message;
      if (typeof root.showToast === 'function') root.showToast(error.message, 'err');
    }
  });
  updateBadge();
})(typeof window !== 'undefined' ? window : null);
