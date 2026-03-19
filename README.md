## Payload Hostage – DevTools POST Interceptor

<img src="logo.png" alt="Payload Hostage logo" width="320" />

Payload Hostage is a Chrome DevTools extension that lets you pause, inspect, and modify `POST` request payloads from a page before they are actually sent, and then view the corresponding responses — all from a dedicated DevTools panel.

It works by temporarily intercepting `fetch` and XHR `POST` calls, surfacing the payload in a DevTools panel where you can edit it, and only resuming the request when you confirm.

### When the interceptor runs

- **DevTools must be open**: The interceptor is only controllable from the Payload Hostage DevTools panel.
- **The Payload Hostage panel must be visible**: You use the panel’s toggle to turn interception on or off for the inspected tab.
- **The panel toggle must be On**: When the toggle reads **"Interceptor: On"**, outgoing `POST` requests that are triggered by recent user actions will be intercepted. When it reads **"Interceptor: Off"**, the page behaves normally and all requests flow through untouched.

If the DevTools panel is closed or disconnected, the interceptor is automatically turned off for that tab.

### What it’s useful for

- **Debugging APIs and forms**: See exactly what JSON or form data is being sent before it hits your backend.
- **Rapidly testing backend edge cases**: Change payloads on the fly without touching frontend code (e.g. invalid values, missing fields, or large payloads).
- **Exploring client behavior**: Understand which calls a page makes and how it reacts to different server responses.

### Installation

To install the extension locally during development:

1. Open **chrome://extensions** in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **"Load unpacked"**.
4. Select this project folder (containing `manifest.json`, `logo.png`, etc.).

### How to use

1. **Open DevTools** on the tab you want to inspect.
2. Switch to the **Payload Hostage** panel.
3. Use the **"Interceptor: On/Off"** switch in the panel header:
   - Set it to **On** to start intercepting user-triggered `POST` requests.
   - Set it to **Off** to let requests pass through normally.
4. Trigger a `POST` request (e.g. submit a form, click a button that calls an API).
5. In the panel:
   - Inspect or edit the **Request Payload** text area.
   - Click **"Confirm & Send"** to send the modified payload, or **"Cancel"** to send the original.
6. Once the request completes, the **Response** pane shows the response body (JSON, form-like, or text) with helpful formatting.

### Notes

- Only `POST` requests that are likely to be **user-initiated** (shortly after a click/keypress/submit) are intercepted to avoid blocking background traffic.
- The extension doesn’t persist or send your payloads anywhere except through the normal browser request flow; all inspection happens locally in your browser.

