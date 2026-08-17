/* ============================================================
   PDF TUTOR
   PDF VIEWER + AI
   (shared across index.html and assistant.html — every element
    lookup is guarded, since each page only has half the DOM)
   ============================================================ */

if (typeof pdfjsLib !== "undefined") {

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

}


/* ============================================================
   CURRENT PAGE
   ============================================================ */

const CURRENT_PAGE =
  document.body.dataset.page || "workspace";


/* ============================================================
   LOCAL STORAGE KEYS
   (used to share PDF context between index.html and
    assistant.html)
   ============================================================ */

const LS_FILE_NAME = "pdftutor:fileName";
const LS_FILE_SIZE = "pdftutor:fileSize";
const LS_PDF_TEXT = "pdftutor:pdfText";
const LS_CHUNKS = "pdftutor:chunks";
const LS_PENDING_EXPLAIN = "pdftutor:pendingExplain";


/* ============================================================
   STATE
   ============================================================ */

const state = {
  fileName: null,
  fileSize: null,
  pdfText: "",
  chunks: [],
  pdfUrl: null,
  isAsking: false,
  isExplaining: false
};


/* ============================================================
   ELEMENTS
   (any of these may be null depending on the current page —
    every usage below is guarded)
   ============================================================ */

const pdfInput = document.getElementById("pdfInput");
const uploadArea = document.getElementById("uploadArea");
const fileInfo = document.getElementById("fileInfo");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");
const fileStatusEl = document.getElementById("fileStatus");
const removePdfBtn = document.getElementById("removePdfBtn");

const readerBox = document.getElementById("readerBox");
const selectionActions =
  document.getElementById("selectionActions");
const explainSelectionBtn =
  document.getElementById("explainSelectionBtn");

const questionInput =
  document.getElementById("questionInput");
const askBtn =
  document.getElementById("askBtn");
const askStatus =
  document.getElementById("askStatus");
const answerBox =
  document.getElementById("answerBox");
const questionCharCounter =
  document.getElementById("questionCharCounter");

const explainInput =
  document.getElementById("explainInput");
const explainBtn =
  document.getElementById("explainBtn");
const explainStatus =
  document.getElementById("explainStatus");
const explanationBox =
  document.getElementById("explanationBox");
const explainCharCounter =
  document.getElementById("explainCharCounter");

const explainPreview =
  document.getElementById("explainPreview");
const explainPreviewText =
  document.getElementById("explainPreviewText");
const explainPreviewClear =
  document.getElementById("explainPreviewClear");

const activePdfLoaded =
  document.getElementById("activePdfLoaded");
const activePdfEmpty =
  document.getElementById("activePdfEmpty");
const activePdfName =
  document.getElementById("activePdfName");


/* ============================================================
   UNIT BUTTONS
   ============================================================ */

document.querySelectorAll(".unit-card").forEach((button) => {

  button.addEventListener("click", async () => {

    const pdfPath = button.dataset.pdf;
    const pdfName =
      button.dataset.name || pdfPath;

    await loadDefaultPdf(
      pdfPath,
      pdfName
    );

  });

});


/* ============================================================
   HELPERS
   ============================================================ */

