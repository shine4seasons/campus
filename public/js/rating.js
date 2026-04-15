/**
 * Rating utility functions for submitting, displaying, and managing ratings
 */

/**
 * Display star rating
 */
function renderStars(score, size = 16) {
  const fullStars = Math.floor(score);
  const hasHalf = score % 1 >= 0.5;
  let html = '';

  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      html += `<span class="star star-filled" style="font-size:${size}px">★</span>`;
    } else if (i === fullStars + 1 && hasHalf) {
      html += `<span class="star star-half" style="font-size:${size}px">★</span>`;
    } else {
      html += `<span class="star star-empty" style="font-size:${size}px">★</span>`;
    }
  }

  return html;
}

/**
 * Display rating component with score and count
 */
function displayRating(score, count = 0) {
  const stars = renderStars(score);
  return `
    <div class="rating-display">
      <div class="stars">${stars}</div>
      <span class="rating-value">${parseFloat(score).toFixed(1)}</span>
      <span class="rating-count">${count} ${count === 1 ? 'review' : 'reviews'}</span>
    </div>
  `;
}

/**
 * Create interactive star rating input
 */
function createRatingInput(onStarClick, initialScore = 0) {
  let hoveredScore = 0;

  let html = '<div class="rating-input">';
  for (let i = 1; i <= 5; i++) {
    html += `
      <span class="star star-empty" 
            data-score="${i}"
            onmouseenter="updateRatingHover(this, ${i})"
            onmouseleave="clearRatingHover()"
            onclick="selectRating(this, ${i})"
            style="font-size:24px;cursor:pointer;"
      >★</span>
    `;
  }
  html += '</div>';

  return html;
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
      console.error('Failed to load ratings:', data.message);
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data.data || data.data.length === 0) {
      container.innerHTML = '<p style="color: var(--t2); font-size: 13px;">No ratings yet</p>';
      return;
    }

    let html = '';
    data.data.forEach(rating => {
      const date = new Date(rating.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      html += `
        <div class="rating-item">
          <div class="rating-item-header">
            <div class="rating-item-author">
              <div class="rating-item-avatar">
                ${rating.rater.avatar ? `<img src="${rating.rater.avatar}" />` : rating.rater.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="rating-item-name">${rating.rater.nickname || rating.rater.name}</div>
                <div class="rating-item-date">${date}</div>
              </div>
            </div>
            <div class="rating-item-score">${renderStars(rating.score, 14)}</div>
          </div>
          ${rating.comment ? `<div class="rating-item-comment">${escapeHtml(rating.comment)}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading ratings:', error);
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
      console.error('Failed to load rating stats:', data.message);
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const { distribution, total, average } = data.data;
    
    // Add summary header
    let html = `
      <div class="rating-stats-header" style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div class="rating-average-value" style="font-size:32px;font-weight:800;color:var(--t1);">${parseFloat(average).toFixed(1)}</div>
        <div class="rating-average-stars">
          <div>${renderStars(average, 18)}</div>
          <div style="font-size:13px;color:var(--t2);margin-top:2px;">Based on ${total} ${total === 1 ? 'review' : 'reviews'}</div>
        </div>
      </div>
      <div class="rating-distribution">
    `;

    for (let i = 5; i >= 1; i--) {
      const count = distribution[i] || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;

      html += `
        <div class="rating-dist-item">
          <div class="rating-dist-label">
            ${i} <span style="color:#fbbf24;margin-left:2px">★</span>
          </div>
          <div class="rating-dist-bar">
            <div class="rating-dist-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="rating-dist-count">${count}</div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading rating stats:', error);
  }
}

/**
 * Submit a rating
 */
async function submitRating(entityType, entityId, score, comment = '') {
  const notify = (msg, type = 'ok') => {
    if (typeof showToast === 'function') showToast(msg, type);
    else if (typeof toast === 'function') toast(msg, type);
    else alert(msg);
  };

  if (!score || score < 1 || score > 5) {
    notify('Please select a rating to continue', 'err');
    return false;
  }

  try {
    const response = await fetch('/api/ratings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        entityType,
        entityId,
        score: parseInt(score),
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
    console.error('Error submitting rating:', error);
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
    else alert(msg);
  };

  if (!confirm('Are you sure you want to delete this rating?')) {
    return false;
  }

  try {
    const response = await fetch('/api/ratings', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        entityType,
        entityId
      })
    });

    const data = await response.json();

    if (!data.success) {
      notify(data.message || 'Failed to delete rating', 'err');
      return false;
    }

    notify('Review deleted successfully.', 'ok');
    return true;
  } catch (error) {
    console.error('Error deleting rating:', error);
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
    console.error('Error fetching user rating:', error);
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
function clearRatingHover() {
  const selected = document.querySelector('.rating-input .star.selected');
  if (!selected) {
    document.querySelectorAll('.rating-input .star').forEach(star => {
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
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
