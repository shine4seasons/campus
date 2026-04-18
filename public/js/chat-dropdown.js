document.addEventListener('DOMContentLoaded', () => {
    const chatBtn = document.getElementById('chat-dropdown-btn');
    const chatDropdown = document.getElementById('chat-dropdown');
    const chatBody = document.getElementById('chat-dropdown-body');
    const chatTitle = document.getElementById('chat-title');
    const chatBackBtn = document.getElementById('chat-back-btn');
    const chatFooter = document.getElementById('chat-footer');
    const chatDot = document.getElementById('chat-dot');
    
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');

    if (!chatBtn) return;

    let currentConvId = null;
    let socket = null;

    // --- Socket.io ---
    if (window.SOCKET_USER_ID) {
        // Reuse socket if io() is already initialized in notifications.js or index.ejs
        // For simplicity, we assume io() is available globally
        socket = window.socket || (typeof io !== 'undefined' ? io() : null);
        window.socket = socket;
    }

    // Toggle Chat Dropdown
    chatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = chatDropdown.classList.contains('show');
        
        // Mutual exclusion: close notifications
        if (notifDropdown) notifDropdown.classList.remove('show');
        
        if (!isOpen) {
            chatDropdown.classList.add('show');
            showConversationList();
        } else {
            chatDropdown.classList.remove('show');
        }
    });

    // Prevent closing when clicking inside the dropdown
    chatDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Handle outside clicks
    document.addEventListener('click', (e) => {
        if (!chatDropdown.contains(e.target) && !chatBtn.contains(e.target)) {
            chatDropdown.classList.remove('show');
        }
    });

    // Back Button
    chatBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentConvId && socket) {
            socket.emit('leaveConv', currentConvId);
        }
        showConversationList();
    });

    async function showConversationList() {
        currentConvId = null;
        chatTitle.textContent = 'Messages';
        chatBackBtn.style.display = 'none';
        chatFooter.style.display = 'block';
        chatBody.innerHTML = '<div class="notif-empty">Loading conversations...</div>';

        try {
            const res = await fetch('/api/chat');
            const data = await res.json();
            if (data.success) {
                renderConversationList(data.data);
                updateUnreadBadge(data.data);
            } else {
                chatBody.innerHTML = '<div class="notif-empty">Error loading chats.</div>';
            }
        } catch (err) {
            chatBody.innerHTML = '<div class="notif-empty">Could not connect to server.</div>';
        }
    }

    function renderConversationList(convs) {
        const uiMode = (localStorage.getItem('campus_mode') || 'buyer');
        const modeLabel = uiMode === 'seller' ? ' (Seller)' : ' (Buyer)';
        chatTitle.innerHTML = `Messages <span style="font-size:11px; color:var(--t3); font-weight:500;">${modeLabel}</span>`;

        if (!convs || convs.length === 0) {
            chatBody.innerHTML = '<div class="notif-empty">No conversations yet.</div>';
            return;
        }

        // Apply mode filter
        const filtered = convs.filter(c => {
            if (uiMode === 'seller') return c.isSellerConversation;
            return !c.isSellerConversation;
        });

        if (filtered.length === 0) {
            chatBody.innerHTML = `<div class="notif-empty">No ${uiMode} messages.</div>`;
            return;
        }

        chatBody.innerHTML = '';
        filtered.forEach(c => {
            const item = document.createElement('div');
            item.className = `chat-item ${c.unreadCount > 0 ? 'unread' : ''}`;
            const partner = c.partner || {};
            const avatar = partner.avatar ? `<img src="${partner.avatar}" alt="">` : (partner.nickname || partner.name || '?')[0];
            const prodName = c.product ? c.product.title : 'Deleted Product';
            
            item.innerHTML = `
                <div class="chat-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2); color:#fff;">${avatar}</div>
                <div class="chat-info">
                    <div class="chat-top">
                        <span class="chat-name">${partner.nickname || partner.name || 'User'}</span>
                        <span class="chat-time">${formatTime(c.updatedAt)}</span>
                    </div>
                    <div class="chat-prod-name" style="font-size:11px; color:var(--t3); margin: 2px 0;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 3l-7 3.27A2 2 0 0 0 5 8v8a2 2 0 0 0 1 1.73L11 21l7-3.27A2 2 0 0 0 21 16z"/><path d="M12 3v10"/></svg>${prodName}</div>
                    <div class="chat-last">${c.lastMessage || 'No messages yet'}</div>
                </div>
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openConversation(c);
            });
            chatBody.appendChild(item);
        });
    }

    async function openConversation(conv) {
        currentConvId = conv._id;
        const partnerName = conv.partner?.nickname || conv.partner?.name || 'Chat';
        chatTitle.textContent = partnerName;
        chatBackBtn.style.display = 'flex';
        chatFooter.style.display = 'none';
        chatBody.innerHTML = '<div class="notif-empty">Loading messages...</div>';

        if (socket) {
            socket.emit('joinConv', currentConvId);
        }

        try {
            const res = await fetch(`/api/chat/${currentConvId}/messages`);
            const data = await res.json();
            if (data.success) {
                renderMessagesView(data.data);
                // Listen for new messages
                if (socket) {
                    socket.off('message');
                    socket.on('message', (msg) => {
                        if (msg.conversationId === currentConvId) {
                            appendMessage(msg);
                        }
                    });
                }
            }
        } catch (err) {
            chatBody.innerHTML = '<div class="notif-empty">Error loading messages.</div>';
        }
    }

    function renderMessagesView(messages) {
        chatBody.innerHTML = `
            <div class="chat-messages-container" id="chat-msgs-scroll">
                ${messages.map(m => createMessageHTML(m)).join('')}
            </div>
            <div class="chat-input-area">
                <input type="text" class="chat-mini-input" id="chat-mini-input" placeholder="Type a message...">
                <button class="chat-mini-send" id="chat-mini-send">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
            </div>
        `;
        
        const scroll = document.getElementById('chat-msgs-scroll');
        scroll.scrollTop = scroll.scrollHeight;

        const input = document.getElementById('chat-mini-input');
        const sendBtn = document.getElementById('chat-mini-send');

        const sendMessage = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            try {
                const res = await fetch(`/api/chat/${currentConvId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                const data = await res.json();
                // appendMessage(data.data); // Handled by socket
            } catch (err) {
                console.error('Send failed', err);
            }
        };

        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    }

    function createMessageHTML(m) {
        const isMe = String(m.sender._id || m.sender) === window.SOCKET_USER_ID;
        return `
            <div class="chat-msg-row ${isMe ? 'me' : 'them'}">
                <div class="chat-bubble">${m.text}</div>
            </div>
        `;
    }

    function appendMessage(m) {
        const scroll = document.getElementById('chat-msgs-scroll');
        if (!scroll) return;
        const div = document.createElement('div');
        div.innerHTML = createMessageHTML(m);
        scroll.appendChild(div.firstElementChild);
        scroll.scrollTop = scroll.scrollHeight;
    }

    function updateUnreadBadge(convs) {
        const uiMode = (localStorage.getItem('campus_mode') || 'buyer');
        const filtered = convs.filter(c => {
            if (uiMode === 'seller') return c.isSellerConversation;
            return !c.isSellerConversation;
        });
        const totalUnread = filtered.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (totalUnread > 0) {
            chatDot.style.display = 'block';
            chatDot.textContent = totalUnread > 9 ? '9+' : totalUnread;
        } else {
            chatDot.style.display = 'none';
        }
    }

    function formatTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return date.toLocaleDateString();
    }
});