function formatFileSize(bytes) {

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


function setStatus(element, message, type = "") {

  if (!element) {
    return;
  }

  element.textContent = message || "";

  element.classList.remove("error");

  if (type === "error") {
    element.classList.add("error");
  }
}


function setFileStatus(message, type = "") {

  if (!fileStatusEl) {
    return;
  }

  fileStatusEl.textContent = message || "";

  fileStatusEl.classList.remove(
    "error",
    "success"
  );

  if (type) {
    fileStatusEl.classList.add(type);
  }
}


function setButtonLoading(button, loading) {

  if (!button) {
    return;
  }

  const label = button.querySelector(".btn-label");
  const spinner = button.querySelector(".btn-spinner");

  button.disabled = loading;

  if (spinner) {
    spinner.hidden = !loading;
  }

  if (label) {
    label.style.opacity = loading ? "0.7" : "1";
  }

}


function setupCharCounter(textarea, counter) {

  if (!textarea || !counter) {
    return;
  }

  const max = textarea.getAttribute("maxlength") || "";

  const update = () => {
    counter.textContent = `${textarea.value.length} / ${max}`;
  };

  textarea.addEventListener("input", update);

  update();

}

setupCharCounter(questionInput, questionCharCounter);
setupCharCounter(explainInput, explainCharCounter);


/* ============================================================
   SHARE PDF CONTEXT BETWEEN PAGES (localStorage)
   ============================================================ */

function saveContextToStorage() {

  try {

    if (state.fileName) {
      localStorage.setItem(LS_FILE_NAME, state.fileName);
    } else {
      localStorage.removeItem(LS_FILE_NAME);
    }

    if (state.fileSize != null) {
      localStorage.setItem(LS_FILE_SIZE, String(state.fileSize));
    } else {
      localStorage.removeItem(LS_FILE_SIZE);
    }

    localStorage.setItem(LS_PDF_TEXT, state.pdfText || "");

    localStorage.setItem(
      LS_CHUNKS,
      JSON.stringify(state.chunks || [])
    );

  } catch (storageError) {

    // Storage can fail (private browsing, quota, etc.) —
    // the AI assistant still works within the same page/session.
    console.warn(
      "Could not save PDF context to localStorage:",
      storageError
    );

  }

}


function clearContextFromStorage() {

  try {

    localStorage.removeItem(LS_FILE_NAME);
    localStorage.removeItem(LS_FILE_SIZE);
    localStorage.removeItem(LS_PDF_TEXT);
    localStorage.removeItem(LS_CHUNKS);

  } catch (storageError) {

    console.warn(
      "Could not clear PDF context from localStorage:",
      storageError
    );

  }

}


function loadContextFromStorage() {

  try {

    const fileName = localStorage.getItem(LS_FILE_NAME);
    const fileSize = localStorage.getItem(LS_FILE_SIZE);
    const pdfText = localStorage.getItem(LS_PDF_TEXT);
    const chunksRaw = localStorage.getItem(LS_CHUNKS);

    state.fileName = fileName || null;
    state.fileSize = fileSize ? Number(fileSize) : null;
    state.pdfText = pdfText || "";

    try {
      state.chunks = chunksRaw ? JSON.parse(chunksRaw) : [];
    } catch (parseError) {
      state.chunks = [];
    }

  } catch (storageError) {

    console.warn(
      "Could not load PDF context from localStorage:",
      storageError
    );

  }

}


function refreshActivePdfBanner() {

  if (!activePdfLoaded || !activePdfEmpty) {
    return;
  }

  if (state.pdfText && state.fileName) {

    activePdfLoaded.hidden = false;
    activePdfEmpty.hidden = true;

    if (activePdfName) {
      activePdfName.textContent = state.fileName;
    }

  } else {

    activePdfLoaded.hidden = true;
    activePdfEmpty.hidden = false;

  }

}


/* ============================================================
   CHUNK TEXT FOR AI
   ============================================================ */

function chunkText(text, size = 1500) {

  const chunks = [];

  let start = 0;

  while (start < text.length) {

    let end =
      Math.min(
        start + size,
        text.length
      );

    if (end < text.length) {

      const breakPoint =
        text.lastIndexOf(
          "\n",
          end
        );

      if (
        breakPoint >
        start + size * 0.5
      ) {
        end = breakPoint;
      }

    }

    const chunk =
      text
        .slice(start, end)
        .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    start = end;
  }

  return chunks;
}


/* ============================================================
   RELEVANT CONTEXT FOR AI
   ============================================================ */

function getRelevantContext(
  query,
  maxChars = 6000
) {

  if (!state.pdfText) {
    return "";
  }

  if (
    state.pdfText.length <=
    maxChars
  ) {
    return state.pdfText;
  }


  const words =
    query
      .toLowerCase()
      .replace(
        /[^a-z0-9\s]/g,
        " "
      )
      .split(/\s+/)
      .filter(
        word => word.length > 2
      );


  const scored =
    state.chunks.map(chunk => {

      const lower =
        chunk.toLowerCase();

      let score = 0;

      words.forEach(word => {

        score +=
          lower.split(word).length - 1;

      });

      return {
        chunk,
        score
      };

    });


  scored.sort(
    (a, b) =>
      b.score - a.score
  );


  let result = "";


  for (const item of scored) {

    if (
      item.score <= 0 &&
      result.length > 0
    ) {
      break;
    }

    if (
      result.length +
      item.chunk.length >
      maxChars
    ) {
      break;
    }

    result +=
      item.chunk +
      "\n\n";

  }


  if (!result.trim()) {

    result =
      state.pdfText.slice(
        0,
        maxChars
      );

  }


  return result.trim();
}


/* ============================================================
   AI RESPONSE FORMATTER
   (supports paragraphs, bullet/numbered lists, ### headings,
    **bold**, `inline code`, and ``` code blocks)
   ============================================================ */

function renderInline(text) {

  // Escape HTML first, then re-apply light markdown formatting.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

}


function renderFormattedText(
  container,
  text
) {

  container.innerHTML = "";

  const lines =
    (text || "").split("\n");

  let list = null;
  let listType = null;
  let codeBlock = null;
  let inCodeBlock = false;


  function closeList() {

    if (list) {

      container.appendChild(list);

      list = null;
      listType = null;

    }

  }


  lines.forEach(rawLine => {

    const line = rawLine.trim();


    // Fenced code blocks ```
    if (line.startsWith("```")) {

      if (!inCodeBlock) {

        closeList();

        inCodeBlock = true;

        codeBlock = document.createElement("pre");

        const codeEl = document.createElement("code");

        codeBlock.appendChild(codeEl);

      } else {

        container.appendChild(codeBlock);

        inCodeBlock = false;
        codeBlock = null;

      }

      return;

    }

    if (inCodeBlock) {

      const codeEl = codeBlock.querySelector("code");

      codeEl.textContent +=
        (codeEl.textContent ? "\n" : "") + rawLine;

      return;

    }


    if (!line) {

      closeList();

      return;

    }


    const heading =
      line.match(/^#{1,3}\s+(.*)/);

    const bullet =
      line.match(
        /^[-*]\s+(.*)/
      );


    const numbered =
      line.match(
        /^\d+[.)]\s+(.*)/
      );


    if (heading) {

      closeList();

      const h =
        document.createElement("h3");

      h.innerHTML = renderInline(heading[1]);

      container.appendChild(h);

    }

    else if (bullet) {

      if (listType !== "ul") {

        closeList();

        list =
          document.createElement(
            "ul"
          );

        listType = "ul";

      }


      const li =
        document.createElement(
          "li"
        );

      li.innerHTML =
        renderInline(bullet[1]);

      list.appendChild(li);

    }

    else if (numbered) {

      if (listType !== "ol") {

        closeList();

        list =
          document.createElement(
            "ol"
          );

        listType = "ol";

      }


      const li =
        document.createElement(
          "li"
        );

      li.innerHTML =
        renderInline(numbered[1]);

      list.appendChild(li);

    }

    else {

      closeList();

      const p =
        document.createElement(
          "p"
        );

      p.innerHTML = renderInline(line);

      container.appendChild(p);

    }

  });


  closeList();

  if (inCodeBlock && codeBlock) {
    container.appendChild(codeBlock);
  }

}


/* ============================================================
   CREATE PDF VIEWER
   ============================================================ */

function createPdfViewer() {

  readerBox.innerHTML = `

    <div class="pdf-viewer">

      <div class="pdf-toolbar">

        <button
          type="button"
          class="pdf-tool-btn"
          id="pdfZoomOut"
          aria-label="Zoom out"
        >
          −
        </button>

        <span
          class="pdf-zoom-value"
          id="pdfZoomValue"
        >
          100%
        </span>

        <button
          type="button"
          class="pdf-tool-btn"
          id="pdfZoomIn"
          aria-label="Zoom in"
        >
          +
        </button>

        <div class="pdf-toolbar-divider"></div>

        <button
          type="button"
          class="pdf-tool-btn pdf-fit-btn"
          id="pdfFitBtn"
        >
          Fit width
        </button>

        <button
          type="button"
          class="pdf-tool-btn pdf-reset-btn"
          id="pdfResetBtn"
        >
          Reset
        </button>

        <span
          class="pdf-page-info"
          id="pdfPageInfo"
        >
          Loading...
        </span>

      </div>

      <div
        class="pdf-pages"
        id="pdfPages"
      ></div>

    </div>

  `;


  const zoomOut =
    document.getElementById(
      "pdfZoomOut"
    );

  const zoomIn =
    document.getElementById(
      "pdfZoomIn"
    );

  const fit =
    document.getElementById(
      "pdfFitBtn"
    );

  const reset =
    document.getElementById(
      "pdfResetBtn"
    );


  zoomOut.addEventListener(
    "click",
    () => {

      if (
        window.currentPdfViewer
      ) {

        window.currentPdfViewer.setZoom(
          window.currentPdfViewer.zoom - 0.1
        );

      }

    }
  );


  zoomIn.addEventListener(
    "click",
    () => {

      if (
        window.currentPdfViewer
      ) {

        window.currentPdfViewer.setZoom(
          window.currentPdfViewer.zoom + 0.1
        );

      }

    }
  );


  fit.addEventListener(
    "click",
    () => {

      if (
        window.currentPdfViewer
      ) {

        window.currentPdfViewer.fitWidth();

      }

    }
  );


  reset.addEventListener(
    "click",
    () => {

      if (
        window.currentPdfViewer
      ) {

        window.currentPdfViewer.setZoom(1);

      }

    }
  );

}


/* ============================================================
   RENDER ACTUAL PDF PAGES
   (canvas layer + selectable text layer, per PDF.js's
    recommended two-layer approach)
   ============================================================ */

async function renderPdfViewer(
  arrayBuffer
) {

  createPdfViewer();


  const pagesContainer =
    document.getElementById(
      "pdfPages"
    );

  const pageInfo =
    document.getElementById(
      "pdfPageInfo"
    );


  const loadingTask =
    pdfjsLib.getDocument({
      data: arrayBuffer
    });


  const pdf =
    await loadingTask.promise;


  const viewer = {

    pdf,

    zoom: 1,

    setZoom(value) {

      this.zoom =
        Math.max(
          0.6,
          Math.min(
            2.5,
            value
          )
        );

      this.renderAll();

    },

    fitWidth() {

      const firstStack =
        pagesContainer.querySelector(
          ".pdf-page-stack"
        );

      if (!firstStack) {
        return;
      }

      const availableWidth =
        pagesContainer.clientWidth -
        20;

      const currentWidth =
        parseFloat(firstStack.style.width) ||
        600;

      const currentZoom =
        this.zoom || 1;

      const baseWidth =
        currentWidth / currentZoom;

      this.zoom =
        Math.max(
          0.6,
          Math.min(
            2.0,
            availableWidth /
            baseWidth
          )
        );

      this.renderAll();

    },

    async renderAll() {

      pagesContainer.innerHTML = "";

      document.getElementById(
        "pdfZoomValue"
      ).textContent =
        `${Math.round(this.zoom * 100)}%`;

      pageInfo.textContent =
        `${pdf.numPages} pages`;


      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {

        const page =
          await pdf.getPage(
            pageNumber
          );


        const viewport =
          page.getViewport({
            scale:
              this.zoom
          });


        const wrapper =
          document.createElement(
            "div"
          );

        wrapper.className =
          "pdf-page-wrapper";


        const pageLabel =
          document.createElement(
            "div"
          );

        pageLabel.className =
          "pdf-page-label";

        pageLabel.textContent =
          `Page ${pageNumber} of ${pdf.numPages}`;


        // Stack holds the canvas (pixels) and the text layer
        // (invisible, selectable text) on top of each other.
        const stack =
          document.createElement(
            "div"
          );

        stack.className =
          "pdf-page-stack";

        stack.style.width =
          `${viewport.width}px`;

        stack.style.height =
          `${viewport.height}px`;


        const canvas =
          document.createElement(
            "canvas"
          );


        const context =
          canvas.getContext(
            "2d"
          );


        const outputScale =
          window.devicePixelRatio ||
          1;


        canvas.width =
          Math.floor(
            viewport.width *
            outputScale
          );


        canvas.height =
          Math.floor(
            viewport.height *
            outputScale
          );


        context.setTransform(
          outputScale,
          0,
          0,
          outputScale,
          0,
          0
        );


        // Text layer: rendered from the page's real text
        // content, positioned exactly over the canvas so the
        // user can drag-select and copy real text. The canvas
        // sits visually underneath and never intercepts
        // pointer events (see .pdf-page-stack canvas CSS),
        // so mouse drag-select, right-click copy, Ctrl+C and
        // mobile long-press selection all hit the text layer.
        const textLayerDiv =
          document.createElement(
            "div"
          );

        textLayerDiv.className =
          "textLayer";

        textLayerDiv.style.width =
          `${viewport.width}px`;

        textLayerDiv.style.height =
          `${viewport.height}px`;

        textLayerDiv.style.setProperty(
          "--scale-factor",
          String(this.zoom || 1)
        );


        stack.appendChild(canvas);
        stack.appendChild(textLayerDiv);

        wrapper.appendChild(
          pageLabel
        );

        wrapper.appendChild(
          stack
        );

        pagesContainer.appendChild(
          wrapper
        );


        await page.render({
          canvasContext:
            context,

          viewport
        }).promise;


        try {

          const textContent =
            await page.getTextContent();

          const renderTask =
            pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport,
              textDivs: []
            });

          await renderTask.promise;

        } catch (textLayerError) {

          // Selectable text is a progressive enhancement —
          // if it fails, the rendered page image still works.
          console.warn(
            "Text layer render failed:",
            textLayerError
          );

        }

      }

    }

  };


  window.currentPdfViewer =
    viewer;


  await viewer.renderAll();

}


