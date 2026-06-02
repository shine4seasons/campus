function refreshSearchIcons() {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function enhanceSearchSelect(select) {
  const field = select.closest('.search-field');
  if (!field || field.dataset.customSelectReady === 'true') return;
  field.dataset.customSelectReady = 'true';
  field.classList.add('has-custom-select');

  const combo = document.createElement('div');
  combo.className = 'search-filter-combo';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'search-filter-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'search-filter-value';

  const chevron = document.createElement('i');
  chevron.setAttribute('data-lucide', 'chevron-down');

  trigger.append(label, chevron);

  const menu = document.createElement('div');
  menu.className = 'search-filter-menu';
  menu.setAttribute('role', 'listbox');

  function selectedOption() {
    return Array.from(select.options).find((option) => option.value === select.value) || select.options[0];
  }

  function close() {
    combo.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function open() {
    document.querySelectorAll('.search-filter-combo.open').forEach((other) => {
      if (other !== combo) {
        other.classList.remove('open');
        other.querySelector('.search-filter-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });
    combo.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function sync() {
    const current = selectedOption();
    label.textContent = current ? current.textContent : '';
    menu.querySelectorAll('.search-filter-option').forEach((button) => {
      const selected = button.dataset.value === select.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  Array.from(select.options).forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-filter-option';
    button.dataset.value = option.value;
    button.setAttribute('role', 'option');

    const text = document.createElement('span');
    text.textContent = option.textContent;

    const check = document.createElement('i');
    check.className = 'search-filter-check';
    check.setAttribute('data-lucide', 'check');

    button.append(text, check);
    button.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      close();
      trigger.focus();
    });
    menu.appendChild(button);
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (combo.classList.contains('open')) close();
    else open();
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
      menu.querySelector('.search-filter-option.selected, .search-filter-option')?.focus();
    }
  });

  menu.addEventListener('keydown', (event) => {
    const options = Array.from(menu.querySelectorAll('.search-filter-option'));
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      close();
      trigger.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      options[Math.max(index - 1, 0)]?.focus();
    }
  });

  combo.append(trigger, menu);
  select.insertAdjacentElement('afterend', combo);
  select.addEventListener('change', sync);
  sync();
}

document.querySelectorAll('.search-field select').forEach(enhanceSearchSelect);

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-filter-combo')) {
    document.querySelectorAll('.search-filter-combo.open').forEach((combo) => {
      combo.classList.remove('open');
      combo.querySelector('.search-filter-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }
});

refreshSearchIcons();
