const s = document.createElement("script");
s.src = chrome.runtime.getURL("injector.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  if (!e.data) return;

  if (e.data.type === "INTERCEPT_POST" || e.data.type === "RESPONSE_RECEIVED") {
    console.log("CONTENT -> BACKGROUND:", e.data);
    chrome.runtime.sendMessage(e.data);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  console.log("BACKGROUND -> CONTENT -> PAGE:", msg);
  window.postMessage(msg, "*");
});