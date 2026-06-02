/**
 * Rating utility functions for submitting, displaying, and managing ratings
 */
const { createElement, createSvgElement } = window.AppUtils || {};

function createStarSvg(size, fill) {
  return createSvgElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: String(size),
    height: String(size),
    viewBox: '0 0 24 24',
    fill,
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  }, [
    createSvgElement('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
  ]);
}

function createStarsNode(score, size = 16) {
  const fragment = document.createDocumentFragment();
  const fullStars = Math.floor(score);
  const hasHalf = score % 1 >= 0.5;

  for (let i = 1; i <= 5; i += 1) {
    const isFilled = i <= fullStars;
    const isHalf = i === fullStars + 1 && hasHalf;
    const star = createElement('span', {
      className: isFilled ? 'star star-filled' : (isHalf ? 'star star-half' : 'star star-empty'),
      style: {
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        verticalAlign: 'middle',
        color: isFilled || isHalf ? '#fbbf24' : '#CBD5E1'
      }
    });
    star.appendChild(createStarSvg(size, isFilled ? 'currentColor' : 'none'));
    fragment.appendChild(star);
  }

  return fragment;
}

/**
 * Display star rating
 */
function renderStars(score, size = 16) {
  return createStarsNode(Number(score) || 0, Number(size) || 16);
}

/**
 * Display rating component with score and count
 */
function displayRating(score, count = 0) {
  const stars = createElement('div', { className: 'stars' });
  stars.appendChild(renderStars(score));
  return createElement('div', {
    className: 'rating-display',
    children: [
      stars,
      createElement('span', { className: 'rating-value', text: (Number.parseFloat(score) || 0).toFixed(1) }),
      createElement('span', { className: 'rating-count', text: `${count} ${count === 1 ? 'review' : 'reviews'}` })
    ]
  });
}

/**
 * Create interactive star rating input
 */
function createRatingInput(onStarClick, initialScore = 0) {
  const wrap = createElement('div', { className: 'rating-input' });
  for (let i = 1; i <= 5; i += 1) {
    const selectedClass = initialScore >= i ? ' star-filled selected' : ' star-empty';
    const star = createElement('span', {
      className: `star${selectedClass}`,
      attrs: {
        'data-action': 'rating-star',
        'data-score': String(i)
      },
      style: {
        width: '24px',
        height: '24px',
        display: 'inline-block',
        cursor: 'pointer',
        color: '#CBD5E1'
      }
    });
    star.appendChild(createStarSvg(24, 'none'));
    if (typeof onStarClick === 'function') {
      star.addEventListener('click', () => onStarClick(i));
    }
    wrap.appendChild(star);
  }
  return wrap;
}

/**
 * Fetch and display ratings for an entity
 */