/* ============================================================
   EXTRACT TEXT FROM PDF
   ============================================================ */

async function extractPdfText(
  arrayBuffer
) {

  const loadingTask =
    pdfjsLib.getDocument({
      data: arrayBuffer
    });


  const pdf =
    await loadingTask.promise;


  let fullText = "";


  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {

    const page =
      await pdf.getPage(
        pageNumber
      );


    const content =
      await page.getTextContent();


    const pageText =
      content.items
        .map(
          item => item.str
        )
        .join(" ");


    fullText +=
      pageText.trim() +
      "\n\n";

  }


  return fullText.trim();
}


/* ============================================================
   LOAD DEFAULT ADS PDF
   ============================================================ */

async function loadDefaultPdf(
  pdfPath,
  pdfName
) {

  try {

    uploadArea.hidden = true;

    fileInfo.hidden = false;


    fileNameEl.textContent =
      pdfName;

    fileSizeEl.textContent =
      "Loading...";


    setFileStatus(
      "Opening PDF...",
      ""
    );


    readerBox.innerHTML = `

      <div class="reader-placeholder">

        <div class="placeholder-icon">
          ⏳
        </div>

        <div>
          Opening PDF...
        </div>

      </div>

    `;


    /*
      Fetch the actual PDF from
      your Render website.
    */

    const response =
      await fetch(
        pdfPath
      );


    if (!response.ok) {

      throw new Error(
        `Could not find ${pdfPath}`
      );

    }


    const arrayBuffer =
      await response.arrayBuffer();


    state.fileName =
      pdfName;

    state.fileSize =
      arrayBuffer.byteLength;


    fileNameEl.textContent =
      pdfName;

    fileSizeEl.textContent =
      formatFileSize(
        arrayBuffer.byteLength
      );


    /*
      1. Render actual PDF pages (with selectable text layer)
      2. Extract text separately
      3. Keep text for AI
    */

    await renderPdfViewer(
      arrayBuffer.slice(0)
    );


    state.pdfText =
      await extractPdfText(
        arrayBuffer.slice(0)
      );


    state.chunks =
      chunkText(
        state.pdfText
      );


    // Make the PDF text/chunks/name available to the
    // AI Assistant page.
    saveContextToStorage();


    setFileStatus(
      "PDF opened successfully.",
      "success"
    );


    document
      .querySelector(
        ".reader-card"
      )
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

  }

  catch (error) {

    console.error(
      "PDF loading error:",
      error
    );


    state.pdfText = "";

    state.chunks = [];

    clearContextFromStorage();


    setFileStatus(
      "Could not open this PDF.",
      "error"
    );


    readerBox.innerHTML = `

      <div class="reader-placeholder">

        <div class="placeholder-icon">
          ⚠️
        </div>

        <div>
          ${error.message}
        </div>

        <div style="font-size:0.8rem;margin-top:6px;">
          Make sure the PDF is uploaded to the
          same GitHub project and the filename is exact.
        </div>

      </div>

    `;

  }

}


