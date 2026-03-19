console.log("Interceptor injected ✅");

// ======================
// STATE
// ======================

let idCounter = 0;
const pending = new Map();

// Track last real user action
let lastUserAction = 0;

let interceptorActive = false;

["click", "keydown", "submit"].forEach((event) => {
  document.addEventListener(
    event,
    () => {
      lastUserAction = Date.now();
    },
    true
  );
});

// ======================
// HANDLE RESPONSE FROM DEVTOOLS
// ======================

window.addEventListener("message", (e) => {
  if (!e.data) return;

  if (e.data.type === "MODIFIED") {
    const resolve = pending.get(e.data.id);
    if (resolve) {
      console.log("✅ RESUMING REQUEST WITH:", e.data.body);
      resolve(e.data.body);
      pending.delete(e.data.id);
    }
    return;
  }

  if (e.data.type === "SET_ACTIVE") {
    interceptorActive = Boolean(e.data.active);
    console.log("🔁 Interceptor active state changed:", interceptorActive);
  }
});

// ======================
// HELPERS
// ======================

function shouldIntercept(method) {
  const isPost = method === "POST";
  const isUserTriggered = Date.now() - lastUserAction < 1000;
  return interceptorActive && isPost && isUserTriggered;
}

function postToExtension(message) {
  window.postMessage(message, "*");
}

function sendResponseToPanel({ id, url, method, status, statusText, body }) {
  postToExtension({
    type: "RESPONSE_RECEIVED",
    id,
    url,
    method,
    status,
    statusText,
    body
  });
}

async function readFetchResponseBody(response) {
  try {
    const clone = response.clone();
    return await clone.text();
  } catch (err) {
    console.warn("⚠️ Failed to read fetch response body:", err);
    return "";
  }
}

// ======================
// FETCH INTERCEPT
// ======================

const originalFetch = window.fetch;

window.fetch = async function (...args) {
  const [input, init = {}] = args;
  const method = (init.method || "GET").toUpperCase();
  const url = typeof input === "string" ? input : input?.url;

  console.log("🌐 FETCH CALLED:", method, url);

  if (!shouldIntercept(method)) {
    return originalFetch.apply(this, args);
  }

  const id = ++idCounter;
  const body = init.body || "";

  console.log("🛑 INTERCEPTING FETCH POST:", url, body);

  let newBody = await new Promise((resolve) => {
    pending.set(id, resolve);

    postToExtension({
      type: "INTERCEPT_POST",
      id,
      url,
      method,
      body
    });
  });

  if (!newBody) {
    console.warn("⚠️ No modified body — using original");
    newBody = body;
  }

  console.log("🚀 SENDING FETCH WITH BODY:", newBody);

  const response = await originalFetch(input, {
    ...init,
    body: newBody
  });

  try {
    const responseBody = await readFetchResponseBody(response);

    console.log("📥 FETCH RESPONSE:", response.status, response.statusText, responseBody);

    sendResponseToPanel({
      id,
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      body: responseBody
    });
  } catch (err) {
    console.warn("⚠️ Failed to process fetch response:", err);

    sendResponseToPanel({
      id,
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      body: ""
    });
  }

  return response;
};

// ======================
// XHR INTERCEPT
// ======================

const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url) {
  this._method = method;
  this._url = url;
  return origOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function (body) {
  const method = (this._method || "GET").toUpperCase();
  const url = this._url;

  console.log("🌐 XHR CALLED:", method, url);

  if (!shouldIntercept(method)) {
    return origSend.call(this, body);
  }

  const xhr = this;
  const id = ++idCounter;

  console.log("🛑 INTERCEPTING XHR POST:", url, body);

  new Promise((resolve) => {
    pending.set(id, resolve);

    postToExtension({
      type: "INTERCEPT_POST",
      id,
      url,
      method,
      body: body || ""
    });
  }).then((newBody) => {
    if (!newBody) {
      console.warn("⚠️ No modified body — using original");
      newBody = body;
    }

    console.log("🚀 SENDING XHR WITH BODY:", newBody);

    const onReadyStateChange = () => {
      if (xhr.readyState !== 4) return;

      try {
        const responseText =
          typeof xhr.responseText === "string" ? xhr.responseText : "";

        console.log("📥 XHR RESPONSE:", xhr.status, xhr.statusText, responseText);

        sendResponseToPanel({
          id,
          url,
          method,
          status: xhr.status,
          statusText: xhr.statusText,
          body: responseText
        });
      } catch (err) {
        console.warn("⚠️ Failed to process XHR response:", err);

        sendResponseToPanel({
          id,
          url,
          method,
          status: xhr.status || 0,
          statusText: xhr.statusText || "",
          body: ""
        });
      } finally {
        xhr.removeEventListener("readystatechange", onReadyStateChange);
      }
    };

    xhr.addEventListener("readystatechange", onReadyStateChange);

    origSend.call(xhr, newBody);
  });
};