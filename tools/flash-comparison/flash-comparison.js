"use strict";

/* ── PDF.js worker ── */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ════════════════════════════════════════════════════════════
   SHARED RENDER WIDTH
   HTML outer table = 700px. We render EVERYTHING at this
   width so PDF and HTML come out pixel-identical in width.
════════════════════════════════════════════════════════════ */
const SHARED_CSS_W = 700;
/* ── Render-quality knob (decoupled from screen DPR) ──
   Oversamples every render, then displays downscaled to 700px.
   2 = good • 3 = crisp (default) • 4 = maximum (more RAM / slower) */
const RENDER_SCALE = 3;
const SHARED_BUF_W = Math.round(SHARED_CSS_W * RENDER_SCALE);

/* ── State ── */
const state = {
  pdfDocA: null,
  pdfDocB: null,
  imgA: null,
  imgB: null,
  showing: "A",
  isRunning: false,
  timer: null,
  cycles: 0,
};

/* ── DOM refs ── */
const el = {
  fileA: document.getElementById("fileA"),
  fileB: document.getElementById("fileB"),
  zoneA: document.getElementById("zoneA"),
  zoneB: document.getElementById("zoneB"),
  nameA: document.getElementById("nameA"),
  nameB: document.getElementById("nameB"),
  errA: document.getElementById("errA"),
  errB: document.getElementById("errB"),
  pickerA: document.getElementById("pickerA"),
  pickerB: document.getElementById("pickerB"),
  pageSelA: document.getElementById("pageSelA"),
  pageSelB: document.getElementById("pageSelB"),
  totalPagesA: document.getElementById("totalPagesA"),
  totalPagesB: document.getElementById("totalPagesB"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  resetBtn: document.getElementById("resetBtn"),
  speedSlider: document.getElementById("speedSlider"),
  speedVal: document.getElementById("speedVal"),
  flashCanvas: document.getElementById("flashCanvas"),
  placeholder: document.getElementById("placeholder"),
  dot: document.getElementById("dot"),
  showLbl: document.getElementById("showLbl"),
  cycleCnt: document.getElementById("cycleCnt"),
  cropTBA: document.getElementById("cropTBA"),
  cropLRA: document.getElementById("cropLRA"),
  cropTBAVal: document.getElementById("cropTBAVal"),
  cropLRAVal: document.getElementById("cropLRAVal"),
  cropTBB: document.getElementById("cropTBB"),
  cropLRB: document.getElementById("cropLRB"),
  cropTBBVal: document.getElementById("cropTBBVal"),
  cropLRBVal: document.getElementById("cropLRBVal"),
};

const ctx = el.flashCanvas.getContext("2d");

/* ══════════════════════════════════════════
   Collapse / expand helpers
══════════════════════════════════════════ */

function collapseZone(which) {
  const collapsed = document.getElementById("collapsed" + which);
  const expandable = document.getElementById("expandable" + which);
  const collapsedName = document.getElementById("collapsedName" + which);
  const toggle = document.getElementById("toggle" + which);
  const name = document.getElementById("name" + which);

  collapsedName.textContent = name.textContent;
  collapsed.style.display = "flex";
  expandable.classList.remove("open");
  toggle.classList.remove("open");

  collapsed.onclick = () => {
    const isOpen = expandable.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
  };
}

function resetZone(which) {
  const collapsed = document.getElementById("collapsed" + which);
  const expandable = document.getElementById("expandable" + which);
  const toggle = document.getElementById("toggle" + which);
  collapsed.style.display = "none";
  collapsed.onclick = null;
  expandable.classList.remove("open");
  toggle.classList.remove("open");
}

/* ══════════════════════════════════════════
   PDF rendering
══════════════════════════════════════════ */

async function renderPdfPage(pdfDoc, pageNum, cropTB = 0, cropLR = 0) {
  const page = await pdfDoc.getPage(pageNum);
  const baseVP = page.getViewport({ scale: 1 });

  const ptPerPx = baseVP.width / SHARED_BUF_W;
  const cropLRPt = cropLR * RENDER_SCALE * ptPerPx;
  const cropTBPt = cropTB * RENDER_SCALE * ptPerPx;
  const contentWidthPt = baseVP.width - cropLRPt * 2;
  const scale = SHARED_BUF_W / contentWidthPt;
  const viewport = page.getViewport({ scale });

  const padX = Math.round(cropLRPt * scale);
  const padY = Math.round(cropTBPt * scale);

  const oc = document.createElement("canvas");
  oc.width = SHARED_BUF_W;
  oc.height = Math.max(1, Math.round(viewport.height) - padY * 2);

  const octx = oc.getContext("2d");
  octx.save();
  octx.translate(-padX, -padY);
  await page.render({ canvasContext: octx, viewport }).promise;
  octx.restore();

  return imageFromDataURL(oc.toDataURL());
}

function buildPageSelect(selectEl, totalEl, numPages) {
  selectEl.innerHTML = "";
  for (let i = 1; i <= numPages; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = "Page " + i;
    selectEl.appendChild(opt);
  }
  totalEl.textContent = "of " + numPages;
}

async function loadPDF(file, which) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const n = doc.numPages;

  if (which === "A") {
    state.pdfDocA = doc;
    buildPageSelect(el.pageSelA, el.totalPagesA, n);
    el.pickerA.classList.add("show");
    el.zoneA.classList.add("loaded");
    el.nameA.textContent = file.name;
    state.imgA = await renderPdfPage(
      doc,
      1,
      +el.cropTBA.value,
      +el.cropLRA.value,
    );
    collapseZone("A");

    el.pageSelA.onchange = async () => {
      state.imgA = await renderPdfPage(
        doc,
        +el.pageSelA.value,
        +el.cropTBA.value,
        +el.cropLRA.value,
      );
      checkReady(true);
    };
  } else {
    state.pdfDocB = doc;
    buildPageSelect(el.pageSelB, el.totalPagesB, n);
    el.pickerB.classList.add("show");
    el.zoneB.classList.add("loaded");
    el.nameB.textContent = file.name;
    state.imgB = await renderPdfPage(
      doc,
      1,
      +el.cropTBB.value,
      +el.cropLRB.value,
    );
    collapseZone("B");

    el.pageSelB.onchange = async () => {
      state.imgB = await renderPdfPage(
        doc,
        +el.pageSelB.value,
        +el.cropTBB.value,
        +el.cropLRB.value,
      );
      checkReady(true);
    };
  }
  checkReady();
}

