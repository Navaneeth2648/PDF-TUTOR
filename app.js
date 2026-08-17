/* ============================================================
   PDF TUTOR
   PDF VIEWER + AI
   ============================================================ */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


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

  element.textContent = message || "";

  element.classList.remove("error");

  if (type === "error") {
    element.classList.add("error");
  }
}


function setFileStatus(message, type = "") {

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
        // user can drag-select and copy real text.
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


      state.pdfText =
        await extractPdfText(
          arrayBuffer.slice(0)
        );


      state.chunks =
        chunkText(
          state.pdfText
        );


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

    }

  }
);


/* ============================================================
   REMOVE PDF
   ============================================================ */

removePdfBtn.addEventListener(
  "click",
  () => {

    state.fileName = null;

    state.fileSize = null;

    state.pdfText = "";

    state.chunks = [];


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


    selectionActions.hidden = true;

    answerBox.hidden = true;

    explanationBox.hidden = true;

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


/* ============================================================
   TEXT SELECTION
   (mouseup for desktop drag-select, selectionchange as a
    mobile-friendly fallback for touch/long-press selection)
   ============================================================ */

function handleSelectionUpdate() {

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


explainSelectionBtn.addEventListener(
  "click",
  () => {

    const selected =
      selectionActions.dataset.selectedText ||
      "";


    showExplainPreview(selected);


    explainInput.focus();


    document
      .getElementById(
        "assistantSection"
      )
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

  }
);


/* ============================================================
   SELECTED-TEXT PREVIEW (Explain card)
   ============================================================ */

function showExplainPreview(text) {

  if (!text) {
    return;
  }

  explainInput.value = text;

  explainCharCounter.textContent =
    `${explainInput.value.length} / ${explainInput.getAttribute("maxlength")}`;

  explainPreviewText.textContent = text;

  explainPreview.hidden = false;

}


function hideExplainPreview() {

  explainPreview.hidden = true;

  explainPreviewText.textContent = "";

}


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


/* ============================================================
   ASK AI
   ============================================================ */

askBtn.addEventListener(
  "click",
  handleAsk
);


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

explainBtn.addEventListener(
  "click",
  handleExplain
);


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