/* ============================================================
   NORMAL PDF UPLOAD
   ============================================================ */

if (pdfInput) {

  pdfInput.addEventListener(
    "change",
    async () => {

      const file =
        pdfInput.files[0];


      if (!file) {
        return;
      }


      if (
        file.type !==
        "application/pdf"
      ) {

        setFileStatus(
          "Please select a PDF file.",
          "error"
        );

        return;
      }


      try {

        uploadArea.hidden = true;

        fileInfo.hidden = false;


        fileNameEl.textContent =
          file.name;

        fileSizeEl.textContent =
          formatFileSize(
            file.size
          );


        setFileStatus(
          "Opening PDF...",
          ""
        );


        const arrayBuffer =
          await file.arrayBuffer();


        await renderPdfViewer(
          arrayBuffer.slice(0)
        );


        state.fileName =
          file.name;

        state.fileSize =
          file.size;


        state.pdfText =
          await extractPdfText(
            arrayBuffer.slice(0)
          );


        state.chunks =
          chunkText(
            state.pdfText
          );


        // Make the PDF text/chunks/name available to the
        // AI Assistant page.
        saveContextToStorage();


        setFileStatus(
          "PDF opened successfully.",
          "success"
        );


      }

      catch (error) {

        console.error(error);


        setFileStatus(
          "Could not open this PDF.",
          "error"
        );


        state.pdfText = "";

        state.chunks = [];

        clearContextFromStorage();

      }

    }
  );

}


