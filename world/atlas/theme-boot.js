/* Apply a saved appearance before the stylesheet can first paint. */
(function () {
  try {
    const saved = JSON.parse(localStorage.getItem("haiz-atlas-theme-v1"));
    if (saved === "porcelain" || saved === "obsidian" || saved === "ocean") {
      document.documentElement.dataset.theme = saved;
    }
  } catch (_) { /* private mode or storage disabled: keep default Porcelain */ }
})();
