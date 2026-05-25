(function attachAppUtils(globalScope) {
  const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"'`]/g, function mapChar(char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
      }[char];
    });
  }

  function formatVND(value) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);
  }

  function appendChildren(parent, children) {
    if (!parent || !Array.isArray(children)) return parent;
    children.flat(Infinity).forEach(function appendChildNode(child) {
      if (child == null || child === false) return;
      if (child instanceof Node) {
        parent.appendChild(child);
        return;
      }
      parent.appendChild(document.createTextNode(String(child)));
    });
    return parent;
  }

  function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    if (options.className) {
      element.className = options.className;
    }
    if (Array.isArray(options.classes) && options.classes.length > 0) {
      element.classList.add(...options.classes.filter(Boolean));
    }
    if (options.text != null) {
      element.textContent = String(options.text);
    }
    if (options.attrs) {
      Object.entries(options.attrs).forEach(function setAttr([name, value]) {
        if (value == null) return;
        element.setAttribute(name, String(value));
      });
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(function setDataset([name, value]) {
        if (value == null) return;
        element.dataset[name] = String(value);
      });
    }
    if (options.style) {
      Object.assign(element.style, options.style);
    }
    if (options.children) {
      appendChildren(element, Array.isArray(options.children) ? options.children : [options.children]);
    }
    return element;
  }

  function createSvgElement(tagName, attrs = {}, children = []) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attrs).forEach(function setAttr([name, value]) {
      if (value == null) return;
      element.setAttribute(name, String(value));
    });
    children.forEach(function appendSvgChild(child) {
      if (child) {
        element.appendChild(child);
      }
    });
    return element;
  }

  function safeJsonForInlineScript(value) {
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function reportClientLog(level, ...args) {
    const consoleApi = globalScope['console'];
    if (!globalScope.DEBUG_CLIENT_LOGS || !consoleApi) return;
    const method = level === 'error' ? 'error' : (level === 'warn' ? 'warn' : 'log');
    const writer = consoleApi[method] || consoleApi.log;
    if (typeof writer === 'function') {
      writer.apply(consoleApi, args);
    }
  }

  function getCsrfToken() {
    const tokenPair = document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('csrf='));
    if (!tokenPair) return '';
    return decodeURIComponent(tokenPair.slice('csrf='.length));
  }

  function shouldAttachCsrf(input, method) {
    if (SAFE_METHODS.has(method)) return false;
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    return url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
  }

  const nativeFetch = globalScope.fetch && globalScope.fetch.bind(globalScope);
  if (nativeFetch) {
    globalScope.fetch = function hardenedFetch(input, init = {}) {
      const method = String(init.method || 'GET').toUpperCase();
      const nextInit = { ...init };

      if (shouldAttachCsrf(input, method)) {
        const token = getCsrfToken();
        const headers = new Headers(init.headers || {});
        if (token && !headers.has('x-csrf-token')) {
          headers.set('x-csrf-token', token);
        }
        nextInit.headers = headers;
        if (!nextInit.credentials) {
          nextInit.credentials = 'include';
        }
      }

      return nativeFetch(input, nextInit);
    };
  }

  globalScope.AppUtils = Object.freeze({
    appendChildren,
    createElement,
    createSvgElement,
    escapeHtml,
    formatVND,
    safeJsonForInlineScript,
    reportClientError: (...args) => reportClientLog('error', ...args),
    reportClientWarn: (...args) => reportClientLog('warn', ...args),
    reportClientInfo: (...args) => reportClientLog('info', ...args),
    getCsrfToken
  });
})(window);