/* ============================================================
   REMOVE PDF
   ============================================================ */

if (removePdfBtn) {

  removePdfBtn.addEventListener(
    "click",
    () => {

      state.fileName = null;

      state.fileSize = null;

      state.pdfText = "";

      state.chunks = [];

      clearContextFromStorage();


      uploadArea.hidden = false;

      fileInfo.hidden = true;


      pdfInput.value = "";


      readerBox.innerHTML = `

        <div class="reader-placeholder">

          <div class="placeholder-icon">
            📄
          </div>

          <div>
            Select an ADS unit above or upload a PDF.
          </div>

        </div>

      `;


      if (selectionActions) {
        selectionActions.hidden = true;
      }

      if (answerBox) {
        answerBox.hidden = true;
      }

      if (explanationBox) {
        explanationBox.hidden = true;
      }

      hideExplainPreview();


      setStatus(
        askStatus,
        ""
      );

      setStatus(
        explainStatus,
        ""
      );

    }
  );

}


/* ============================================================
   TEXT SELECTION
   (mouseup for desktop drag-select, selectionchange as a
    mobile-friendly fallback for touch/long-press selection)
   ============================================================ */

function handleSelectionUpdate() {

  if (!readerBox || !selectionActions) {
    return;
  }

  const selection =
    window.getSelection();

  const selected =
    selection.toString().trim();


  if (!selected) {
    return;
  }


  // Only react to selections made inside the document reader.
  const anchorNode =
    selection.anchorNode;

  if (
    !anchorNode ||
    !readerBox.contains(
      anchorNode.nodeType === 1
        ? anchorNode
        : anchorNode.parentNode
    )
  ) {
    return;
  }


  selectionActions.hidden = false;

  selectionActions.dataset.selectedText =
    selected;

}


