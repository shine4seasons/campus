function readMessagesConfig() {
  const node = document.getElementById('messages-page-config');
  if (!node) return {};
  try {
    return JSON.parse(node.textContent || '{}');
  } catch (err) {
    window.AppUtils?.reportClientError('Invalid messages page config', err);
    return {};
  }
}

const messagesConfig = readMessagesConfig();
const MY_USER_ID = messagesConfig.myUserId || '';
let currentConvId = messagesConfig.currentConvId || '';
let pollInterval = null;
let autoScroll = true;
const socket = typeof io !== 'undefined' ? io() : null;
let joinedConv = null;
let isInitialFetch = true;
let pollFailures = 0;
let pendingImageFile = null;
let pollSlowed = false;
let initialAutoSelectDone = false;
let allConversations = [];
let activeInboxFilter = 'all';
let inboxSearchTerm = '';
let currentMessages = [];
let messageSearchTerm = '';

function getCookie(name) {
  return document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(name + '='))
    ?.slice(name.length + 1);
}

function getMessageMode() {
  return getCookie('campus_mode') === 'seller' ? 'seller' : 'buyer';
}

function updateMessageModeLabel(mode = getMessageMode()) {
  const modeLabel = document.getElementById('mode-label');
  if (modeLabel) modeLabel.textContent = mode === 'seller' ? 'Seller view' : 'Buyer view';
}

