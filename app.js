// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let originalPdfBytes = null;
let pdfJsDoc = null;
let totalPages = 0;
let currentPage = 1;

let globalBox = null;
let pageBoxes = {};

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

const pdfFileInput = document.getElementById("pdfFile");
const totalPagesEl = document.getElementById("totalPages");
const currentPageText = document.getElementById("currentPageText");
const pageCounter = document.getElementById("pageCounter");

const formatPreset = document.getElementById("formatPreset");
const customFormatBox = document.getElementById("customFormatBox");
const customFormat = document.getElementById("customFormat");
const paddingInput = document.getElementById("padding");
const verticalPos = document.getElementById("verticalPos");
const alignPos = document.getElementById("alignPos");
const fontSizeInput = document.getElementById("fontSize");
const fontSizeText = document.getElementById("fontSizeText");
const textColor = document.getElementById("textColor");
const applyAll = document.getElementById("applyAll");

const resetPositionBtn = document.getElementById("resetPosition");
const generatePdfBtn = document.getElementById("generatePdf");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");

const preview = document.getElementById("pdfPreview");
const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");
const numberBox = document.getElementById("numberBox");

function padNumber(num, length) {
  return String(num).padStart(length, "0");
}

function getTemplate() {
  if (formatPreset.value === "custom") {
    return customFormat.value || "{page}";
  }
  return formatPreset.value;
}

function makePageNumberText(page, total) {
  const padding = Number(paddingInput.value);
  const pageText = padNumber(page, padding);
  const totalText = padNumber(total, padding);

  return getTemplate()
    .replaceAll("{page}", pageText)
    .replaceAll("{total}", totalText);
}

function updateInfo() {
  totalPagesEl.textContent = totalPages;
  currentPageText.textContent = totalPages ? currentPage : 0;
  pageCounter.textContent = `Page ${totalPages ? currentPage : 0} of ${totalPages}`;
}

function getCurrentFontSizePx() {
  return Number(fontSizeInput.value);
}

function boxFromPixels(x, y, fontPx) {
  return {
    xRatio: x / canvas.width,
    yRatio: y / canvas.height,
    fontRatio: fontPx / canvas.height
  };
}

function applyBoxToScreen(box) {
  if (!box) return;

  const x = box.xRatio * canvas.width;
  const y = box.yRatio * canvas.height;
  const fontPx = box.fontRatio * canvas.height;

  numberBox.style.left = `${x}px`;
  numberBox.style.top = `${y}px`;
  numberBox.style.fontSize = `${fontPx}px`;

  fontSizeInput.value = Math.round(fontPx);
  fontSizeText.textContent = `${Math.round(fontPx)}px`;
}

function getActiveBox() {
  if (!applyAll.checked && pageBoxes[currentPage]) {
    return pageBoxes[currentPage];
  }

  return globalBox;
}

function saveActiveBox() {
  const x = parseFloat(numberBox.style.left) || 0;
  const y = parseFloat(numberBox.style.top) || 0;
  const fontPx = parseFloat(numberBox.style.fontSize) || getCurrentFontSizePx();

  const box = boxFromPixels(x, y, fontPx);

  if (applyAll.checked) {
    globalBox = box;
  } else {
    pageBoxes[currentPage] = box;
  }
}

function setDefaultPosition() {
  if (!canvas.width || !canvas.height) return;

  numberBox.textContent = makePageNumberText(currentPage, totalPages);
  numberBox.style.fontSize = `${getCurrentFontSizePx()}px`;
  numberBox.style.color = textColor.value;

  const margin = 35;
  const fontPx = getCurrentFontSizePx();

  let y;
  if (verticalPos.value === "header") {
    y = margin;
  } else {
    y = canvas.height - margin - fontPx;
  }

  let x;
  const boxWidth = numberBox.offsetWidth || 120;

  if (alignPos.value === "left") {
    x = margin;
  } else if (alignPos.value === "center") {
    x = canvas.width / 2 - boxWidth / 2;
  } else {
    x = canvas.width - boxWidth - margin;
  }

  x = Math.max(0, Math.min(x, canvas.width - boxWidth));
  y = Math.max(0, Math.min(y, canvas.height - fontPx - 5));

  const box = boxFromPixels(x, y, fontPx);

  if (applyAll.checked) {
    globalBox = box;
  } else {
    pageBoxes[currentPage] = box;
  }

  applyBoxToScreen(box);
}

async function renderPage() {
  if (!pdfJsDoc) return;

  const page = await pdfJsDoc.getPage(currentPage);

  const viewport = page.getViewport({ scale: 1.4 });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  preview.style.width = `${viewport.width}px`;
  preview.style.height = `${viewport.height}px`;

  await page.render({
    canvasContext: ctx,
    viewport: viewport
  }).promise;

  numberBox.textContent = makePageNumberText(currentPage, totalPages);
  numberBox.style.color = textColor.value;

  updateInfo();

  let activeBox = getActiveBox();

  if (!activeBox) {
    setDefaultPosition();
  } else {
    applyBoxToScreen(activeBox);
  }
}

