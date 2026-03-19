const INSPECTED_TAB_ID = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: "devtools" });

let currentId = null;
let currentFormat = "text";
let currentResponseFormat = "text";
let originalBody = "";

const el = {
  meta: document.getElementById("meta"),
  payload: document.getElementById("payload"),
  response: document.getElementById("response"),
  method: document.getElementById("method"),
  bodyType: document.getElementById("bodyType"),
  responseType: document.getElementById("responseType"),
  requestMeta: document.getElementById("requestMeta"),
  responseMeta: document.getElementById("responseMeta"),
  status: document.getElementById("status"),
  send: document.getElementById("send"),
  format: document.getElementById("format"),
  cancel: document.getElementById("cancel"),
  toggleActive: document.getElementById("toggleActive")
};

let isActive = false;

function registerPanel() {
  port.postMessage({
    type: "REGISTER_PANEL",
    tabId: INSPECTED_TAB_ID
  });
}

function setActive(active) {
  isActive = !!active;

  if (el.toggleActive) {
    el.toggleActive.textContent = isActive
      ? "INTERCEPTOR: ON"
      : "INTERCEPTOR: OFF – CLICK TO ENABLE";

    el.toggleActive.style.background = isActive ? "#22c55e" : "#ef4444";
    el.toggleActive.style.color = "#020617";
    el.toggleActive.style.fontWeight = "800";
    el.toggleActive.style.textTransform = "uppercase";
    el.toggleActive.style.border = "2px solid rgba(15,23,42,0.9)";
    el.toggleActive.style.boxShadow = isActive
      ? "0 0 0 2px rgba(34,197,94,0.7)"
      : "0 0 0 2px rgba(248,113,113,0.7)";
  }

  port.postMessage({
    type: "SET_ACTIVE",
    tabId: INSPECTED_TAB_ID,
    active: isActive
  });
}

function setStatus(text, kind = "") {
  if (!el.status) return;
  el.status.textContent = text;
  el.status.className = `status ${kind}`.trim();
}

function resetPanel(message = "Waiting for intercepted request…") {
  currentId = null;
  currentFormat = "text";
  currentResponseFormat = "text";
  originalBody = "";

  if (el.meta) el.meta.textContent = message;
  if (el.payload) el.payload.value = "";
  if (el.response) el.response.value = "";

  if (el.method) el.method.textContent = "POST";
  if (el.bodyType) el.bodyType.textContent = "NO PAYLOAD";
  if (el.responseType) el.responseType.textContent = "NO RESPONSE";

  if (el.requestMeta) el.requestMeta.textContent = "Editable";
  if (el.responseMeta) el.responseMeta.textContent = "Available after confirm";

  if (el.send) el.send.disabled = true;

  setStatus("Idle");
}

function detectPayloadType(body) {
  if (typeof body !== "string" || !body.trim()) return "empty";

  const trimmed = body.trim();

  try {
    JSON.parse(trimmed);
    return "json";
  } catch {}

  if (trimmed.includes("=")) {
    try {
      new URLSearchParams(trimmed);
      return "form";
    } catch {}
  }

  return "text";
}

function formatPayload(body, type) {
  if (!body) return "";

  if (type === "json") {
    return JSON.stringify(JSON.parse(body), null, 2);
  }

  if (type === "form") {
    const params = new URLSearchParams(body);
    const obj = {};

    for (const [key, value] of params.entries()) {
      if (key in obj) {
        obj[key] = Array.isArray(obj[key])
          ? [...obj[key], value]
          : [obj[key], value];
      } else {
        obj[key] = value;
      }
    }

    return JSON.stringify(obj, null, 2);
  }

  return body;
}

function buildOutgoingPayload(editorText, originalType) {
  if (originalType === "json") {
    return JSON.stringify(JSON.parse(editorText));
  }

  if (originalType === "form") {
    try {
      const parsed = JSON.parse(editorText);
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, String(v)));
        } else {
          params.set(key, String(value));
        }
      }

      return params.toString();
    } catch {
      return editorText;
    }
  }

  return editorText;
}

function validateEditor() {
  if (!el.payload) return;

  const text = el.payload.value;

  try {
    if (currentFormat === "json") {
      JSON.parse(text);
    } else if (currentFormat === "form") {
      const trimmed = text.trim();
      if (trimmed.startsWith("{")) JSON.parse(trimmed);
    }

    setStatus("Valid payload", "ok");
    if (el.send) el.send.disabled = false;
  } catch (err) {
    setStatus(`Invalid ${currentFormat}: ${err.message}`, "error");
    if (el.send) el.send.disabled = true;
  }
}