function refreshMessageIcons() {
  if (typeof window.lucide?.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

if (socket) {
  socket.on('connect', () => {});

  socket.on('message', (msg) => {
    try {
      const convId = msg.conversationId ? String(msg.conversationId) : null;
      if (convId && convId === currentConvId) {
        fetchMessages();
      }
      fetchInbox();
    } catch (e) {
      window.AppUtils?.reportClientError('socket message handler error', e);
    }
  });
}

const COND_LABEL = { new: 'New', 'like-new': 'Like new', good: 'Good', fair: 'Fair' };

function renderProductBanner(convId, productData) {
  const banner = document.getElementById('product-banner');
  if (!banner || !productData) return;
  try {
    localStorage.setItem('conv_product_' + convId, JSON.stringify(productData));
  } catch {}

  const priceStr = window.AppUtils.formatVND(productData.price);
  const condLabel = COND_LABEL[productData.condition] || productData.condition || '';
  const safeTitle = String(productData.title || '');
  const safeImage = String(productData.image || '').trim();
  clearNode(banner);
  if (safeImage) {
    const img = document.createElement('img');
    img.className = 'product-banner-img';
    img.src = safeImage;
    img.alt = safeTitle;
    banner.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'product-banner-img-placeholder';
    placeholder.textContent = 'ðŸ“¦';
    banner.appendChild(placeholder);
  }

  const info = document.createElement('div');
  info.className = 'product-banner-info';
  const label = document.createElement('div');
  label.className = 'product-banner-label';
  label.textContent = 'Discussing product';
  info.appendChild(label);
  const title = document.createElement('div');
  title.className = 'product-banner-title';
  title.textContent = safeTitle;
  info.appendChild(title);
  const meta = document.createElement('div');
  meta.className = 'product-banner-meta';
  const price = document.createElement('span');
  price.className = 'product-banner-price';
  price.textContent = priceStr;
  meta.appendChild(price);
  if (condLabel) {
    const cond = document.createElement('span');
    cond.className = 'product-banner-cond';
    cond.textContent = condLabel;
    meta.appendChild(cond);
  }
  info.appendChild(meta);
  banner.appendChild(info);
  banner.style.display = 'flex';
}

function tryLoadBannerFromStorage(convId) {
  try {
    const raw = localStorage.getItem('conv_product_' + convId);
    if (raw) renderProductBanner(convId, JSON.parse(raw));
    else document.getElementById('product-banner').style.display = 'none';
  } catch {}
}

(function parsePdParam() {
  const params = new URLSearchParams(window.location.search);
  const pdRaw = params.get('pd');
  if (pdRaw && currentConvId) {
    try {
      const productData = JSON.parse(decodeURIComponent(pdRaw));
      renderProductBanner(currentConvId, productData);
    } catch {}
    const clean = new URL(window.location.href);
    clean.searchParams.delete('pd');
    window.history.replaceState(null, '', clean.toString());
  }
})();

function formatDateLabel(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const nowY = now.getFullYear();
  const nowM = now.getMonth();
  const nowD = now.getDate();
  const dY = d.getFullYear();
  const dM = d.getMonth();
  const dD = d.getDate();

  if (dY === nowY && dM === nowM && dD === nowD) return 'Today';

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (dY === yest.getFullYear() && dM === yest.getMonth() && dD === yest.getDate()) return 'Yesterday';

  if (dY === nowY && dM === nowM) {
    return d.toLocaleDateString('en-US', { weekday: 'long' }) + ' ' + dD;
  }

  if (dY === nowY) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function dayKey(dateStr) {
  const d = new Date(dateStr);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}

function parseOrderMessage(text) {
  const raw = String(text || '');
  if (!raw.startsWith('[ORDER]')) return null;

  const lines = raw
    .replace(/^\[ORDER\]\s*/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const parsed = {
    requester: '',
    product: '',
    quantity: '',
    total: '',
    delivery: '',
    payment: '',
    note: '',
  };

  const firstLine = lines[0].replace(/^\*+|\*+$/g, '');
  const requesterMatch = firstLine.match(/new order from\s+(.+)/i);
  parsed.requester = requesterMatch ? requesterMatch[1].replace(/\*+$/g, '').trim() : firstLine.trim();

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'product') parsed.product = value;
    else if (key === 'quantity') parsed.quantity = value;
    else if (key === 'total') parsed.total = value;
    else if (key === 'delivery to' || key === 'method') parsed.delivery = value;
    else if (key === 'payment') parsed.payment = value;
    else if (key === 'note') parsed.note = value;
  }

  return parsed;
}

function createOrderField(label, value) {
  const field = document.createElement('div');
  field.className = 'message-order-field';

  const fieldLabel = document.createElement('div');
  fieldLabel.className = 'message-order-field-label';
  fieldLabel.textContent = label;

  const fieldValue = document.createElement('div');
  fieldValue.className = 'message-order-field-value';
  fieldValue.textContent = value || 'â€”';

  field.appendChild(fieldLabel);
  field.appendChild(fieldValue);
  return field;
}

function renderOrderCard(m, isMe) {
  const parsed = parseOrderMessage(m.text);
  if (!parsed) return null;

  const card = document.createElement('div');
  card.className = `message-order-card ${isMe ? 'me' : 'other'}`.trim();

  const head = document.createElement('div');
  head.className = 'message-order-head';

  const headCopy = document.createElement('div');
  headCopy.className = 'message-order-head-copy';

  const badge = document.createElement('div');
  badge.className = 'message-order-badge';
  badge.textContent = 'Order update';
  headCopy.appendChild(badge);

  const title = document.createElement('div');
  title.className = 'message-order-title';
  title.textContent = parsed.requester ? `New order from ${parsed.requester}` : 'New order';
  headCopy.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'message-order-subtitle';
  subtitle.textContent = 'Structured order summary';
  headCopy.appendChild(subtitle);

  head.appendChild(headCopy);
  card.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'message-order-grid';
  grid.appendChild(createOrderField('Product', parsed.product));
  grid.appendChild(createOrderField('Quantity', parsed.quantity));
  grid.appendChild(createOrderField('Total', parsed.total));
  grid.appendChild(createOrderField('Delivery', parsed.delivery));
  grid.appendChild(createOrderField('Payment', parsed.payment));
  card.appendChild(grid);

  if (parsed.note) {
    const note = document.createElement('div');
    note.className = 'message-order-note';

    const noteLabel = document.createElement('div');
    noteLabel.className = 'message-order-field-label';
    noteLabel.textContent = 'Note';

    const noteValue = document.createElement('div');
    noteValue.className = 'message-order-note-value';
    noteValue.textContent = parsed.note;

    note.appendChild(noteLabel);
    note.appendChild(noteValue);
    card.appendChild(note);
  }

  return card;
}

async function fetchInbox() {
  try {
    const res = await fetch('/api/chat', { credentials: 'include' });
    const json = await res.json();
    if (json.success) {
      allConversations = Array.isArray(json.data) ? json.data : [];
      renderInbox(allConversations);
    }
  } catch (err) {
    window.AppUtils?.reportClientError('Error fetching inbox:', err);
  }
}

function esc(s) {
  if (window.AppUtils && typeof window.AppUtils.escapeHtml === 'function') {
    return window.AppUtils.escapeHtml(s);
  }
  return String(s == null ? '' : s);
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function avatarNode(name, avatarUrl, size = 48, fontSize = 18) {
  const safeName = String(name || 'User');
  const safeAvatarUrl = String(avatarUrl || '').trim();
  if (safeAvatarUrl) {
    const img = document.createElement('img');
    img.src = safeAvatarUrl;
    img.alt = safeName;
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    return img;
  }
  const span = document.createElement('span');
  span.style.fontSize = `${fontSize}px`;
  span.style.fontWeight = '700';
  span.textContent = safeName.charAt(0).toUpperCase() || '?';
  return span;
}

function createSendSpinner() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.style.animation = 'spin 0.8s linear infinite';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83');
  svg.appendChild(path);
  return svg;
}

function autoResizeInput(input) {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
}

document.getElementById('conv-list').addEventListener('click', (e) => {
  const item = e.target.closest('.conv-item');
  if (!item) return;
  const convId = item.dataset.convId;
  const convName = item.dataset.convName || 'User';
  const convAvatar = item.dataset.convAvatar || '';
  const partnerId = item.dataset.partnerId || '';
  if (convId) selectConversation(convId, convName, convAvatar, partnerId);
});

window.selectConversation = async function (convId, partnerName, partnerAvatar = '', partnerId = '') {
  currentConvId = convId;
  messageSearchTerm = '';
  const messageSearch = document.getElementById('message-search');
  if (messageSearch) messageSearch.value = '';

  if (socket) {
    if (joinedConv && joinedConv !== convId) socket.emit('leaveConv', joinedConv);
    socket.emit('joinConv', convId);
    joinedConv = convId;
  }

  tryLoadBannerFromStorage(convId);
  document.getElementById('chat-empty').style.display = 'none';
  document.getElementById('chat-header').classList.add('active');
  document.getElementById('chat-messages').style.display = 'flex';
  document.getElementById('chat-input-area').classList.add('active');
  const profileHref = partnerId ? `/user/${partnerId}` : '#';
  const headerName = document.getElementById('header-name');
  headerName.textContent = partnerName;
  headerName.href = profileHref;
  headerName.toggleAttribute('aria-disabled', !partnerId);
  const profileLink = document.getElementById('chat-profile-link');
  if (profileLink) {
    profileLink.href = profileHref;
    profileLink.classList.toggle('disabled', !partnerId);
    profileLink.toggleAttribute('aria-disabled', !partnerId);
  }
  document.getElementById('inbox-panel')?.classList.add('is-hidden');
  document.getElementById('conversation-panel')?.classList.add('is-open');

  const headerAvatar = document.getElementById('header-avatar');
  clearNode(headerAvatar);
  headerAvatar.href = profileHref;
  headerAvatar.toggleAttribute('aria-disabled', !partnerId);
  headerAvatar.appendChild(avatarNode(partnerName, partnerAvatar, 48, 16));

  const input = document.getElementById('chat-input');
  input.focus();
  autoResizeInput(input);

  autoScroll = true;
  isInitialFetch = true;
  await fetchMessages();
  fetchInbox();

  window.history.replaceState(null, '', '/messages?id=' + convId);
};

async function fetchMessages() {
  if (!currentConvId) return;
  const skel = document.getElementById('chat-skeleton');
  const cont = document.getElementById('chat-messages');
  if (isInitialFetch && skel && cont) {
    skel.style.display = 'flex';
    cont.style.display = 'none';
  }
  try {
    const res = await fetch('/api/chat/' + currentConvId + '/messages', { credentials: 'include' });
    const json = await res.json();
    if (json.success) {
      currentMessages = Array.isArray(json.data) ? json.data : [];
      renderMessages(currentMessages);
    }
    if (pollFailures > 0) {
      pollFailures = 0;
      if (pollSlowed) restartFastPolling();
    }
  } catch (err) {
    window.AppUtils?.reportClientError('Error fetching messages:', err);
    pollFailures++;
    if (pollFailures >= 3 && pollInterval && !pollSlowed) {
      clearInterval(pollInterval);
      pollInterval = setInterval(pollTick, 10000);
      pollSlowed = true;
      showChatToast('Connection unstable - slowing refresh', 'error');
    }
  } finally {
    if (isInitialFetch && skel && cont) {
      skel.style.display = 'none';
      cont.style.display = 'flex';
      isInitialFetch = false;
      scrollMessagesToBottom();
    }
  }
}

function showChatToast(message, type = 'error') {
  let toast = document.getElementById('chat-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'chat-toast';
    toast.className = 'chat-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

const imageInput = document.getElementById('chat-image-input');
const previewBox = document.getElementById('image-preview');
const previewImg = document.getElementById('image-preview-img');
const previewRemove = document.getElementById('image-preview-remove');

imageInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showChatToast('Please select an image file');
    imageInput.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showChatToast('Image must be under 5MB');
    imageInput.value = '';
    return;
  }
  pendingImageFile = file;
  previewImg.src = URL.createObjectURL(file);
  previewBox.style.display = 'flex';
});

previewRemove.addEventListener('click', () => {
  pendingImageFile = null;
  previewBox.style.display = 'none';
  imageInput.value = '';
  previewImg.src = '';
});

async function uploadChatImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/upload/chat', { method: 'POST', body: fd, credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.url) {
    throw new Error(json.message || 'Upload failed');
  }
  return json.url;
}