/* ══════════════════════════════════════════
   HTML rendering
══════════════════════════════════════════ */

async function loadHTML(file) {
  const text = await file.text();
  const blob = new Blob([text], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    `position:fixed;left:-9999px;top:0;` +
    `width:${SHARED_CSS_W}px;height:2000px;` +
    `border:none;visibility:hidden;overflow:hidden;`;
  document.body.appendChild(iframe);
  iframe.src = url;

  await new Promise((res) =>
    iframe.addEventListener("load", res, { once: true }),
  );
  await delay(600);

  const iDoc = iframe.contentDocument;

  const ih = Math.min(
    Math.max(iDoc.body.scrollHeight, iDoc.documentElement.scrollHeight),
    8000,
  );
  iframe.style.height = ih + "px";
  await delay(150);

  const oc = await html2canvas(iDoc.body, {
    scale: RENDER_SCALE,
    useCORS: true,
    allowTaint: true,
    logging: false,
    width: SHARED_CSS_W,
    height: ih,
    windowWidth: SHARED_CSS_W,
    windowHeight: ih,
    x: 0,
    y: 0,
  });

  document.body.removeChild(iframe);
  URL.revokeObjectURL(url);

  return imageFromDataURL(oc.toDataURL());
}

/* ══════════════════════════════════════════
   Canvas display
══════════════════════════════════════════ */

function showImage(img) {
  if (!img) return;

  el.flashCanvas.width = img.width;
  el.flashCanvas.height = img.height;
  el.flashCanvas.style.width = SHARED_CSS_W + "px";
  el.flashCanvas.style.height = Math.round(img.height / RENDER_SCALE) + "px";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
}

function checkReady(redraw = false) {
  if (state.imgA && state.imgB) {
    el.placeholder.style.display = "none";
    el.flashCanvas.style.display = "block";
    if (!state.isRunning || redraw) {
      showImage(state.showing === "A" ? state.imgA : state.imgB);
    }
    el.startBtn.disabled = false;
  }
}

/* ══════════════════════════════════════════
   Flash engine
══════════════════════════════════════════ */

function flip() {
  state.showing = state.showing === "A" ? "B" : "A";
  showImage(state.showing === "A" ? state.imgA : state.imgB);
  state.cycles++;
  updateStatus();
}

function startFlash() {
  state.isRunning = true;
  state.timer = setInterval(flip, +el.speedSlider.value);
  el.startBtn.disabled = true;
  el.stopBtn.disabled = false;
  updateStatus();
}

function stopFlash() {
  state.isRunning = false;
  clearInterval(state.timer);
  state.timer = null;
  el.startBtn.disabled = false;
  el.stopBtn.disabled = true;
  updateStatus();
}

function updateStatus() {
  if (state.showing === "A") {
    el.dot.className = "dot show-a";
    el.showLbl.textContent = "Showing File A";
    el.showLbl.style.color = "#534AB7";
  } else {
    el.dot.className = "dot show-b";
    el.showLbl.textContent = "Showing File B";
    el.showLbl.style.color = "#0F6E56";
  }
  el.cycleCnt.textContent = state.isRunning
    ? state.cycles + " flips"
    : state.cycles > 0
      ? state.cycles + " flips total"
      : "";
}

/* ══════════════════════════════════════════
   File input events
══════════════════════════════════════════ */

el.fileA.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    el.errA.textContent = "Only PDF files are allowed for File A.";
    return;
  }
  el.errA.textContent = "";
  try {
    await loadPDF(file, "A");
  } catch {
    el.errA.textContent = "Could not load PDF. Please try another file.";
  }
});

