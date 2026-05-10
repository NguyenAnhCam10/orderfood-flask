(function () {
  const SUGGEST_URL = '/api/search/suggest';
  const MIN_CHARS = 1;
  const DEBOUNCE_MS = 200;

  let debounceTimer = null;
  let abortController = null;

  function init() {
    const input = document.getElementById('search-input');
    if (!input) return;

    const label = input.closest('label');
    if (!label) return;
    label.style.position = 'relative';

    const dropdown = document.createElement('div');
    dropdown.id = 'search-dropdown';
    Object.assign(dropdown.style, {
      position: 'absolute',
      top: '100%',
      left: '0',
      right: '0',
      zIndex: '9999',
      background: '#fff',
      border: '1px solid #dee2e6',
      borderRadius: '0.375rem',
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      maxHeight: '340px',
      overflowY: 'auto',
      display: 'none',
      marginTop: '2px',
    });
    label.appendChild(dropdown);

    input.addEventListener('input', function () {
      const q = this.value.trim();
      clearTimeout(debounceTimer);
      if (q.length < MIN_CHARS) { hide(dropdown); return; }
      debounceTimer = setTimeout(() => fetch_suggest(q, dropdown, input), DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hide(dropdown); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = dropdown.querySelector('[data-item]');
        if (first) first.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!label.contains(e.target)) hide(dropdown);
    });
  }

  function fetch_suggest(q, dropdown, input) {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    fetch(SUGGEST_URL + '?q=' + encodeURIComponent(q), { signal: abortController.signal })
      .then(function (r) { return r.json(); })
      .then(function (data) { render(data, dropdown, input); })
      .catch(function () {});
  }

  function render(data, dropdown, input) {
    const restaurants = data.restaurants || [];
    const dishes = data.dishes || [];

    if (!restaurants.length && !dishes.length) { hide(dropdown); return; }

    dropdown.innerHTML = '';

    if (restaurants.length) {
      dropdown.appendChild(section_header('Nhà hàng'));
      restaurants.forEach(function (r) {
        const item = make_item('fa-store', r.name, function (e) {
          e.preventDefault();
          hide(dropdown);
          window.location.href = '/restaurant/' + r.id;
        });
        dropdown.appendChild(item);
      });
    }

    if (dishes.length) {
      dropdown.appendChild(section_header('Món ăn'));
      dishes.forEach(function (d) {
        const item = make_item('fa-bowl-food', d.name, function (e) {
          e.preventDefault();
          input.value = d.name;
          hide(dropdown);
          input.closest('form').submit();
        });
        dropdown.appendChild(item);
      });
    }

    dropdown.style.display = 'block';
  }

  function section_header(text) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      padding: '6px 12px',
      fontSize: '.72rem',
      color: '#6c757d',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '.05em',
      borderBottom: '1px solid #f0f0f0',
      background: '#fafafa',
    });
    el.textContent = text;
    return el;
  }

  function make_item(icon_class, label, on_click) {
    const a = document.createElement('a');
    a.setAttribute('data-item', '');
    a.href = '#';
    a.tabIndex = 0;
    Object.assign(a.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '9px 14px',
      color: '#212529',
      textDecoration: 'none',
      borderBottom: '1px solid #f8f9fa',
      cursor: 'pointer',
      outline: 'none',
    });

    const i = document.createElement('i');
    i.className = 'fa-solid ' + icon_class;
    i.style.cssText = 'width:15px;color:#adb5bd;flex-shrink:0';

    const span = document.createElement('span');
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    span.style.whiteSpace = 'nowrap';
    span.textContent = label;

    a.appendChild(i);
    a.appendChild(span);
    a.addEventListener('click', on_click);

    a.addEventListener('mouseenter', function () { this.style.background = '#f8f9fa'; });
    a.addEventListener('mouseleave', function () { this.style.background = ''; });
    a.addEventListener('focus',      function () { this.style.background = '#f0f4ff'; });
    a.addEventListener('blur',       function () { this.style.background = ''; });

    a.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let next = a.nextElementSibling;
        while (next && !next.dataset.hasOwnProperty('item')) next = next.nextElementSibling;
        if (next) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        let prev = a.previousElementSibling;
        while (prev && !prev.dataset.hasOwnProperty('item')) prev = prev.previousElementSibling;
        if (prev) prev.focus();
        else document.getElementById('search-input').focus();
      }
      if (e.key === 'Escape') {
        document.getElementById('search-input').focus();
        hide(a.closest('#search-dropdown'));
      }
      if (e.key === 'Enter') { e.preventDefault(); a.click(); }
    });

    return a;
  }

  function hide(dropdown) {
    if (!dropdown) return;
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