window.sendMessage = async function () {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  const btn = document.getElementById('chat-send-btn');
  const overlay = document.getElementById('image-preview-overlay');

  if (!currentConvId) return;
  if (!text && !pendingImageFile) return;

  input.disabled = true;
  btn.disabled = true;
  const originalChildren = Array.from(btn.childNodes);
  btn.replaceChildren(createSendSpinner());

  try {
    let imageUrl = null;
    if (pendingImageFile) {
      if (overlay) overlay.style.display = 'flex';
      imageUrl = await uploadChatImage(pendingImageFile);
    }

    const res = await fetch('/api/chat/' + currentConvId + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageUrl }),
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      input.value = '';
      autoResizeInput(input);
      pendingImageFile = null;
      previewBox.style.display = 'none';
      imageInput.value = '';
      previewImg.src = '';
      autoScroll = true;
      await fetchMessages();
      fetchInbox();
    } else {
      showChatToast(json.message || 'Failed to send message');
    }
  } catch (err) {
    window.AppUtils?.reportClientError('Error sending message:', err);
    showChatToast(err.message || 'Network error - message not sent');
  } finally {
    if (overlay) overlay.style.display = 'none';
    btn.replaceChildren(...originalChildren);
    input.disabled = false;
    btn.disabled = false;
    input.focus();
  }
};

