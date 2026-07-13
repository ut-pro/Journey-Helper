(function () {
  "use strict";

  const VALID_TOOLS = [
    "campaign-builder",
    "specialty-finder",
    "flash-comparison",
  ];
  const DEFAULT_TOOL = "campaign-builder";

  const navLinks = document.querySelectorAll(".tool-nav-link");
  const frames = document.querySelectorAll(".tool-frame");

  function getToolFromHash() {
    const hash = window.location.hash.replace("#", "").trim();
    return VALID_TOOLS.includes(hash) ? hash : DEFAULT_TOOL;
  }

  function activateTool(toolName) {
    frames.forEach((frame) => {
      frame.classList.toggle("active", frame.dataset.tool === toolName);
    });
    navLinks.forEach((link) => {
      const isActive = link.dataset.tool === toolName;

      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function syncFromHash() {
    const tool = getToolFromHash();

    // Normalize invalid/missing hash to default without breaking history state.
    if (window.location.hash.replace("#", "") !== tool) {
      history.replaceState(null, "", "#" + tool);
    }

    activateTool(tool);
  }

  window.addEventListener("hashchange", syncFromHash);

  // Script is loaded at the end of <body>, so the DOM is already available.
  syncFromHash();
})();
