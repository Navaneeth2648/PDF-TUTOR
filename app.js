/* ============================================================
   PDF TUTOR
   Frontend application logic
   ============================================================ */


/* =========================
   PDF.JS
========================= */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


/* =========================
   APPLICATION STATE
========================= */

const state = {
  fileName: null,
  fileSize: null,
  pdfText: "",
  chunks: [],
  isProcessingPdf: false,
  isAsking: false,
  isExplaining: false
};


/* =========================
   ELEMENT REFERENCES
========================= */

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


/* =========================
   ADS UNIT BUTTONS
========================= */

const unitButtons =
  document.querySelectorAll(".unit-card");


unitButtons.forEach((button) => {

  button.addEventListener("click", async () => {

    const pdfPath = button.dataset.pdf;

    const pdfName = button.dataset.name;

    await loadDefaultPdf(pdfPath, pdfName);

  });

});


/* =========================
   HELPERS
========================= */

function formatFileSize(bytes) {

  if (bytes < 1024) {
    return bytes + " B";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}


function setStatus(element, message, type) {

  element.textContent = message || "";

  element.classList.remove("error");

  if (type === "error") {
    element.classList.add("error");
  }
}


function setFileStatus(message, type) {

  fileStatusEl.textContent = message || "";

  fileStatusEl.classList.remove(
    "error",
    "success"
  );

  if (type) {
    fileStatusEl.classList.add(type);
  }
}


/* =========================
   FORMAT AI RESPONSE
========================= */

function renderFormattedText(container, text) {

  container.innerHTML = "";

  const lines = text.split("\n");

  let listEl = null;

  let listType = null;


  function closeList() {

    if (listEl) {

      container.appendChild(listEl);

      listEl = null;

      listType = null;
    }

  }


  lines.forEach((rawLine) => {

    const line = rawLine.trim();


    if (line === "") {

      closeList();

      return;
    }


    const bulletMatch =
      line.match(/^[-*]\s+(.*)/);


    const numberMatch =
      line.match(/^\d+[.)]\s+(.*)/);


    if (bulletMatch) {

      if (listType !== "ul") {

        closeList();

        listEl =
          document.createElement("ul");

        listType = "ul";
      }


      const li =
        document.createElement("li");

      li.textContent =
        bulletMatch[1];

      listEl.appendChild(li);

    }


    else if (numberMatch) {

      if (listType !== "ol") {

        closeList();

        listEl =
          document.createElement("ol");

        listType = "ol";
      }


      const li =
        document.createElement("li");

      li.textContent =
        numberMatch[1];

      listEl.appendChild(li);

    }


    else {

      closeList();

      const p =
        document.createElement("p");

      p.textContent = line;

      container.appendChild(p);
    }

  });


  closeList();
}


/* =========================
   CHUNK PDF TEXT
========================= */

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


    chunks.push(
      text.slice(start, end).trim()
    );


    start = end;
  }


  return chunks.filter(
    (chunk) => chunk.length > 0
  );
}


/* =========================
   FIND RELEVANT PDF TEXT
========================= */

function getRelevantContext(
  query,
  maxChars = 6000
) {

  if (!state.pdfText) {
    return "";
  }


  if (state.pdfText.length <= maxChars) {
    return state.pdfText;
  }


  const queryWords =
    query
      .toLowerCase()
      .replace(
        /[^a-z0-9\s]/g,
        " "
      )
      .split(/\s+/)
      .filter(
        (word) => word.length > 2
      );


  const scored =
    state.chunks.map((chunk) => {

      const lower =
        chunk.toLowerCase();

      let score = 0;


      queryWords.forEach((word) => {

        const occurrences =
          lower.split(word).length - 1;

        score += occurrences;

      });


      return {
        chunk,
        score
      };

    });


  scored.sort(
    (a, b) => b.score - a.score
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
      item.chunk + "\n\n";
  }


  if (result.trim().length === 0) {

    result =
      state.pdfText.slice(
        0,
        maxChars
      );

  }


  return result.trim();
}


/* =========================
   RESET PDF
========================= */

