const panelPortsByTabId = new Map();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "devtools") return;

  let registeredTabId = null;

  port.onMessage.addListener((msg) => {
    console.log("BACKGROUND GOT FROM PANEL:", msg);

    if (msg.type === "REGISTER_PANEL" && msg.tabId != null) {
      registeredTabId = msg.tabId;
      panelPortsByTabId.set(registeredTabId, port);
      console.log("REGISTERED PANEL FOR TAB:", registeredTabId);
      return;
    }

    if (msg.type === "SET_ACTIVE" && msg.tabId != null) {
      chrome.tabs.sendMessage(msg.tabId, {
        type: "SET_ACTIVE",
        active: Boolean(msg.active)
      });
      return;
    }

    if (msg.type === "MODIFIED" && msg.tabId != null) {
      chrome.tabs.sendMessage(msg.tabId, {
        type: "MODIFIED",
        id: msg.id,
        body: msg.body
      });
    }
  });

  port.onDisconnect.addListener(() => {
    if (registeredTabId != null) {
      // When DevTools panel is closed, ensure interceptor is turned off
      chrome.tabs.sendMessage(registeredTabId, {
        type: "SET_ACTIVE",
        active: false
      });
      panelPortsByTabId.delete(registeredTabId);
      console.log("UNREGISTERED PANEL FOR TAB:", registeredTabId);
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log("BACKGROUND GOT FROM CONTENT:", msg, sender);

  const tabId = sender.tab?.id;
  if (tabId == null) return;

  const port = panelPortsByTabId.get(tabId);
  if (!port) {
    console.warn("NO PANEL REGISTERED FOR TAB:", tabId);
    return;
  }

  if (msg.type === "INTERCEPT_POST" || msg.type === "RESPONSE_RECEIVED") {
    port.postMessage(msg);
  }
});