async function loadRatings(entityType, entityId, containerId) {
  try {
    const response = await fetch(`/api/ratings?entityType=${entityType}&entityId=${entityId}`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (!data.success) {
      window.AppUtils?.reportClientError('Failed to load ratings:', data.message);
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data.data || data.data.length === 0) {
      container.replaceChildren(createElement('p', { style: { color: 'var(--t2)', fontSize: '13px' }, text: 'No ratings yet' }));
      return;
    }

    const renderRatingItems = (items) => {
      if (!items.length) {
        container.replaceChildren(createElement('p', { style: { color: 'var(--t2)', fontSize: '13px' }, text: 'No matching reviews found' }));
        return;
      }
      container.replaceChildren(...items.map((rating) => {
      const date = new Date(rating.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const avatar = createElement('div', { className: 'rating-item-avatar' });
      if (rating.rater.avatar) {
        avatar.appendChild(createElement('img', {
          attrs: {
            src: rating.rater.avatar,
            alt: rating.rater.nickname || rating.rater.name || 'rating avatar'
          }
        }));
      } else {
        avatar.textContent = String(rating.rater.name || '?').charAt(0).toUpperCase();
      }
      const scoreWrap = createElement('div', { className: 'rating-item-score' });
      scoreWrap.appendChild(createStarsNode(rating.score, 14));

      return createElement('div', {
        className: 'rating-item',
        children: [
          createElement('div', {
            className: 'rating-item-header',
            children: [
              createElement('div', {
                className: 'rating-item-author',
                children: [
                  avatar,
                  createElement('div', {
                    children: [
                      createElement('div', { className: 'rating-item-name', text: rating.rater.nickname || rating.rater.name }),
                      createElement('div', { className: 'rating-item-date', text: date })
                    ]
                  })
                ]
              }),
              scoreWrap
            ]
          }),
          rating.comment ? createElement('div', { className: 'rating-item-comment', text: rating.comment }) : null
        ].filter(Boolean)
      });
      }));
    };

    const applyRatingSearch = () => {
      const input = document.querySelector(`[data-rating-search="${containerId}"]`);
      const term = input?.value.trim().toLowerCase() || '';
      const items = term
        ? data.data.filter((rating) => {
          const rater = rating.rater || {};
          const haystack = [rater.nickname, rater.name, rating.comment, rating.score]
            .filter((value) => value != null)
            .join(' ')
            .toLowerCase();
          return haystack.includes(term);
        })
        : data.data;
      renderRatingItems(items);
    };

    applyRatingSearch();
    const searchInput = document.querySelector(`[data-rating-search="${containerId}"]`);
    if (searchInput && !searchInput.dataset.boundRatingSearch) {
      searchInput.dataset.boundRatingSearch = 'true';
      searchInput.addEventListener('input', applyRatingSearch);
    }
  } catch (error) {
    window.AppUtils?.reportClientError('Error loading ratings:', error);
  }
}

/**
 * Load and display rating distribution
 */
async function loadRatingStats(entityType, entityId, containerId) {
  try {
    const response = await fetch(`/api/ratings/stats?entityType=${entityType}&entityId=${entityId}`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (!data.success) {
      window.AppUtils?.reportClientError('Failed to load rating stats:', data.message);
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const { distribution, total, average } = data.data;
    const starsWrap = createElement('div');
    starsWrap.appendChild(createStarsNode(average, 18));
    const distributionWrap = createElement('div', { className: 'rating-distribution' });

    for (let i = 5; i >= 1; i -= 1) {
      const count = distribution[i] || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      distributionWrap.appendChild(createElement('div', {
        className: 'rating-dist-item',
        children: [
          createElement('div', {
            className: 'rating-dist-label',
            children: [
              document.createTextNode(String(i)),
              createElement('span', { style: { color: '#fbbf24', marginLeft: '2px' }, text: '★' })
            ]
          }),
          createElement('div', {
            className: 'rating-dist-bar',
            children: [createElement('div', { className: 'rating-dist-fill', style: { width: `${percentage}%` } })]
          }),
          createElement('div', { className: 'rating-dist-count', text: count })
        ]
      }));
    }

    container.replaceChildren(
      createElement('div', {
        className: 'rating-stats-header',
        style: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' },
        children: [
          createElement('div', { className: 'rating-average-value', style: { fontSize: '32px', fontWeight: '800', color: 'var(--t1)' }, text: parseFloat(average).toFixed(1) }),
          createElement('div', {
            className: 'rating-average-stars',
            children: [
              starsWrap,
              createElement('div', { style: { fontSize: '13px', color: 'var(--t2)', marginTop: '2px' }, text: `Based on ${total} ${total === 1 ? 'review' : 'reviews'}` })
            ]
          })
        ]
      }),
      distributionWrap
    );
  } catch (error) {
    window.AppUtils?.reportClientError('Error loading rating stats:', error);
  }
}

/**
 * Submit a rating
 */
async function submitRating(entityType, entityId, score, comment = '') {
  const notify = (msg, type = 'ok') => {
    if (typeof showToast === 'function') showToast(msg, type);
    else if (typeof toast === 'function') toast(msg, type);
    else window.AppUtils?.reportClientWarn(msg);
  };

  if (!score || score < 1 || score > 5) {
    notify('Please select a rating to continue', 'err');
    return false;
  }

  try {
    const response = await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        entityType,
        entityId,
        score: parseInt(score, 10),
        comment: comment.trim().substring(0, 500)
      })
    });

    const data = await response.json();

    if (!data.success) {
      notify(data.message || 'Failed to submit rating', 'err');
      return false;
    }

    notify('Thank you! Your review has been submitted.', 'ok');
    return true;
  } catch (error) {
    window.AppUtils?.reportClientError('Error submitting rating:', error);
    notify('Network error. Please try again.', 'err');
    return false;
  }
}

