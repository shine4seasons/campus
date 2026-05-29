const messagesConfig = window.MESSAGES_PAGE_CONFIG || {};
const MY_USER_ID = messagesConfig.myUserId || '';
const USER_ROLE = messagesConfig.userRole || 'buyer';
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
    placeholder.textContent = '📦';
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
  fieldValue.textContent = value || '—';

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
    if (json.success) renderInbox(json.data);
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

function renderAvatarMarkup(name, avatarUrl, size = 48, fontSize = 18) {
  const safeName = esc(name || 'User');
  const safeAvatarUrl = String(avatarUrl || '').trim();
  if (safeAvatarUrl) {
    return `<img src="${esc(safeAvatarUrl)}" alt="${safeName}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;">`;
  }
  const initial = safeName.charAt(0).toUpperCase() || '?';
  return `<span style="font-size:${fontSize}px;font-weight:700;">${initial}</span>`;
}

function renderInbox(convs) {
  const list = document.getElementById('conv-list');
  const uiMode = USER_ROLE === 'seller' ? 'seller' : 'buyer';
  document.getElementById('mode-label').textContent = uiMode === 'seller' ? 'Seller view' : 'Buyer view';
  clearNode(list);

  if (convs.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '20px';
    empty.style.textAlign = 'center';
    empty.style.color = '#8890B0';
    empty.style.fontSize = '14px';
    empty.textContent = 'No messages yet.';
    list.appendChild(empty);
    return;
  }

  const filtered = convs.filter((c) => {
    if (uiMode === 'seller') return c.isSellerConversation;
    return !c.isSellerConversation;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '20px';
    empty.style.textAlign = 'center';
    empty.style.color = '#8890B0';
    empty.style.fontSize = '14px';
    empty.textContent = 'No messages for current mode.';
    list.appendChild(empty);
    return;
  }

  filtered.forEach((c) => {
    const partner = c.partner || (c.participants ? c.participants.find((p) => String(p._id) !== MY_USER_ID) : null) || { name: 'Unknown', nickname: '' };
    const name = partner.nickname || partner.name || 'Unknown';
    const activeClass = c._id === currentConvId ? 'active' : '';
    const prodName = c.product ? c.product.title : 'Deleted Product';
    const item = document.createElement('div');
    item.className = `conv-item ${activeClass}`.trim();
    item.dataset.convId = String(c._id || '');
    item.dataset.convName = String(name);
    item.dataset.convAvatar = String(partner.avatar || '');

    const av = document.createElement('div');
    av.className = 'conv-avatar';
    av.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
    av.appendChild(avatarNode(name, partner.avatar, 48, 18));
    item.appendChild(av);

    const info = document.createElement('div');
    info.className = 'conv-info';
    const top = document.createElement('div');
    top.style.display = 'flex';
    top.style.alignItems = 'center';
    const n = document.createElement('div');
    n.className = 'conv-name';
    n.textContent = name;
    top.appendChild(n);
    if (c.unreadCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'unread-badge';
      badge.textContent = String(c.unreadCount);
      top.appendChild(badge);
    }
    info.appendChild(top);
    const product = document.createElement('div');
    product.className = 'conv-product';
    product.textContent = `📦 ${prodName}`;
    info.appendChild(product);
    const last = document.createElement('div');
    last.className = 'conv-lastmsg';
    last.textContent = c.lastMessage || '...';
    info.appendChild(last);
    item.appendChild(info);
    list.appendChild(item);
  });
}

document.getElementById('conv-list').addEventListener('click', (e) => {
  const item = e.target.closest('.conv-item');
  if (!item) return;
  const convId = item.dataset.convId;
  const convName = item.dataset.convName || 'User';
  const convAvatar = item.dataset.convAvatar || '';
  if (convId) selectConversation(convId, convName, convAvatar);
});

window.selectConversation = async function (convId, partnerName, partnerAvatar = '') {
  currentConvId = convId;
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
  document.getElementById('header-name').textContent = partnerName;
  const headerAvatar = document.getElementById('header-avatar');
  clearNode(headerAvatar);
  headerAvatar.appendChild(avatarNode(partnerName, partnerAvatar, 40, 16));
  document.getElementById('chat-input').focus();

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
    if (json.success) renderMessages(json.data);
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

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  const shouldScroll = autoScroll || (container.scrollTop + container.clientHeight >= container.scrollHeight - 50);
  clearNode(container);
  let lastDayKey = null;
  messages.forEach((m) => {
    const isMe = String(m.sender._id) === MY_USER_ID;
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
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = String(m.text);
      row.appendChild(bubble);
    }
    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = time;
    row.appendChild(timeEl);
    container.appendChild(row);
  });

  if (shouldScroll) {
    container.scrollTop = container.scrollHeight;
    autoScroll = false;
  }
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
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

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
    btn.innerHTML = originalHTML;
    input.disabled = false;
    btn.disabled = false;
    input.focus();
  }
};

