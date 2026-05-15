/*
 * Dynamic Table Block — EDS + Universal Editor
 * blocks/dynamic-table/dynamic-table.js
 */

/* ── Utility: create element ── */
function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

/* ── Utility: create control button ── */
function ctrlBtn(label, isAdd, fn) {
  const b = el('button', `dt-ctrl-btn ${isAdd ? 'add' : 'remove'}`);
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

/* ── Utility: create pagination button ── */
function pgBtn(label, disabled, fn) {
  const b = el('button', 'dt-page-btn');
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener('click', fn);
  return b;
}

/* ── Utility: ellipsis span ── */
function dots() {
  const s = el('span', 'dt-ellipsis');
  s.textContent = '…';
  return s;
}

/* ── Parse or create fresh state ── */
function parseState(block) {
  try {
    const parsed = JSON.parse(block.dataset.tabledata || '');
    if (parsed && parsed.headers && parsed.rows) return parsed;
  } catch (e) {
    // fall through to default
  }
  return {
    headers: ['Column 1', 'Column 2', 'Column 3'],
    rows: Array.from({ length: 4 }, () => Array(3).fill('')),
    style: '',
    rowsPerPage: 10,
  };
}

export default function decorate(block) {
  /* ── State ── */
  let state = parseState(block);
  let currentPage = 1;
  let sortCol = -1;
  let sortAsc = true;
  let query = '';

  /* ── Persist to block dataset → UE writes to JCR ── */
  function persist() {
    block.dataset.tabledata = JSON.stringify(state);
  }

  /* ── Apply style variant to root ── */
  function applyStyle(root) {
    root.dataset.style = state.style || 'default';
  }

  /* ── Sort helper ── */
  function sortRows(rows) {
    return [...rows].sort((a, b) => {
      const va = String(a[sortCol] || '').toLowerCase();
      const vb = String(b[sortCol] || '').toLowerCase();
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return sortAsc ? na - nb : nb - na;
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  /* ── Build toolbar ── */
  function buildToolbar() {
    const bar = el('div', 'dt-toolbar');

    /* Search */
    const searchWrap = el('div', 'dt-search-wrap');
    const icon = el('span', 'dt-search-icon');
    icon.textContent = '🔍';
    const si = el('input', 'dt-search');
    si.type = 'search';
    si.placeholder = 'Search table…';
    si.setAttribute('aria-label', 'Search table');
    si.addEventListener('input', (e) => {
      query = e.target.value.toLowerCase().trim();
      currentPage = 1;
      renderAll();
    });
    searchWrap.append(icon, si);

    /* Controls */
    const controls = el('div', 'dt-controls');

    const addColBtn = ctrlBtn('+COL', true, () => {
      state.headers.push(`Column ${state.headers.length + 1}`);
      state.rows.forEach((r) => r.push(''));
      persist();
      renderAll();
    });

    const remColBtn = ctrlBtn('−COL', false, () => {
      if (state.headers.length <= 1) return;
      state.headers.pop();
      state.rows.forEach((r) => r.pop());
      persist();
      renderAll();
    });

    const addRowBtn = ctrlBtn('+ROW', true, () => {
      state.rows.push(Array(state.headers.length).fill(''));
      persist();
      renderAll();
    });

    const remRowBtn = ctrlBtn('−ROW', false, () => {
      if (state.rows.length <= 1) return;
      state.rows.pop();
      persist();
      renderAll();
    });

    /* Style selector */
    const styleSelect = el('select', 'dt-style-select');
    styleSelect.setAttribute('aria-label', 'Table style');
    [
      ['Default', ''],
      ['Striped', 'striped'],
      ['Bordered', 'bordered'],
      ['Compact', 'compact'],
    ].forEach(([label, val]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === state.style) opt.selected = true;
      styleSelect.appendChild(opt);
    });
    styleSelect.addEventListener('change', () => {
      state.style = styleSelect.value;
      persist();
      applyStyle(root);
    });

    /* Rows per page */
    const rppLabel = el('label', 'dt-rpp-label');
    rppLabel.textContent = 'Rows:';
    const rppInput = el('input', 'dt-rpp');
    rppInput.type = 'number';
    rppInput.min = '1';
    rppInput.max = '100';
    rppInput.value = state.rowsPerPage;
    rppInput.setAttribute('aria-label', 'Rows per page');
    rppInput.addEventListener('change', () => {
      state.rowsPerPage = Math.max(1, parseInt(rppInput.value, 10) || 10);
      currentPage = 1;
      persist();
      renderAll();
    });

    controls.append(addColBtn, remColBtn, addRowBtn, remRowBtn, styleSelect, rppLabel, rppInput);
    bar.append(searchWrap, controls);
    return bar;
  }

  /* ── Build footer (row count + pagination) ── */
  function buildFooter() {
    const footer = el('div', 'dt-footer');
    rowCountEl = el('span', 'dt-row-count');
    paginationEl = el('div', 'dt-pagination');
    footer.append(rowCountEl, paginationEl);
    return footer;
  }

  /* ── Render table ── */
  function renderTable() {
    /* 1. Filter */
    let filtered = query
      ? state.rows.filter((row) => row.some((c) => String(c).toLowerCase().includes(query)))
      : [...state.rows];

    /* 2. Sort */
    if (sortCol >= 0) {
      filtered = sortRows(filtered);
    }

    /* 3. Paginate */
    const rpp = state.rowsPerPage;
    const totalPages = Math.max(1, Math.ceil(filtered.length / rpp));
    currentPage = Math.min(currentPage, totalPages);
    const pageRows = filtered.slice((currentPage - 1) * rpp, currentPage * rpp);

    /* 4. Build table */
    const table = el('table', 'dt-table');
    table.setAttribute('role', 'grid');

    /* THEAD */
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');

    state.headers.forEach((h, ci) => {
      const th = document.createElement('th');
      th.setAttribute(
        'aria-sort',
        sortCol === ci ? (sortAsc ? 'ascending' : 'descending') : 'none',
      );

      const hi = el('input', 'dt-header-input');
      hi.type = 'text';
      hi.value = h;
      hi.setAttribute('aria-label', `Column ${ci + 1} header`);
      hi.addEventListener('click', (e) => e.stopPropagation());
      hi.addEventListener('change', (e) => {
        state.headers[ci] = e.target.value.trim() || `Column ${ci + 1}`;
        persist();
      });

      const sb = el('button', 'dt-sort-btn');
      sb.setAttribute('aria-label', `Sort by ${h}`);
      sb.innerHTML = sortCol === ci ? (sortAsc ? '&#8593;' : '&#8595;') : '&#8645;';
      sb.addEventListener('click', () => {
        sortAsc = sortCol === ci ? !sortAsc : true;
        sortCol = ci;
        currentPage = 1;
        renderAll();
      });

      th.append(hi, sb);
      htr.appendChild(th);
    });

    const actionTh = document.createElement('th');
    actionTh.className = 'dt-action-th';
    actionTh.setAttribute('aria-label', 'Row actions');
    htr.appendChild(actionTh);
    thead.appendChild(htr);
    table.appendChild(thead);

    /* TBODY */
    const tbody = document.createElement('tbody');

    if (!pageRows.length) {
      const etr = document.createElement('tr');
      const etd = document.createElement('td');
      etd.colSpan = state.headers.length + 1;
      etd.className = 'dt-empty';
      etd.textContent = query
        ? 'No rows match your search.'
        : 'No data yet — click +ROW to add rows.';
      etr.appendChild(etd);
      tbody.appendChild(etr);
    } else {
      pageRows.forEach((row, ri) => {
        const globalIdx = state.rows.indexOf(row);
        const tr = document.createElement('tr');

        row.forEach((cellVal, ci) => {
          const td = document.createElement('td');
          const inp = el('input', 'dt-cell-input');
          inp.type = 'text';
          inp.value = cellVal;
          inp.setAttribute('aria-label', `${state.headers[ci]}, row ${ri + 1}`);

          inp.addEventListener('change', (e) => {
            if (globalIdx >= 0) {
              state.rows[globalIdx][ci] = e.target.value;
              persist();
            }
          });

          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              inp.blur();
              const nextRow = tr.nextElementSibling;
              if (nextRow) {
                const inputs = nextRow.querySelectorAll('.dt-cell-input');
                if (inputs[ci]) inputs[ci].focus();
              }
            }
          });

          td.appendChild(inp);
          tr.appendChild(td);
        });

        /* Row remove button */
        const actionTd = el('td', 'dt-action-td');
        const xBtn = el('button', 'dt-remove-row-btn');
        xBtn.textContent = '×';
        xBtn.setAttribute('aria-label', `Remove row ${ri + 1}`);
        xBtn.title = 'Remove this row';
        xBtn.addEventListener('click', () => {
          if (state.rows.length <= 1) return;
          if (globalIdx >= 0) {
            state.rows.splice(globalIdx, 1);
            const newTotal = Math.max(1, Math.ceil(state.rows.length / state.rowsPerPage));
            if (currentPage > newTotal) currentPage = newTotal;
            persist();
            renderAll();
          }
        });

        actionTd.appendChild(xBtn);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);

    rowCountEl.textContent = `${filtered.length} row${filtered.length !== 1 ? 's' : ''} · ${state.headers.length} col${state.headers.length !== 1 ? 's' : ''}`;
  }

  /* ── Render pagination ── */
  function renderPagination() {
    paginationEl.innerHTML = '';

    const filtered = query
      ? state.rows.filter((row) => row.some((c) => String(c).toLowerCase().includes(query)))
      : state.rows;

    const totalPages = Math.max(1, Math.ceil(filtered.length / state.rowsPerPage));
    if (totalPages <= 1) return;

    const prev = pgBtn('← Prev', currentPage === 1, () => {
      currentPage -= 1;
      renderAll();
    });
    paginationEl.appendChild(prev);

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    if (start > 1) {
      paginationEl.appendChild(pgBtn(1, false, () => { currentPage = 1; renderAll(); }));
      if (start > 2) paginationEl.appendChild(dots());
    }

    for (let p = start; p <= end; p += 1) {
      const b = pgBtn(p, false, () => { currentPage = p; renderAll(); });
      if (p === currentPage) b.classList.add('active');
      paginationEl.appendChild(b);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) paginationEl.appendChild(dots());
      paginationEl.appendChild(pgBtn(totalPages, false, () => { currentPage = totalPages; renderAll(); }));
    }

    const next = pgBtn('Next →', currentPage === totalPages, () => {
      currentPage += 1;
      renderAll();
    });
    paginationEl.appendChild(next);
  }

  /* ── Render all ── */
  function renderAll() {
    renderTable();
    renderPagination();
    applyStyle(root);
  }

  /* ── Mount DOM ── */
  const root = el('div', 'dt-root');
  let tableWrap = el('div', 'dt-table-wrap');
  let rowCountEl;
  let paginationEl;

  const toolbar = buildToolbar();
  const footer = buildFooter();

  root.append(toolbar, tableWrap, footer);
  block.replaceChildren(root);

  /* ── Initial render ── */
  renderAll();
}