/**
 * Delete a rating
 */
async function deleteRating(entityType, entityId) {
  const notify = (msg, type = 'ok') => {
    if (typeof showToast === 'function') showToast(msg, type);
    else if (typeof toast === 'function') toast(msg, type);
    else window.AppUtils?.reportClientWarn(msg);
  };

  const confirmed = typeof showConfirm === 'function'
    ? await showConfirm({
        title: 'Delete Review',
        message: 'Are you sure you want to delete this rating?',
        confirmText: 'Delete',
        type: 'danger'
      })
    : false;

  if (!confirmed) {
    return false;
  }

  try {
    const response = await fetch('/api/ratings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ entityType, entityId })
    });

    const data = await response.json();

    if (!data.success) {
      notify(data.message || 'Failed to delete rating', 'err');
      return false;
    }

    notify('Review deleted successfully.', 'ok');
    return true;
  } catch (error) {
    window.AppUtils?.reportClientError('Error deleting rating:', error);
    notify('Network error. Please try again.', 'err');
    return false;
  }
}

/**
 * Get user's current rating for an entity
 */
async function getUserRating(entityType, entityId) {
  try {
    const response = await fetch(`/api/ratings/user-rating?entityType=${entityType}&entityId=${entityId}`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (!data.success) return null;
    return data.data;
  } catch (error) {
    window.AppUtils?.reportClientError('Error fetching user rating:', error);
    return null;
  }
}

/**
 * Utility: Update rating hover state
 */
function updateRatingHover(element, score) {
  const container = element.closest('.rating-input');
  if (!container) return;

  const stars = container.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < score) {
      star.classList.add('star-filled');
      star.classList.remove('star-empty');
    } else {
      star.classList.add('star-empty');
      star.classList.remove('star-filled');
    }
  });
}

/**
 * Utility: Clear rating hover
 */
function clearRatingHover(element) {
  const container = element ? element.closest('.rating-input') : document.querySelector('.rating-input');
  if (!container) return;
  const selected = container.querySelector('.star.selected');
  if (!selected) {
    container.querySelectorAll('.star').forEach((star) => {
      star.classList.add('star-empty');
      star.classList.remove('star-filled');
    });
  }
}

/**
 * Utility: Select rating
 */
function selectRating(element, score) {
  const container = element.closest('.rating-input');
  if (!container) return;

  const stars = container.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < score) {
      star.classList.add('star-filled', 'selected');
      star.classList.remove('star-empty');
      star.dataset.selected = score;
    } else {
      star.classList.add('star-empty');
      star.classList.remove('star-filled', 'selected');
    }
  });

  return score;
}

/**
 * Utility: Escape HTML
 */
const escapeHtml = window.AppUtils && typeof window.AppUtils.escapeHtml === 'function'
  ? window.AppUtils.escapeHtml
  : (text) => String(text ?? '');

document.addEventListener('mouseover', (event) => {
  const star = event.target.closest('[data-action="rating-star"]');
  if (star) updateRatingHover(star, Number(star.dataset.score || 0));
});

document.addEventListener('mouseout', (event) => {
  const star = event.target.closest('[data-action="rating-star"]');
  if (star) clearRatingHover(star);
});

document.addEventListener('click', (event) => {
  const star = event.target.closest('[data-action="rating-star"]');
  if (star) selectRating(star, Number(star.dataset.score || 0));
});