document.getElementById('chat-send-btn').addEventListener('click', () => {
  sendMessage();
});

document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById('chat-input').addEventListener('input', (e) => {
  autoResizeInput(e.target);
});

document.getElementById('chat-attach-btn').addEventListener('click', () => {
  document.getElementById('chat-image-input').click();
});

document.getElementById('chat-messages').addEventListener('click', (e) => {
  const image = e.target.closest('.message-image');
  if (image && image.dataset.imageUrl) {
    window.open(image.dataset.imageUrl, '_blank');
  }
});

document.getElementById('conversation-search')?.addEventListener('input', (e) => {
  inboxSearchTerm = e.target.value.trim().toLowerCase();
  renderInbox(allConversations);
});

document.getElementById('conversation-filters')?.addEventListener('click', (e) => {
  const button = e.target.closest('[data-filter]');
  if (!button) return;
  activeInboxFilter = button.dataset.filter || 'all';
  document.querySelectorAll('.messages-filter').forEach((filterButton) => {
    filterButton.classList.toggle('active', filterButton === button);
  });
  renderInbox(allConversations);
});

document.getElementById('new-message-btn')?.addEventListener('click', () => {
  const search = document.getElementById('conversation-search');
  search?.focus();
  showChatToast('Search an existing conversation or start a chat from a product page.', 'info');
});