el.fileB.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  el.errB.textContent = "";
  el.pickerB.classList.remove("show");

  if (name.endsWith(".pdf")) {
    try {
      await loadPDF(file, "B");
    } catch {
      el.errB.textContent = "Could not load PDF. Please try another file.";
    }
  } else if (name.endsWith(".html") || name.endsWith(".htm")) {
    el.nameB.textContent = "Rendering HTML…";
    try {
      state.imgB = await loadHTML(file);
      el.zoneB.classList.add("loaded");
      el.nameB.textContent = file.name;
      collapseZone("B");
      checkReady();
    } catch (err) {
      console.error(err);
      el.errB.textContent = "Could not render HTML file.";
      el.nameB.textContent = "";
    }
  } else {
    el.errB.textContent = "Only PDF or HTML files are allowed for File B.";
  }
});

/* ── Speed slider ── */
el.speedSlider.addEventListener("input", () => {
  el.speedVal.textContent = el.speedSlider.value + "ms";
  if (state.isRunning) {
    stopFlash();
    startFlash();
  }
});

/* ── Crop sliders ── */
const rerenderA = async () => {
  if (!state.pdfDocA) return;
  el.cropTBAVal.textContent = el.cropTBA.value;
  el.cropLRAVal.textContent = el.cropLRA.value;
  state.imgA = await renderPdfPage(
    state.pdfDocA,
    +el.pageSelA.value,
    +el.cropTBA.value,
    +el.cropLRA.value,
  );
  checkReady(true);
};
const rerenderB = async () => {
  if (!state.pdfDocB) return;
  el.cropTBBVal.textContent = el.cropTBB.value;
  el.cropLRBVal.textContent = el.cropLRB.value;
  state.imgB = await renderPdfPage(
    state.pdfDocB,
    +el.pageSelB.value,
    +el.cropTBB.value,
    +el.cropLRB.value,
  );
  checkReady(true);
};

el.cropTBA.addEventListener("input", () => {
  el.cropTBAVal.textContent = el.cropTBA.value;
});
el.cropLRA.addEventListener("input", () => {
  el.cropLRAVal.textContent = el.cropLRA.value;
});
el.cropTBB.addEventListener("input", () => {
  el.cropTBBVal.textContent = el.cropTBB.value;
});
el.cropLRB.addEventListener("input", () => {
  el.cropLRBVal.textContent = el.cropLRB.value;
});
el.cropTBA.addEventListener("change", rerenderA);
el.cropLRA.addEventListener("change", rerenderA);
el.cropTBB.addEventListener("change", rerenderB);
el.cropLRB.addEventListener("change", rerenderB);

/* ── Control buttons ── */
el.startBtn.addEventListener("click", () => {
  state.cycles = 0;
  startFlash();
});
el.stopBtn.addEventListener("click", stopFlash);

el.resetBtn.addEventListener("click", () => {
  stopFlash();
  state.pdfDocA = null;
  state.pdfDocB = null;
  state.imgA = null;
  state.imgB = null;
  state.cycles = 0;
  state.showing = "A";

  el.fileA.value = "";
  el.fileB.value = "";
  el.nameA.textContent = "";
  el.nameB.textContent = "";
  el.errA.textContent = "";
  el.errB.textContent = "";
  el.zoneA.classList.remove("loaded");
  el.zoneB.classList.remove("loaded");
  el.pickerA.classList.remove("show");
  el.pickerB.classList.remove("show");
  resetZone("A");
  resetZone("B");

  // reset crop sliders
  ["cropTBA", "cropLRA", "cropTBB", "cropLRB"].forEach((id) => {
    el[id].value = 0;
  });
  ["cropTBAVal", "cropLRAVal", "cropTBBVal", "cropLRBVal"].forEach((id) => {
    el[id].textContent = "0";
  });

  el.flashCanvas.style.display = "none";
  el.placeholder.style.display = "block";
  el.startBtn.disabled = true;
  el.stopBtn.disabled = true;
  el.dot.className = "dot";
  el.showLbl.textContent = "";
  el.cycleCnt.textContent = "";
});

/* ── Drag-and-drop ── */
[
  { zone: el.zoneA, inputId: "fileA" },
  { zone: el.zoneB, inputId: "fileB" },
].forEach(({ zone, inputId }) => {
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const inp = document.getElementById(inputId);
    const dt = new DataTransfer();
    dt.items.add(file);
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  });
});

/* ── Fullscreen ── */
const fullscreenBtn = document.getElementById("fullscreenBtn");
const fullscreenIcon = document.getElementById("fullscreenIcon");
const canvasWrap = document.getElementById("canvasWrap");

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    canvasWrap.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});
document.addEventListener("fullscreenchange", () => {
  fullscreenIcon.className = document.fullscreenElement
    ? "ti ti-arrows-minimize"
    : "ti ti-arrows-maximize";
  fullscreenBtn.title = document.fullscreenElement
    ? "Exit fullscreen"
    : "Toggle fullscreen";
});

/* ══════════════════════════════════════════
   Utilities
══════════════════════════════════════════ */
function imageFromDataURL(dataURL) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.src = dataURL;
  });
}
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