if (readerBox) {

  readerBox.addEventListener(
    "mouseup",
    handleSelectionUpdate
  );

  readerBox.addEventListener(
    "touchend",
    () => {
      // Give the browser a moment to finalize the touch selection.
      setTimeout(
        handleSelectionUpdate,
        120
      );
    }
  );

}


if (explainSelectionBtn) {

  explainSelectionBtn.addEventListener(
    "click",
    () => {

      const selected =
        selectionActions.dataset.selectedText ||
        "";

      if (!selected) {
        return;
      }

      // Hand the selected text to the AI Assistant page via
      // localStorage, then open it — this works across pages.
      try {

        localStorage.setItem(
          LS_PENDING_EXPLAIN,
          selected
        );

      } catch (storageError) {

        console.warn(
          "Could not store pending explain text:",
          storageError
        );

      }

      window.location.href = "assistant.html";

    }
  );

}


/* ============================================================
   SELECTED-TEXT PREVIEW (Explain card)
   ============================================================ */

function showExplainPreview(text) {

  if (!text || !explainInput) {
    return;
  }

  explainInput.value = text;

  if (explainCharCounter) {

    explainCharCounter.textContent =
      `${explainInput.value.length} / ${explainInput.getAttribute("maxlength")}`;

  }

  if (explainPreviewText) {
    explainPreviewText.textContent = text;
  }

  if (explainPreview) {
    explainPreview.hidden = false;
  }

}