document.getElementById('chat-send-btn').addEventListener('click', () => {
  sendMessage();
});

document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
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
    if (convItem) convItem.click();
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

function renderInbox(convs) {
  const list = document.getElementById('conv-list');
  const uiMode = USER_ROLE === 'seller' ? 'seller' : 'buyer';
  const modeLabel = document.getElementById('mode-label');
  if (modeLabel) modeLabel.textContent = uiMode === 'seller' ? 'Seller view' : 'Buyer view';
  clearNode(list);

  if (convs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'conv-empty';
    empty.textContent = 'No messages yet.';
    list.appendChild(empty);
    return;
  }

  const filtered = convs.filter((c) => {
    if (uiMode === 'seller') return c.isSellerConversation;
    return !c.isSellerConversation;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'conv-empty';
    empty.textContent = 'No messages for current mode.';
    list.appendChild(empty);
    return;
  }

  filtered.forEach((c) => {
    const partner = c.partner || (c.participants ? c.participants.find((p) => String(p._id) !== MY_USER_ID) : null) || { name: 'Unknown', nickname: '' };
    const name = partner.nickname || partner.name || 'Unknown';
    const activeClass = c._id === currentConvId ? 'active' : '';
    const prodName = c.product ? c.product.title : 'Deleted Product';
    const lastMessageText = String(c.lastMessage || '').trim();
    const isOrderUpdate = /^new order/i.test(lastMessageText);

    const item = document.createElement('div');
    item.className = `conv-item ${activeClass}`.trim();
    item.dataset.convId = String(c._id || '');
    item.dataset.convName = String(name);
    item.dataset.convAvatar = String(partner.avatar || '');

    const av = document.createElement('div');
    av.className = 'conv-avatar';
    av.appendChild(avatarNode(name, partner.avatar, 48, 18));
    item.appendChild(av);

    const info = document.createElement('div');
    info.className = 'conv-info';

    const top = document.createElement('div');
    top.className = 'conv-top';

    const n = document.createElement('div');
    n.className = 'conv-name';
    n.textContent = name;
    top.appendChild(n);

    if (c.unreadCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'unread-badge';
      badge.textContent = String(c.unreadCount);
      top.appendChild(badge);
    }

    info.appendChild(top);

    const product = document.createElement('div');
    product.className = 'conv-product';
    product.textContent = prodName;
    info.appendChild(product);

    const last = document.createElement('div');
    last.className = 'conv-lastmsg';
    last.textContent = isOrderUpdate ? `Order update · ${lastMessageText.replace(/^new order\s*-\s*/i, '')}` : (lastMessageText || '...');
    if (isOrderUpdate) last.dataset.kind = 'order';
    info.appendChild(last);

    item.appendChild(info);
    list.appendChild(item);
  });
}

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  const shouldScroll = autoScroll || (container.scrollTop + container.clientHeight >= container.scrollHeight - 50);
  clearNode(container);

  let lastDayKey = null;

  messages.forEach((m) => {
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
    container.scrollTop = container.scrollHeight;
    autoScroll = false;
  }
}