function enableTextareaTabIndent(textarea) {
  if (!textarea) return;

  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;

    e.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    if (e.shiftKey) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selectedText = value.slice(lineStart, end);
      const updated = selectedText.replace(/^(\t|  )/gm, "");

      textarea.value =
        value.slice(0, lineStart) +
        updated +
        value.slice(end);

      textarea.selectionStart = lineStart;
      textarea.selectionEnd = lineStart + updated.length;
      return;
    }

    const indent = "  ";

    textarea.value =
      value.substring(0, start) +
      indent +
      value.substring(end);

    textarea.selectionStart = textarea.selectionEnd = start + indent.length;
  });
}

// Initial state
registerPanel();
resetPanel();
setActive(false);

chrome.devtools.network.onNavigated.addListener((url) => {
  console.log("🔄 Page navigated / refreshed:", url);

  resetPanel("Waiting for intercepted request…");
  registerPanel();
  setStatus("Page refreshed");
});

port.onMessage.addListener((msg) => {
  console.log("PANEL RECEIVED:", msg);

  if (msg.type === "INTERCEPT_POST") {
    currentId = msg.id;
    originalBody = msg.body || "";

    if (el.method) el.method.textContent = msg.method || "POST";
    if (el.meta) el.meta.textContent = msg.url || "";

    currentFormat = detectPayloadType(originalBody);
    if (el.bodyType) el.bodyType.textContent = currentFormat.toUpperCase();

    if (el.requestMeta) {
      el.requestMeta.textContent =
        currentFormat === "json"
          ? "Editable · JSON"
          : currentFormat === "form"
            ? "Editable · Form"
            : "Editable · Text";
    }

    if (el.response) el.response.value = "";
    if (el.responseType) el.responseType.textContent = "NO RESPONSE";
    if (el.responseMeta) el.responseMeta.textContent = "Waiting for response";

    try {
      if (el.payload) {
        el.payload.value = formatPayload(originalBody, currentFormat);
      }
      setStatus("Payload intercepted", "ok");
      if (el.send) el.send.disabled = false;
    } catch (err) {
      if (el.payload) {
        el.payload.value = originalBody;
      }
      setStatus(`Format failed: ${err.message}`, "error");
      if (el.send) el.send.disabled = false;
    }

    return;
  }

  if (msg.type === "RESPONSE_RECEIVED") {
    const responseBody = msg.body || "";
    currentResponseFormat = detectPayloadType(responseBody);

    if (el.responseType) {
      el.responseType.textContent =
        currentResponseFormat === "empty"
          ? `HTTP ${msg.status || ""}`.trim()
          : currentResponseFormat.toUpperCase();
    }

    if (el.responseMeta) {
      el.responseMeta.textContent =
        msg.status != null
          ? `HTTP ${msg.status}${msg.statusText ? ` · ${msg.statusText}` : ""}`
          : "Response received";
    }

    try {
      if (el.response) {
        el.response.value = formatPayload(responseBody, currentResponseFormat);
      }
      setStatus("Response received", "ok");
    } catch (err) {
      if (el.response) {
        el.response.value = responseBody;
      }
      setStatus(`Response format failed: ${err.message}`, "error");
    }
  }
});

if (el.payload) {
  el.payload.addEventListener("input", validateEditor);
  enableTextareaTabIndent(el.payload);
}

if (el.toggleActive) {
  el.toggleActive.addEventListener("click", () => {
    setActive(!isActive);
  });
}

if (el.format) {
  el.format.addEventListener("click", () => {
    try {
      if (!el.payload) return;

      el.payload.value = formatPayload(
        buildOutgoingPayload(el.payload.value, currentFormat),
        currentFormat
      );
      validateEditor();
    } catch (err) {
      setStatus(`Format failed: ${err.message}`, "error");
    }
  });
}

if (el.cancel) {
  el.cancel.addEventListener("click", () => {
    if (!currentId) return;

    port.postMessage({
      type: "MODIFIED",
      tabId: INSPECTED_TAB_ID,
      id: currentId,
      body: originalBody
    });

    setStatus("Sent original payload", "ok");
  });
}

if (el.send) {
  el.send.addEventListener("click", () => {
    if (!currentId) {
      setStatus("No intercepted request to confirm", "error");
      return;
    }

    try {
      const outgoingBody = buildOutgoingPayload(el.payload.value, currentFormat);

      if (el.response) el.response.value = "";
      if (el.responseType) el.responseType.textContent = "PENDING";
      if (el.responseMeta) el.responseMeta.textContent = "Awaiting response…";

      port.postMessage({
        type: "MODIFIED",
        tabId: INSPECTED_TAB_ID,
        id: currentId,
        body: outgoingBody
      });

      setStatus("Modified payload sent", "ok");
    } catch (err) {
      setStatus(`Cannot send: ${err.message}`, "error");
    }
  });
}