// blocks/dynamic-table/dynamic-table.js
// Drop this file (plus dynamic-table.css) into your EDS GitHub repo.
// AEM calls decorate(block) automatically when the block is on a page.

export default function decorate(block) {

  /* 1 — Parse state persisted by Universal Editor (block.dataset.tabledata)
        or build a fresh 3×4 grid on first use */
  let state = parseState(block);

  /* 2 — Build toolbar + table wrapper + footer, mount into block */
  const root = el('div', 'dt-root');
  const toolbar   = buildToolbar();   // +COL −COL +ROW −ROW search style rpp
  const tableWrap = el('div', 'dt-table-wrap');
  const footer    = buildFooter();    // row count + pagination
  root.append(toolbar, tableWrap, footer);
  block.replaceChildren(root);
  renderAll();

  /* ── parseState ──────────────────────────────────────── */
  function parseState(b) {
    try {
      const p = JSON.parse(b.dataset.tabledata || '');
      if (p?.headers && p?.rows) return p;
    } catch {}
    return {
      headers: ['Column 1', 'Column 2', 'Column 3'],
      rows: Array.from({ length: 4 }, () => Array(3).fill('')),
      style: '',
      rowsPerPage: 10,
    };
  }

  /* ── persist ─────────────────────────────────────────
     Writes back to block.dataset → UE intercepts → JCR */
  function persist() {
    block.dataset.tabledata = JSON.stringify(state);
  }

  /* ── buildToolbar ────────────────────────────────────── */
  function buildToolbar() {
    const bar = el('div', 'dt-toolbar');
    // +COL: push new header + empty cell per row
    iconBtn('+COL', 'Add column', () => {
      state.headers.push(`Column ${state.headers.length + 1}`);
      state.rows.forEach(r => r.push(''));
      persist(); renderAll();
    });
    // −COL: pop header + last cell per row
    iconBtn('−COL', 'Remove last column', () => {
      if (state.headers.length <= 1) return;
      state.headers.pop();
      state.rows.forEach(r => r.pop());
      persist(); renderAll();
    });
    // +ROW: push new empty row
    iconBtn('+ROW', 'Add row', () => {
      state.rows.push(Array(state.headers.length).fill(''));
      persist(); renderAll();
    });
    // −ROW: pop last row
    iconBtn('−ROW', 'Remove last row', () => {
      if (state.rows.length <= 1) return;
      state.rows.pop();
      persist(); renderAll();
    });
    // … style select, rows-per-page, search omitted for brevity
    return bar;
  }

  /* ── renderTable ─────────────────────────────────────
     Filter → Sort → Paginate → Paint                  */
  function renderTable() {
    let filtered = state.rows.filter(row =>
      !query || row.some(c => String(c).toLowerCase().includes(query))
    );
    if (sortCol >= 0) filtered = sortRows(filtered);
    const page = filtered.slice(
      (currentPage - 1) * state.rowsPerPage,
      currentPage * state.rowsPerPage
    );
    // Build <table> with editable headers + editable cells + ×-per-row
    // Each cell: <input class="dt-cell-input"> onChange → state.rows[i][j] = val
    // Each × btn: state.rows.splice(globalIdx, 1) → persist() → renderAll()
  }

  /* ── persist saves data back so UE can write to AEM JCR ── */
}