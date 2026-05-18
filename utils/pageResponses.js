const { VIEWS, APP_NAME, TITLE_SEPARATOR } = require('../config/pageConstants');

function renderNotFound(res, overrides = {}) {
  return res.status(404).render(VIEWS.NOT_FOUND, {
    title: `404 - Not Found${TITLE_SEPARATOR}${APP_NAME}`,
    isLoginPage: false,
    ...overrides,
  });
}

function renderForbidden(res, overrides = {}) {
  return res.status(403).render(VIEWS.ERROR, {
    title: `Forbidden${TITLE_SEPARATOR}${APP_NAME}`,
    message: 'You do not have permission to access this page.',
    isLoginPage: false,
    ...overrides,
  });
}

function renderServerError(res, overrides = {}) {
  return res.status(500).render(VIEWS.ERROR, {
    title: `Error${TITLE_SEPARATOR}${APP_NAME}`,
    message: 'An unexpected error occurred. Please try again.',
    isLoginPage: false,
    ...overrides,
  });
}

module.exports = {
  renderForbidden,
  renderNotFound,
  renderServerError,
};
