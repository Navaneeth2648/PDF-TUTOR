# PDF Tutor

PDF Tutor is a simple student project. Upload a PDF, read it in the browser,
ask questions about its content, and get simple explanations of confusing
sentences — all powered by the Google Gemini API.

It is intentionally small and simple: no accounts, no database, no cloud
storage. Your PDF is processed in your browser and its text is kept only in
memory for your current session.

---

## 1. What this project does

- You upload a PDF from your device.
- The browser extracts the text from the PDF (using PDF.js) and shows it in
  a document reader.
- You can ask a question about the PDF ("Ask about this PDF"). The relevant
  part of the PDF text is sent to our backend, which asks Gemini to answer
  using that content.
- You can paste a confusing sentence ("Explain a difficult line") and get a
  simple explanation.
- The Gemini API key is only ever used on the backend server — it is never
  sent to the browser.

---

## 2. Required software

You need:

- **Node.js** version 18 or newer (this includes `npm`, the Node package
  manager).
- A **Gemini API key** from Google AI Studio.
- A code editor (optional, e.g. VS Code) and a terminal.

---

## 3. How to install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version for your operating system.
3. Run the installer and follow the on-screen steps (defaults are fine).
4. Verify the install by opening a terminal and running:

   ```
   node -v
   npm -v
   ```

   Both commands should print a version number.

---

## 4. How to install dependencies

Open a terminal, move into the project folder, and run:

```
cd pdf-tutor
npm install
```

This downloads the packages listed in `package.json` (Express, dotenv,
cors) into a `node_modules` folder.

---

## 5. How to create the `.env` file

1. In the project folder, copy `.env.example` to a new file named `.env`:

   - On macOS/Linux:
     ```
     cp .env.example .env
     ```
   - On Windows (Command Prompt):
     ```
     copy .env.example .env
     ```

2. Open `.env` in your editor. It should look like:

   ```
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
   PORT=3000
   ```

---

## 6. Where to put `GEMINI_API_KEY`

1. Get a Gemini API key from Google AI Studio: https://aistudio.google.com/app/apikey
2. Copy the key.
3. In your `.env` file, replace `YOUR_GEMINI_API_KEY_HERE` with the real key:

   ```
   GEMINI_API_KEY=AIzaSy...............................
   ```

4. Save the file.

**Never share your `.env` file or commit it to Git.** It is already listed
in `.gitignore` so Git will ignore it automatically.

---

## 7. How to start the server

From inside the `pdf-tutor` folder, run:

```
npm start
```

You should see something like:

```
PDF Tutor server running at http://localhost:3000
```

If you see a warning that `GEMINI_API_KEY` is not set, double-check your
`.env` file.

---

## 8. How to open the application

Open your browser and go to:

```
http://localhost:3000
```

Upload a text-based PDF, wait for it to process, and try asking a question
or pasting a difficult sentence.

---

## 9. How the frontend talks to the backend

- The frontend (`public/index.html`, `public/style.css`, `public/app.js`)
  is plain HTML, CSS, and vanilla JavaScript. It runs in the browser.
- The frontend extracts PDF text itself using PDF.js, entirely in the
  browser — no PDF is uploaded to the server.
- When you click **Ask** or **Explain**, the frontend sends a `fetch()`
  request with JSON data to our own backend:
  - `POST /api/ask` — `{ question, pdfText }`
  - `POST /api/explain` — `{ selectedLine, pdfContext }`
- The backend (`server.js`, a Node.js + Express app) receives that request,
  builds a prompt, and calls the Gemini API using the private
  `GEMINI_API_KEY` from `.env`.
- The backend sends Gemini's answer back to the browser as JSON. The API
  key itself is never included in any response to the browser.

---

## 10. Troubleshooting common errors

**"AI is not configured yet."**
Your `.env` file is missing `GEMINI_API_KEY`, or the server was started
before you added it. Add the key and restart the server (`Ctrl+C` then
`npm start` again).

**"This PDF does not contain selectable text."**
The PDF is a scanned image with no real text layer. This basic version does
not support OCR, so text-based PDFs are required.

**"We couldn't read this PDF."**
The file may be corrupted, password-protected, or not a valid PDF.

**Port already in use / server won't start**
Another program is using port 3000. Either close that program, or change
`PORT` in your `.env` file (e.g. `PORT=4000`) and open
`http://localhost:4000` instead.

**"Something went wrong while getting the answer."**
This usually means a temporary network issue or a problem reaching the
Gemini API. Wait a moment and try again. Check the terminal running the
server for a more detailed error message (it is logged there, not shown to
the browser, for security).

**Nothing happens when I click "Choose PDF"**
Make sure you selected an actual `.pdf` file. Other file types are
rejected with an error message.

---

## 11. Packaging as an Android app later (Capacitor)

This project's frontend (`public/`) is a normal static website with no
backend logic inside it, so it is compatible with being wrapped into an
Android app using [Capacitor](https://capacitorjs.com/) later. Rough steps
when you're ready (not required to run the project locally):

1. Host this backend somewhere reachable over HTTPS (e.g. a small cloud
   server), so the API is available at a public URL such as
   `https://your-domain.com`.
2. In `public/app.js`, change the `fetch('/api/ask', ...)` and
   `fetch('/api/explain', ...)` calls to use the full hosted URL, e.g.
   `fetch('https://your-domain.com/api/ask', ...)`.
3. In a separate folder, install Capacitor and initialize it:
   ```
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```
4. Point Capacitor's `webDir` to a copy of this project's `public/` folder.
5. Add the Android platform and open it in Android Studio:
   ```
   npm install @capacitor/android
   npx cap add android
   npx cap open android
   ```
6. Build and run the Android app from Android Studio. It will load the
   `public/` frontend and talk to your hosted backend over HTTPS, exactly
   like the browser version does.

No backend code or API key ever needs to go inside the Android app itself.

---

## Project structure

```
pdf-tutor/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server.js
├── package.json
├── .env            (you create this, not committed to Git)
├── .env.example
├── .gitignore
└── README.md
```
