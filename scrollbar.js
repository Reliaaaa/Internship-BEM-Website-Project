// Use the same body overlay scrollbar approach as the portfolio.
if (window.OverlayScrollbarsGlobal) {
  window.OverlayScrollbarsGlobal.OverlayScrollbars(
    { target: document.body, cancel: { body: null } },
    { overflow: { x: 'hidden', y: 'scroll' }, scrollbars: { theme: 'os-theme-taskflow', autoHide: 'never', dragScroll: true } }
  );
}
