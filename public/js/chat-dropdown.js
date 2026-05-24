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

    function getCookie(name) {
        return document.cookie
            .split(';')
            .map((entry) => entry.trim())
            .find((entry) => entry.startsWith(name + '='))
            ?.slice(name.length + 1);
    }

    function getMode() {
        return getCookie('campus_mode') === 'seller' ? 'seller' : 'buyer';
    }

    function clearNode(node) {
        if (!node) return;
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function setEmpty(container, text) {
        clearNode(container);
        const div = document.createElement('div');
        div.className = 'notif-empty';
        div.textContent = text;
        container.appendChild(div);
    }

    function avatarNode(name, avatarUrl) {
        const safeName = String(name || 'User');
        const safeAvatarUrl = String(avatarUrl || '').trim();
        if (safeAvatarUrl) {
            const img = document.createElement('img');
            img.src = safeAvatarUrl;
            img.alt = safeName;
            return img;
        }
        return document.createTextNode((safeName[0] || '?').toUpperCase());
    }

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
        clearNode(chatTitle);
        chatTitle.appendChild(document.createTextNode('Messages'));
        chatBackBtn.style.display = 'none';
        chatFooter.style.display = 'block';
        setEmpty(chatBody, 'Loading conversations...');

        try {
            const res = await fetch('/api/chat');
            const data = await res.json();
            if (data.success) {
                renderConversationList(data.data);
                updateUnreadBadge(data.data);
            } else {
                setEmpty(chatBody, 'Error loading chats.');
            }
        } catch (err) {
            setEmpty(chatBody, 'Could not connect to server.');
        }
    }

    function renderConversationList(convs) {
        const uiMode = getMode();
        const modeLabel = uiMode === 'seller' ? ' (Seller)' : ' (Buyer)';
        clearNode(chatTitle);
        chatTitle.appendChild(document.createTextNode('Messages'));
        const modeSpan = document.createElement('span');
        modeSpan.style.fontSize = '11px';
        modeSpan.style.color = 'var(--t3)';
        modeSpan.style.fontWeight = '500';
        modeSpan.textContent = modeLabel;
        chatTitle.appendChild(modeSpan);

        if (!convs || convs.length === 0) {
            setEmpty(chatBody, 'No conversations yet.');
            return;
        }

        // Apply mode filter
        const filtered = convs.filter(c => {
            if (uiMode === 'seller') return c.isSellerConversation;
            return !c.isSellerConversation;
        });

        if (filtered.length === 0) {
            setEmpty(chatBody, `No ${uiMode} messages.`);
            return;
        }

        clearNode(chatBody);
        filtered.forEach(c => {
            const item = document.createElement('div');
            item.className = `chat-item ${c.unreadCount > 0 ? 'unread' : ''}`;
            const partner = c.partner || {};
            const safePartnerName = partner.nickname || partner.name || 'User';
            const safeProdName = c.product ? c.product.title : 'Deleted Product';
            const safeLastMessage = c.lastMessage || 'No messages yet';

            const av = document.createElement('div');
            av.className = 'chat-avatar';
            av.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
            av.style.color = '#fff';
            av.appendChild(avatarNode(safePartnerName, partner.avatar));

            const info = document.createElement('div');
            info.className = 'chat-info';

            const top = document.createElement('div');
            top.className = 'chat-top';
            const nm = document.createElement('span');
            nm.className = 'chat-name';
            nm.textContent = safePartnerName;
            const tm = document.createElement('span');
            tm.className = 'chat-time';
            tm.textContent = formatTime(c.updatedAt);
            top.appendChild(nm);
            top.appendChild(tm);

            const prod = document.createElement('div');
            prod.className = 'chat-prod-name';
            prod.style.fontSize = '11px';
            prod.style.color = 'var(--t3)';
            prod.style.margin = '2px 0';
            prod.textContent = `📦 ${safeProdName}`;

            const last = document.createElement('div');
            last.className = 'chat-last';
            last.textContent = safeLastMessage;

            info.appendChild(top);
            info.appendChild(prod);
            info.appendChild(last);
            item.appendChild(av);
            item.appendChild(info);
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
        setEmpty(chatBody, 'Loading messages...');

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
            setEmpty(chatBody, 'Error loading messages.');
        }
    }

    function renderMessagesView(messages) {
        clearNode(chatBody);
        const scroll = document.createElement('div');
        scroll.className = 'chat-messages-container';
        scroll.id = 'chat-msgs-scroll';
        messages.forEach((m) => {
            scroll.appendChild(createMessageNode(m));
        });
        const inputArea = document.createElement('div');
        inputArea.className = 'chat-input-area';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chat-mini-input';
        input.id = 'chat-mini-input';
        input.placeholder = 'Type a message...';
        const sendBtn = document.createElement('button');
        sendBtn.className = 'chat-mini-send';
        sendBtn.id = 'chat-mini-send';
        sendBtn.textContent = '➤';
        inputArea.appendChild(input);
        inputArea.appendChild(sendBtn);
        chatBody.appendChild(scroll);
        chatBody.appendChild(inputArea);
        
        scroll.scrollTop = scroll.scrollHeight;

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

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
    }

    function createMessageNode(m) {
        const isMe = String(m.sender._id || m.sender) === window.SOCKET_USER_ID;
        const row = document.createElement('div');
        row.className = `chat-msg-row ${isMe ? 'me' : 'them'}`;
        if (m.imageUrl) {
            const img = document.createElement('img');
            img.className = 'chat-bubble-image';
            img.src = String(m.imageUrl);
            img.alt = 'Image';
            img.addEventListener('click', () => window.open(String(m.imageUrl), '_blank'));
            row.appendChild(img);
        }
        if (m.text) {
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble';
            bubble.textContent = m.text;
            row.appendChild(bubble);
        }
        return row;
    }

    function appendMessage(m) {
        const scroll = document.getElementById('chat-msgs-scroll');
        if (!scroll) return;
        scroll.appendChild(createMessageNode(m));
        scroll.scrollTop = scroll.scrollHeight;
    }

    function updateUnreadBadge(convs) {
        const uiMode = getMode();
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