pdfFileInput.addEventListener("change", async function () {
  const file = pdfFileInput.files[0];

  if (!file) return;

  if (file.type !== "application/pdf") {
    alert("Please select PDF file only.");
    return;
  }

  originalPdfBytes = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(originalPdfBytes.slice(0))
  });

  pdfJsDoc = await loadingTask.promise;
  totalPages = pdfJsDoc.numPages;
  currentPage = 1;

  globalBox = null;
  pageBoxes = {};

  updateInfo();
  await renderPage();
});

formatPreset.addEventListener("change", function () {
  if (formatPreset.value === "custom") {
    customFormatBox.classList.remove("hidden");
  } else {
    customFormatBox.classList.add("hidden");
  }

  if (pdfJsDoc) renderPage();
});

customFormat.addEventListener("input", function () {
  if (pdfJsDoc) renderPage();
});

paddingInput.addEventListener("change", function () {
  if (pdfJsDoc) renderPage();
});

verticalPos.addEventListener("change", function () {
  setDefaultPosition();
});

alignPos.addEventListener("change", function () {
  setDefaultPosition();
});

fontSizeInput.addEventListener("input", function () {
  const size = getCurrentFontSizePx();

  fontSizeText.textContent = `${size}px`;
  numberBox.style.fontSize = `${size}px`;

  saveActiveBox();
});

textColor.addEventListener("input", function () {
  numberBox.style.color = textColor.value;
});

applyAll.addEventListener("change", function () {
  if (!pdfJsDoc) return;

  const activeBox = getActiveBox();

  if (activeBox) {
    applyBoxToScreen(activeBox);
  } else {
    setDefaultPosition();
  }
});

resetPositionBtn.addEventListener("click", function () {
  if (!pdfJsDoc) {
    alert("Pehle PDF upload karo.");
    return;
  }

  setDefaultPosition();
});

prevPageBtn.addEventListener("click", async function () {
  if (!pdfJsDoc) return;

  saveActiveBox();

  if (currentPage > 1) {
    currentPage--;
    await renderPage();
  }
});

nextPageBtn.addEventListener("click", async function () {
  if (!pdfJsDoc) return;

  saveActiveBox();

  if (currentPage < totalPages) {
    currentPage++;
    await renderPage();
  }
});

// Drag number box
numberBox.addEventListener("mousedown", function (e) {
  if (!pdfJsDoc) return;

  isDragging = true;

  const rect = numberBox.getBoundingClientRect();

  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  e.preventDefault();
});

document.addEventListener("mousemove", function (e) {
  if (!isDragging) return;

  const previewRect = preview.getBoundingClientRect();

  let x = e.clientX - previewRect.left - dragOffsetX;
  let y = e.clientY - previewRect.top - dragOffsetY;

  const maxX = canvas.width - numberBox.offsetWidth;
  const maxY = canvas.height - numberBox.offsetHeight;

  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));

  numberBox.style.left = `${x}px`;
  numberBox.style.top = `${y}px`;
});

document.addEventListener("mouseup", function () {
  if (!isDragging) return;

  isDragging = false;
  saveActiveBox();
});

function hexToRgb01(hex) {
  hex = hex.replace("#", "");

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return { r, g, b };
}

function getBoxForPdfPage(pageNumber) {
  if (!applyAll.checked && pageBoxes[pageNumber]) {
    return pageBoxes[pageNumber];
  }

  if (globalBox) {
    return globalBox;
  }

  return {
    xRatio: 0.45,
    yRatio: 0.92,
    fontRatio: 0.02
  };
}

generatePdfBtn.addEventListener("click", async function () {
  if (!originalPdfBytes) {
    alert("Pehle PDF upload karo.");
    return;
  }

  saveActiveBox();

  generatePdfBtn.disabled = true;
  generatePdfBtn.textContent = "Generating...";

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const pdfDoc = await PDFDocument.load(originalPdfBytes.slice(0));
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const color = hexToRgb01(textColor.value);

    const total = pages.length;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNumber = i + 1;

      const { width, height } = page.getSize();

      const text = makePageNumberText(pageNumber, total);
      const box = getBoxForPdfPage(pageNumber);

      let fontSizePdf = box.fontRatio * height;
      fontSizePdf = Math.max(6, Math.min(fontSizePdf, 80));

      let x = box.xRatio * width;
      let y = height - (box.yRatio * height) - fontSizePdf;

      const textWidth = font.widthOfTextAtSize(text, fontSizePdf);

      x = Math.max(0, Math.min(x, width - textWidth));
      y = Math.max(0, Math.min(y, height - fontSizePdf));

      page.drawText(text, {
        x: x,
        y: y,
        size: fontSizePdf,
        font: font,
        color: rgb(color.r, color.g, color.b)
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();

    const blob = new Blob([modifiedPdfBytes], {
      type: "application/pdf"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "numbered-pdf.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

  } catch (error) {
    console.error(error);
    alert("PDF generate nahi ho saki. Agar PDF password protected hai to pehle unlock karo.");
  }

  generatePdfBtn.disabled = false;
  generatePdfBtn.textContent = "Generate & Download PDF";
});