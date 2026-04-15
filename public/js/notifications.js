document.addEventListener('DOMContentLoaded', () => {
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifDot = document.getElementById('notif-dot');
    const notifList = document.getElementById('notif-list');

    if (!notifBtn) return;

    // --- Socket.io Integration ---
    if (window.SOCKET_USER_ID) {
        const socket = io();
        
        // Join user-specific room
        socket.emit('joinUser', window.SOCKET_USER_ID);

        // Listen for real-time notifications (In-app only)
        socket.on('newNotification', (notif) => {
            console.log('New notification received:', notif);
            notifDot.style.display = 'block';
            
            // If dropdown is open, prepend the new notification
            if (notifDropdown.classList.contains('show')) {
                prependNotification(notif);
            }
        });
    }

    // Toggle dropdown
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatDropdown = document.getElementById('chat-dropdown');
        if (chatDropdown) chatDropdown.classList.remove('show');
        
        notifDropdown.classList.toggle('show');
        if (notifDropdown.classList.contains('show')) {
            fetchNotifications();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (notifDropdown && notifDropdown.contains(e.target)) return;
        if (notifBtn && notifBtn.contains(e.target)) return;
        notifDropdown.classList.remove('show');
    });

    // Initial check for unread count
    checkUnreadCount();

    async function checkUnreadCount() {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data.success) {
                if (data.unreadCount > 0) {
                    notifDot.style.display = 'block';
                } else {
                    notifDot.style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Error checking notifications:', err);
        }
    }

    async function fetchNotifications() {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data.success) {
                renderNotifications(data.notifications);
            }
        } catch (err) {
            notifList.innerHTML = '<div class="notif-empty">Could not load notifications.</div>';
        }
    }

    function prependNotification(notif) {
        if (notifList.querySelector('.notif-empty')) {
            notifList.innerHTML = '';
        }
        const item = createNotifElement(notif);
        notifList.insertBefore(item, notifList.firstChild);
    }

    function renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) {
            notifList.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
            return;
        }

        notifList.innerHTML = '';
        notifications.forEach(notif => {
            notifList.appendChild(createNotifElement(notif));
        });
    }

    function createNotifElement(notif) {
        const div = document.createElement('a');
        div.href = notif.link || 'javascript:void(0)';
        div.className = `notif-item ${notif.isRead ? '' : 'unread'}`;
        div.innerHTML = `
            <div class="notif-content">
                <div class="notif-title">${notif.title}</div>
                <div class="notif-msg">${notif.message}</div>
                <div class="notif-time">${formatTime(notif.createdAt)}</div>
            </div>
        `;
        div.addEventListener('click', async (e) => {
            if (!notif.isRead) {
                await markAsRead(notif._id);
            }
        });
        return div;
    }

    async function markAsRead(id) {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
            checkUnreadCount();
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    }

    window.markAllNotificationsAsRead = async () => {
        try {
            const res = await fetch('/api/notifications/read-all', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const unreadItems = document.querySelectorAll('.notif-item.unread');
                unreadItems.forEach(item => item.classList.remove('unread'));
                notifDot.style.display = 'none';
            }
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    function formatTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    }
});

// Global Toast logic
window.showToast = function(msg, type = 'ok') {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return console.warn('toast-wrap not found');

    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const icons = {
        ok:   '<svg viewBox="0 0 24 24" stroke-width="2.5" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>',
        err:  '<svg viewBox="0 0 24 24" stroke-width="2.5" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        info: '<svg viewBox="0 0 24 24" stroke-width="2" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    };
    t.innerHTML = (icons[type] || '') + `<span>${msg}</span>`;
    wrap.appendChild(t);

    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(-20px)';
        t.style.transition = 'all .4s ease';
        setTimeout(() => t.remove(), 400);
    }, 3000);
};

// Global Confirm logic
window.showConfirm = function({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'info' }) {
    return new Promise((resolve) => {
        const container = document.getElementById('modal-container');
        if (!container) {
            resolve(confirm(message));
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay';
        modal.innerHTML = `
            <div class="custom-modal">
                <div class="custom-modal-header">
                    <span class="custom-modal-title">${title || 'Confirm'}</span>
                </div>
                <div class="custom-modal-body">
                    <p>${message}</p>
                </div>
                <div class="custom-modal-footer">
                    <button class="modal-btn-cancel">${cancelText}</button>
                    <button class="modal-btn-confirm ${type === 'danger' ? 'danger' : ''}">${confirmText}</button>
                </div>
            </div>
        `;

        container.appendChild(modal);

        const close = (res) => {
            modal.style.opacity = '0';
            modal.querySelector('.custom-modal').style.transform = 'scale(0.95)';
            setTimeout(() => {
                modal.remove();
                resolve(res);
            }, 200);
        };

        modal.querySelector('.modal-btn-confirm').onclick = () => close(true);
        modal.querySelector('.modal-btn-cancel').onclick = () => close(false);
        modal.onclick = (e) => { if (e.target === modal) close(false); };
    });
};
