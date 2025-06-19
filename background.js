// background.js
// No special background logic needed for this cookie-switching approach.
chrome.runtime.onInstalled.addListener(() => {
  console.log("X Feed Viewer extension installed.");
});

// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getCookies") {
    chrome.cookies.getAll({ domain: "x.com" }, sendResponse);
    return true; // Keeps message channel open
  }
});