document.getElementById('chat-back-btn')?.addEventListener('click', () => {
  document.getElementById('inbox-panel')?.classList.remove('is-hidden');
  document.getElementById('conversation-panel')?.classList.remove('is-open');
});

document.getElementById('chat-search-toggle')?.addEventListener('click', () => {
  const panel = document.getElementById('chat-search-panel');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) document.getElementById('message-search')?.focus();
});

document.getElementById('message-search')?.addEventListener('input', (e) => {
  messageSearchTerm = e.target.value.trim().toLowerCase();
  renderMessages(currentMessages);
});

document.getElementById('chat-emoji-btn')?.addEventListener('click', () => {
  const input = document.getElementById('chat-input');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}🙂${input.value.slice(end)}`;
  input.selectionStart = input.selectionEnd = start + 2;
  input.focus();
  autoResizeInput(input);
});

document.getElementById('chat-more-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('chat-more-menu');
  const btn = document.getElementById('chat-more-btn');
  if (!menu || !btn) return;
  menu.hidden = !menu.hidden;
  btn.setAttribute('aria-expanded', String(!menu.hidden));
});

document.getElementById('chat-more-menu')?.addEventListener('click', (e) => {
  const action = e.target.closest('[data-chat-action]')?.dataset.chatAction;
  if (!action) return;
  document.getElementById('chat-more-menu').hidden = true;
  document.getElementById('chat-more-btn')?.setAttribute('aria-expanded', 'false');
  if (action === 'refresh') {
    autoScroll = true;
    fetchMessages();
    fetchInbox();
  }
  if (action === 'scroll-bottom') {
    scrollMessagesToBottom();
  }
});

document.addEventListener('click', (e) => {
  const menu = document.getElementById('chat-more-menu');
  const btn = document.getElementById('chat-more-btn');
  if (!menu || !btn || menu.hidden) return;
  if (!menu.contains(e.target) && !btn.contains(e.target)) {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }
});

function pollTick() {
  fetchInbox();
  if (currentConvId) {
    const container = document.getElementById('chat-messages');
    if (container && container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
      autoScroll = true;
    }
    fetchMessages();
  }
}

function startPolling(intervalMs) {
  stopPolling();
  pollInterval = setInterval(pollTick, intervalMs || 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function restartFastPolling() {
  pollSlowed = false;
  if (!socket || !socket.connected) startPolling(5000);
}

(async function initialLoad() {
  await fetchInbox();
  if (currentConvId && !initialAutoSelectDone) {
    initialAutoSelectDone = true;
    const convItem = document.querySelector(`.conv-item[data-conv-id="${currentConvId}"]`);
    if (convItem) {
      convItem.click();
    }
  }
})();

if (socket) {
  socket.on('connect', () => {
    stopPolling();
    pollSlowed = false;
    pollFailures = 0;
  });
  socket.on('disconnect', () => {
    startPolling(5000);
  });
  setTimeout(() => {
    if (!socket.connected) startPolling(5000);
  }, 2000);
} else {
  startPolling(3000);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else if (!socket || !socket.connected) {
    startPolling(5000);
  }
});

refreshMessageIcons();
document.addEventListener('DOMContentLoaded', refreshMessageIcons, { once: true });
setTimeout(refreshMessageIcons, 50);

function formatConversationTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOrderConversation(c) {
  const last = String(c.lastMessage || '');
  return Boolean(c.order || c.orderId || /^\[ORDER\]/i.test(last) || /^new order/i.test(last));
}

function isSupportConversation(c) {
  const haystack = [
    c.type,
    c.category,
    c.topic,
    c.lastMessage,
    c.product && c.product.title,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('support') || haystack.includes('help') || haystack.includes('issue');
}

function renderInbox(convs) {
  const list = document.getElementById('conv-list');
  const uiMode = getMessageMode();
  updateMessageModeLabel(uiMode);
  clearNode(list);

  if (!Array.isArray(convs) || convs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'conv-empty';
    empty.textContent = 'No messages yet.';
    list.appendChild(empty);
    return;
  }

  const filtered = convs.filter((c) => {
    if (uiMode === 'seller') return c.isSellerConversation;
    return !c.isSellerConversation;
  }).filter((c) => {
    if (activeInboxFilter === 'unread') return Number(c.unreadCount || 0) > 0;
    if (activeInboxFilter === 'orders') return isOrderConversation(c);
    if (activeInboxFilter === 'support') return isSupportConversation(c);
    return true;
  }).filter((c) => {
    if (!inboxSearchTerm) return true;
    const partner = c.partner || (c.participants ? c.participants.find((p) => String(p._id) !== MY_USER_ID) : null) || {};
    const name = partner.nickname || partner.name || '';
    const haystack = [name, c.product && c.product.title, c.lastMessage].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(inboxSearchTerm);
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'conv-empty';
    empty.textContent = inboxSearchTerm ? 'No conversations match your search.' : `No ${uiMode} messages for this filter.`;
    list.appendChild(empty);
    return;
  }

  filtered.forEach((c) => {
    const partner = c.partner || (c.participants ? c.participants.find((p) => String(p._id) !== MY_USER_ID) : null) || { name: 'Unknown', nickname: '' };
    const name = partner.nickname || partner.name || 'Unknown';
    const activeClass = c._id === currentConvId ? 'active' : '';
    const prodName = c.product ? c.product.title : 'Deleted Product';
    const lastMessageText = String(c.lastMessage || '').trim();
    const isOrderUpdate = isOrderConversation(c);
    const unreadCount = Number(c.unreadCount || 0);

    const item = document.createElement('div');
    item.className = `conv-item ${activeClass} ${unreadCount > 0 ? 'unread' : ''}`.trim();
    item.dataset.convId = String(c._id || '');
    item.dataset.convName = String(name);
    item.dataset.convAvatar = String(partner.avatar || '');
    item.dataset.partnerId = String(partner._id || '');
    item.dataset.isSellerConversation = c.isSellerConversation ? 'true' : 'false';

    const avWrap = document.createElement('div');
    avWrap.className = 'conv-avatar-wrap';
    const av = document.createElement('div');
    av.className = 'conv-avatar';
    av.appendChild(avatarNode(name, partner.avatar, 48, 18));
    avWrap.appendChild(av);
    const presence = document.createElement('span');
    presence.className = 'conv-presence';
    avWrap.appendChild(presence);
    item.appendChild(avWrap);

    const info = document.createElement('div');
    info.className = 'conv-info';

    const top = document.createElement('div');
    top.className = 'conv-top';

    const n = document.createElement('div');
    n.className = 'conv-name';
    n.textContent = name;
    top.appendChild(n);

    const time = document.createElement('span');
    time.className = 'conv-time';
    time.textContent = formatConversationTime(c.lastMessageAt || c.updatedAt || c.createdAt);
    top.appendChild(time);

    if (partner._id) {
      const profile = document.createElement('a');
      profile.className = 'conv-profile-link';
      profile.href = `/user/${partner._id}`;
      profile.title = 'View profile';
      profile.setAttribute('aria-label', `View ${name}'s profile`);
      profile.addEventListener('click', (event) => event.stopPropagation());
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'user-round');
      profile.appendChild(icon);
      top.appendChild(profile);
    }

    info.appendChild(top);

    const product = document.createElement('div');
    product.className = 'conv-product';
    product.textContent = prodName;
    info.appendChild(product);

    const role = document.createElement('div');
    role.className = `conv-role-chip ${c.isSellerConversation ? 'seller' : 'buyer'}`;
    role.textContent = c.isSellerConversation ? 'Seller chat' : 'Buyer chat';
    info.appendChild(role);

    const last = document.createElement('div');
    last.className = 'conv-lastmsg';
    last.textContent = isOrderUpdate ? `Order update - ${lastMessageText.replace(/^\[ORDER\]\s*/i, '').replace(/^new order\s*-\s*/i, '')}` : (lastMessageText || '...');
    if (isOrderUpdate) last.dataset.kind = 'order';

    const previewRow = document.createElement('div');
    previewRow.className = 'conv-preview-row';
    previewRow.appendChild(last);
    if (unreadCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'unread-badge';
      badge.textContent = String(unreadCount);
      previewRow.appendChild(badge);
    }
    info.appendChild(previewRow);

    item.appendChild(info);
    list.appendChild(item);
  });
  refreshMessageIcons();
}

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  const shouldScroll = autoScroll || (container.scrollTop + container.clientHeight >= container.scrollHeight - 50);
  clearNode(container);

  let lastDayKey = null;
  const visibleMessages = (Array.isArray(messages) ? messages : []).filter((m) => {
    if (!messageSearchTerm) return true;
    return String(m.text || '').toLowerCase().includes(messageSearchTerm);
  });

  if (!visibleMessages.length && messageSearchTerm) {
    const empty = document.createElement('div');
    empty.className = 'conv-empty';
    empty.textContent = 'No messages match your search.';
    container.appendChild(empty);
  }

  visibleMessages.forEach((m) => {
    const senderId = m && m.sender && m.sender._id ? String(m.sender._id) : String(m.sender || '');
    const isMe = senderId === MY_USER_ID;
    const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const msgDay = dayKey(m.createdAt);

    if (msgDay !== lastDayKey) {
      lastDayKey = msgDay;
      const label = formatDateLabel(m.createdAt);
      const divider = document.createElement('div');
      divider.className = 'date-divider';
      const labelEl = document.createElement('span');
      labelEl.className = 'date-divider-label';
      labelEl.textContent = label;
      divider.appendChild(labelEl);
      container.appendChild(divider);
    }

    const row = document.createElement('div');
    row.className = `message-row ${isMe ? 'me' : 'other'}`;

    if (m.imageUrl) {
      const img = document.createElement('img');
      img.className = 'message-image';
      img.src = String(m.imageUrl);
      img.alt = 'Image';
      img.dataset.imageUrl = String(m.imageUrl);
      row.appendChild(img);
    }

    if (m.text) {
      const orderCard = renderOrderCard(m, isMe);
      if (orderCard) {
        row.classList.add('message-row-order');
        row.appendChild(orderCard);
      } else {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = String(m.text);
        row.appendChild(bubble);
      }
    }

    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = time;
    row.appendChild(timeEl);

    container.appendChild(row);
  });

  if (shouldScroll) {
    autoScroll = false;
  }
}

function scrollMessagesToBottom() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const run = () => {
    container.scrollTop = container.scrollHeight;
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
  } else {
    setTimeout(run, 0);
  }
}