function resetPdfState() {

  state.fileName = null;

  state.fileSize = null;

  state.pdfText = "";

  state.chunks = [];


  fileInfo.hidden = true;

  uploadArea.hidden = false;


  pdfInput.value = "";


  readerBox.innerHTML = `
    <div class="reader-placeholder">
      <div class="placeholder-icon">📄</div>
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


/* ============================================================
   LOAD DEFAULT ADS PDF
============================================================ */

async function loadDefaultPdf(
  pdfPath,
  pdfName
) {

  try {

    state.fileName = pdfName;

    fileNameEl.textContent =
      pdfName;

    fileSizeEl.textContent =
      "Loading...";


    uploadArea.hidden = true;

    fileInfo.hidden = false;


    setFileStatus(
      "Loading PDF...",
      null
    );


    readerBox.innerHTML = `
      <div class="reader-placeholder">
        <div class="placeholder-icon">⏳</div>
        <div>
          Loading ${pdfName}...
        </div>
      </div>
    `;


    const response =
      await fetch(pdfPath);


    if (!response.ok) {

      throw new Error(
        "PDF file was not found on the server."
      );

    }


    const arrayBuffer =
      await response.arrayBuffer();


    const text =
      await extractPdfTextFromBuffer(
        arrayBuffer
      );


    if (
      !text ||
      text.trim().length === 0
    ) {

      throw new Error(
        "No selectable text could be extracted from this PDF."
      );

    }


    state.pdfText = text;

    state.chunks =
      chunkText(text);


    state.fileSize =
      arrayBuffer.byteLength;


    fileSizeEl.textContent =
      formatFileSize(
        arrayBuffer.byteLength
      );


    readerBox.textContent =
      text;


    setFileStatus(
      "PDF loaded successfully.",
      "success"
    );


    /* Scroll to document */

    document
      .querySelector(".reader-card")
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });


  }

  catch (error) {

    console.error(error);


    setFileStatus(
      "Could not load this PDF.",
      "error"
    );


    readerBox.innerHTML = `
      <div class="reader-placeholder">
        <div class="placeholder-icon">⚠️</div>
        <div>
          Could not load this PDF.
        </div>
      </div>
    `;


    state.pdfText = "";

    state.chunks = [];

  }

}


/* ============================================================
   EXTRACT PDF TEXT FROM BUFFER
============================================================ */

async function extractPdfTextFromBuffer(
  arrayBuffer
) {

  state.isProcessingPdf = true;


  try {

    const loadingTask =
      pdfjsLib.getDocument({
        data: arrayBuffer
      });


    const pdf =
      await loadingTask.promise;


    let fullText = "";


    for (
      let pageNum = 1;
      pageNum <= pdf.numPages;
      pageNum++
    ) {

      const page =
        await pdf.getPage(pageNum);


      const content =
        await page.getTextContent();


      const pageText =
        content.items
          .map(
            (item) => item.str
          )
          .join(" ");


      fullText +=
        pageText.trim() +
        "\n\n";
    }


    return fullText.trim();

  }

  finally {

    state.isProcessingPdf = false;

  }

}


/* ============================================================
   NORMAL USER PDF UPLOAD
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
        "Please select a valid PDF file.",
        "error"
      );

      return;
    }


    state.fileName =
      file.name;

    state.fileSize =
      file.size;


    uploadArea.hidden = true;

    fileInfo.hidden = false;


    fileNameEl.textContent =
      file.name;

    fileSizeEl.textContent =
      formatFileSize(
        file.size
      );


    setFileStatus(
      "Reading PDF...",
      null
    );


    try {

      const arrayBuffer =
        await file.arrayBuffer();


      const text =
        await extractPdfTextFromBuffer(
          arrayBuffer
        );


      if (
        !text ||
        text.trim().length === 0
      ) {

        setFileStatus(
          "This PDF does not contain selectable text. OCR is not supported.",
          "error"
        );


        readerBox.innerHTML = `
          <div class="reader-placeholder">
            <div class="placeholder-icon">⚠️</div>
            <div>
              No selectable text could be extracted.
            </div>
          </div>
        `;


        state.pdfText = "";

        state.chunks = [];

        return;
      }


      state.pdfText =
        text;

      state.chunks =
        chunkText(text);


      readerBox.textContent =
        text;


      setFileStatus(
        "PDF processed successfully.",
        "success"
      );

    }

    catch (error) {

      console.error(error);


      setFileStatus(
        "We couldn't read this PDF. Please try another file.",
        "error"
      );


      readerBox.innerHTML = `
        <div class="reader-placeholder">
          <div class="placeholder-icon">⚠️</div>
          <div>
            We could not read this PDF.
          </div>
        </div>
      `;


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

    resetPdfState();

  }
);


/* ============================================================
   TEXT SELECTION
============================================================ */

readerBox.addEventListener(
  "mouseup",
  handleTextSelection
);


readerBox.addEventListener(
  "touchend",
  handleTextSelection
);


function handleTextSelection() {

  const selection =
    window
      .getSelection()
      .toString()
      .trim();


  if (selection.length > 0) {

    selectionActions.hidden =
      false;

    selectionActions.dataset.selectedText =
      selection;

  }

  else {

    selectionActions.hidden =
      true;

  }

}


/* ============================================================
   EXPLAIN SELECTED TEXT
============================================================ */

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
   ASK ABOUT PDF
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
    null
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
        "Something went wrong while getting the answer. Please try again."
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
        "Something went wrong while getting the answer. Please try again.",
      "error"
    );

  }

  finally {

    state.isAsking = false;

    askBtn.disabled = false;

  }

}


/* ============================================================
   EXPLAIN DIFFICULT LINE
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
    null
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
        "Something went wrong while generating the explanation. Please try again."
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
        "Something went wrong while generating the explanation. Please try again.",
      "error"
    );

  }

  finally {

    state.isExplaining = false;

    explainBtn.disabled = false;

  }

}
