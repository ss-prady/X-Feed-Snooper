// content.js

function activateReadOnlyOverlay() {
  if (document.getElementById("blockingOverlay")) return;

  document.body.classList.add("friend-mode");

  const overlay = document.createElement("div");
  overlay.id = "blockingOverlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "transparent",
    zIndex: "2147483646",
    pointerEvents: "auto"
  });
  document.body.appendChild(overlay);

  const events = ['click', 'mousedown', 'mouseup', 'contextmenu', 'keydown', 'keypress', 'keyup'];
  for (const evt of events) {
    overlay.addEventListener(evt, e => {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
    window.addEventListener(evt, e => {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }

  console.log("Friend mode active — interactions blocked.");
}

function checkIfInFriendModeAndLock() {
  chrome.storage.local.get(['myCookies'], result => {
    const storedMyCookies = result.myCookies || [];
    const myCookieMap = new Map(storedMyCookies.map(c => [c.name, c.value]));

    chrome.runtime.sendMessage({ action: "getCookies" }, currentCookies => {
      const currentMap = new Map(currentCookies.map(c => [c.name, c.value]));
      let mismatch = false;

      for (const [name, value] of currentMap) {
        if (myCookieMap.has(name) && myCookieMap.get(name) !== value) {
          mismatch = true;
          break;
        }
      }

      if (mismatch) {
        activateReadOnlyOverlay();
      }
    });
  });
}

// Run check when content script loads
checkIfInFriendModeAndLock();

// Optional: Re-check on SPA nav changes (for Twitter's dynamic routing)
function waitForBodyAndObserve() {
  if (document.body) {
    const observer = new MutationObserver(() => {
      if (!document.getElementById("blockingOverlay")) {
        checkIfInFriendModeAndLock();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    // Retry in a few milliseconds until body is available
    setTimeout(waitForBodyAndObserve, 50);
  }
}

waitForBodyAndObserve();