function hideExplainPreview() {

  if (explainPreview) {
    explainPreview.hidden = true;
  }

  if (explainPreviewText) {
    explainPreviewText.textContent = "";
  }

}


if (explainPreviewClear) {

  explainPreviewClear.addEventListener(
    "click",
    () => {

      hideExplainPreview();

      explainInput.value = "";

      explainCharCounter.textContent =
        `0 / ${explainInput.getAttribute("maxlength")}`;

      explainInput.focus();

    }
  );

}


/* ============================================================
   ASK AI
   ============================================================ */

if (askBtn) {

  askBtn.addEventListener(
    "click",
    handleAsk
  );

}


async function handleAsk() {

  const question =
    questionInput.value.trim();


  if (!state.pdfText) {

    setStatus(
      askStatus,
      "Please select or upload a PDF first.",
      "error"
    );

    return;

  }


  if (!question) {

    setStatus(
      askStatus,
      "Please enter a question.",
      "error"
    );

    return;

  }


  const context =
    getRelevantContext(
      question
    );


  state.isAsking = true;

  setButtonLoading(askBtn, true);


  setStatus(
    askStatus,
    "Thinking...",
    ""
  );


  answerBox.hidden = true;


  try {

    const response =
      await fetch(
        "/api/ask",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            question,
            pdfText: context
          })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.error ||
        "Something went wrong while getting the answer."
      );

    }


    setStatus(
      askStatus,
      ""
    );


    answerBox.hidden =
      false;


    renderFormattedText(
      answerBox,
      data.answer
    );

  }

  catch (error) {

    console.error(error);


    setStatus(
      askStatus,
      error.message ||
      "Something went wrong while getting the answer.",
      "error"
    );

  }

  finally {

    state.isAsking = false;

    setButtonLoading(askBtn, false);

  }

}


/* ============================================================
   EXPLAIN
   ============================================================ */

if (explainBtn) {

  explainBtn.addEventListener(
    "click",
    handleExplain
  );

}


async function handleExplain() {

  const selectedLine =
    explainInput.value.trim();


  if (!selectedLine) {

    setStatus(
      explainStatus,
      "Please enter a sentence to explain.",
      "error"
    );

    return;

  }


  const pdfContext =
    state.pdfText
      ? getRelevantContext(
          selectedLine,
          4000
        )
      : "";


  state.isExplaining = true;

  setButtonLoading(explainBtn, true);


  setStatus(
    explainStatus,
    "Generating explanation...",
    ""
  );


  explanationBox.hidden =
    true;


  try {

    const response =
      await fetch(
        "/api/explain",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            selectedLine,
            pdfContext
          })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.error ||
        "Something went wrong while generating the explanation."
      );

    }


    setStatus(
      explainStatus,
      ""
    );


    explanationBox.hidden =
      false;


    renderFormattedText(
      explanationBox,
      data.explanation
    );

  }

  catch (error) {

    console.error(error);


    setStatus(
      explainStatus,
      error.message ||
      "Something went wrong while generating the explanation.",
      "error"
    );

  }

  finally {

    state.isExplaining = false;

    setButtonLoading(explainBtn, false);

  }

}


/* ============================================================
   PAGE INIT
   ============================================================ */

if (CURRENT_PAGE === "assistant") {

  // Restore whatever PDF was loaded on the Workspace page.
  loadContextFromStorage();

  refreshActivePdfBanner();


  // If the user tapped "Explain selected text" on the
  // Workspace page, auto-fill the Explain textarea here.
  try {

    const pending =
      localStorage.getItem(LS_PENDING_EXPLAIN);

    if (pending) {

      showExplainPreview(pending);

      localStorage.removeItem(LS_PENDING_EXPLAIN);

    }

  } catch (storageError) {

    console.warn(
      "Could not read pending explain text:",
      storageError
    );

  }

}
