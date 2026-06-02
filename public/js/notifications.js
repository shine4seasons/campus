function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
}

function setEmptyState(container, text) {
    clearNode(container);
    const div = document.createElement('div');
    div.className = 'notif-empty';
    div.textContent = text;
    container.appendChild(div);
}

document.addEventListener('DOMContentLoaded', () => {
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifDot = document.getElementById('notif-dot');
    const notifList = document.getElementById('notif-list');

    if (!notifBtn) return;

    // --- Socket.io Integration ---
    const socketConfig = window.AppUtils?.readJsonScript
        ? window.AppUtils.readJsonScript('socket-user-config')
        : {};
    window.SOCKET_USER_ID = socketConfig.userId || '';

    if (window.SOCKET_USER_ID) {
        const socket = io();
        
        // Join user-specific room
        socket.emit('joinUser', window.SOCKET_USER_ID);

        // Listen for real-time notifications (In-app only)
        socket.on('newNotification', (notif) => {
            window.AppUtils?.reportClientInfo('New notification received:', notif);
            
            // Update unread count/dot in real-time
            checkUnreadCount();
            
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
            window.AppUtils?.reportClientError('Error checking notifications:', err);
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
            setEmptyState(notifList, 'Could not load notifications.');
        }
    }

    function prependNotification(notif) {
        if (notifList.querySelector('.notif-empty')) {
            clearNode(notifList);
        }
        const item = createNotifElement(notif);
        notifList.insertBefore(item, notifList.firstChild);
    }

    function renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) {
            setEmptyState(notifList, 'No notifications yet.');
            return;
        }

        clearNode(notifList);
        notifications.forEach(notif => {
            notifList.appendChild(createNotifElement(notif));
        });
    }

    function createNotifElement(notif) {
        const div = document.createElement('a');
        div.href = notif.link || 'javascript:void(0)';
        div.className = `notif-item ${notif.isRead ? '' : 'unread'}`;
        const content = document.createElement('div');
        content.className = 'notif-content';
        const title = document.createElement('div');
        title.className = 'notif-title';
        title.textContent = notif.title || '';
        const msg = document.createElement('div');
        msg.className = 'notif-msg';
        msg.textContent = notif.message || '';
        const time = document.createElement('div');
        time.className = 'notif-time';
        time.textContent = formatTime(notif.createdAt);
        content.appendChild(title);
        content.appendChild(msg);
        content.appendChild(time);
        div.appendChild(content);
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
            window.AppUtils?.reportClientError('Error marking as read:', err);
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
            window.AppUtils?.reportClientError('Error marking all as read:', err);
        }
    };

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="mark-all-notifications-read"]')) {
            window.markAllNotificationsAsRead();
        }
    });

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
    if (!wrap) return window.AppUtils?.reportClientWarn('toast-wrap not found');
    wrap.style.zIndex = '2147483647';

    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    if (type === 'info') {
        svg.setAttribute('stroke-width', '2');
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '10');
        const l1 = document.createElementNS(NS, 'line');
        l1.setAttribute('x1', '12'); l1.setAttribute('y1', '8'); l1.setAttribute('x2', '12'); l1.setAttribute('y2', '12');
        const l2 = document.createElementNS(NS, 'line');
        l2.setAttribute('x1', '12'); l2.setAttribute('y1', '16'); l2.setAttribute('x2', '12.01'); l2.setAttribute('y2', '16');
        svg.appendChild(c); svg.appendChild(l1); svg.appendChild(l2);
    } else if (type === 'err') {
        svg.setAttribute('stroke-width', '2.5');
        const l1 = document.createElementNS(NS, 'line');
        l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6'); l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
        const l2 = document.createElementNS(NS, 'line');
        l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6'); l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
        svg.appendChild(l1); svg.appendChild(l2);
    } else {
        svg.setAttribute('stroke-width', '2.5');
        const p = document.createElementNS(NS, 'polyline');
        p.setAttribute('points', '20 6 9 17 4 12');
        svg.appendChild(p);
    }
    t.appendChild(svg);
    const span = document.createElement('span');
    span.textContent = String(msg == null ? '' : msg);
    t.appendChild(span);
    wrap.appendChild(t);

    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(-20px)';
        t.style.transition = 'all .4s ease';
        setTimeout(() => t.remove(), 400);
    }, 3000);
};

function buildConfirmIconSvg(type) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    if (type === 'danger') {
        const path1 = document.createElementNS(NS, 'path');
        path1.setAttribute('d', 'm21.7 18.6-8.5-15a1.4 1.4 0 0 0-2.4 0l-8.5 15A1.4 1.4 0 0 0 3.5 21h17a1.4 1.4 0 0 0 1.2-2.4Z');
        const path2 = document.createElementNS(NS, 'path');
        path2.setAttribute('d', 'M12 9v4');
        const path3 = document.createElementNS(NS, 'path');
        path3.setAttribute('d', 'M12 17h.01');
        svg.appendChild(path1);
        svg.appendChild(path2);
        svg.appendChild(path3);
        return svg;
    }

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    const path1 = document.createElementNS(NS, 'path');
    path1.setAttribute('d', 'M12 8v4');
    const path2 = document.createElementNS(NS, 'path');
    path2.setAttribute('d', 'M12 16h.01');
    svg.appendChild(circle);
    svg.appendChild(path1);
    svg.appendChild(path2);
    return svg;
}

// Global Confirm logic
window.showConfirm = function({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'info' }) {
    return new Promise((resolve) => {
        let container = document.getElementById('modal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'modal-container';
            document.body.appendChild(container);
        }

        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay confirm-modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const modalBox = document.createElement('div');
        modalBox.className = `custom-modal confirm-modal-card ${type === 'danger' ? 'danger' : ''}`.trim();

        const icon = document.createElement('div');
        icon.className = 'confirm-modal-icon';
        icon.appendChild(buildConfirmIconSvg(type));

        const titleEl = document.createElement('h2');
        titleEl.className = 'custom-modal-title confirm-modal-title';
        titleEl.textContent = title || 'Confirm';

        const body = document.createElement('div');
        body.className = 'custom-modal-body confirm-modal-body';
        const p = document.createElement('p');
        p.textContent = message || '';
        body.appendChild(p);

        const footer = document.createElement('div');
        footer.className = 'custom-modal-footer confirm-modal-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn-cancel';
        cancelBtn.textContent = cancelText;
        const confirmBtn = document.createElement('button');
        confirmBtn.className = `modal-btn-confirm ${type === 'danger' ? 'danger' : ''}`.trim();
        confirmBtn.textContent = confirmText;
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        modalBox.appendChild(icon);
        modalBox.appendChild(titleEl);
        modalBox.appendChild(body);
        modalBox.appendChild(footer);
        modal.appendChild(modalBox);

        container.appendChild(modal);

        const close = (res) => {
            modal.style.opacity = '0';
            modal.querySelector('.custom-modal').style.transform = 'scale(0.96) translateY(8px)';
            setTimeout(() => {
                modal.remove();
                resolve(res);
            }, 200);
        };

        confirmBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        modal.addEventListener('click', (e) => { if (e.target === modal) close(false); });
    });
};
