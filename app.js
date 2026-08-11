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

const explainInput =
  document.getElementById("explainInput");
const explainBtn =
  document.getElementById("explainBtn");
const explainStatus =
  document.getElementById("explainStatus");
const explanationBox =
  document.getElementById("explanationBox");


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
   ============================================================ */

function renderFormattedText(
  container,
  text
) {

  container.innerHTML = "";

  const lines =
    text.split("\n");

  let list = null;
  let listType = null;


  function closeList() {

    if (list) {

      container.appendChild(list);

      list = null;
      listType = null;

    }

  }


  lines.forEach(rawLine => {

    const line =
      rawLine.trim();


    if (!line) {

      closeList();

      return;

    }


    const bullet =
      line.match(
        /^[-*]\s+(.*)/
      );


    const numbered =
      line.match(
        /^\d+[.)]\s+(.*)/
      );


    if (bullet) {

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

      li.textContent =
        bullet[1];

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

      li.textContent =
        numbered[1];

      list.appendChild(li);

    }

    else {

      closeList();

      const p =
        document.createElement(
          "p"
        );

      p.textContent = line;

      container.appendChild(p);

    }

  });


  closeList();
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
        >
          +
        </button>

        <button
          type="button"
          class="pdf-tool-btn pdf-fit-btn"
          id="pdfFitBtn"
        >
          Fit
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

}


/* ============================================================
   RENDER ACTUAL PDF PAGES
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

      const firstPage =
        pagesContainer.querySelector(
          ".pdf-page-wrapper"
        );

      if (!firstPage) {
        return;
      }

      const availableWidth =
        pagesContainer.clientWidth -
        20;

      const pageWidth =
        firstPage
          .querySelector("canvas")
          ?.width || 600;

      this.zoom =
        Math.max(
          0.6,
          Math.min(
            2.0,
            availableWidth /
            pageWidth
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


        const baseViewport =
          page.getViewport({
            scale: 1
          });


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


        canvas.style.width =
          `${viewport.width}px`;

        canvas.style.height =
          `${viewport.height}px`;


        context.setTransform(
          outputScale,
          0,
          0,
          outputScale,
          0,
          0
        );


        wrapper.appendChild(
          pageLabel
        );

        wrapper.appendChild(
          canvas
        );

        pagesContainer.appendChild(
          wrapper
        );


        await page.render({
          canvasContext:
            context,

          viewport
        }).promise;

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
      1. Render actual PDF pages
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
   ============================================================ */

readerBox.addEventListener(
  "mouseup",
  () => {

    const selected =
      window
        .getSelection()
        .toString()
        .trim();


    if (selected) {

      selectionActions.hidden =
        false;

      selectionActions.dataset.selectedText =
        selected;

    }

  }
);


explainSelectionBtn.addEventListener(
  "click",
  () => {

    const selected =
      selectionActions.dataset.selectedText ||
      "";


    explainInput.value =
      selected;


    explainInput.focus();


    explainInput.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

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

  askBtn.disabled = true;


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

    askBtn.disabled = false;

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

  explainBtn.disabled = true;


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

    explainBtn.disabled = false;

  }

}
