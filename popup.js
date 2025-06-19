// popup.js

const getMyBtn = document.getElementById("getMyCookies");
const myCookieOutput = document.getElementById("myCookieOutput");
const friendNameInput = document.getElementById("friendNameInput");
const cookieInput = document.getElementById("cookieInput");
const saveProfileBtn = document.getElementById("saveProfile");
const loadFriendBtn = document.getElementById("loadFriendFeed");
const profileList = document.getElementById("profileList");
const restoreBtn = document.getElementById("restoreFeed");

document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
});

// 1. Get My Cookies: read all x.com cookies, copy to clipboard, show textarea
getMyBtn.onclick = () => {
  chrome.cookies.getAll({ domain: "x.com" }, cookies => {
    if (!cookies || cookies.length === 0) {
      alert("No x.com cookies found.");
      return;
    }
    const pairs = cookies.map(c => `${c.name}=${c.value}`);
    const str = pairs.join("; ");
    // Copy to clipboard
    navigator.clipboard.writeText(str).then(() => {
      alert("Your cookie string copied to clipboard.");
    }).catch(() => {
      // Fallback prompt
      prompt("Copy your cookies:", str);
    });
    // Show in textarea
    myCookieOutput.style.display = "block";
    myCookieOutput.value = str;

    // OPTIONAL: Save original cookies only if not already saved
    chrome.storage.local.get(['isOriginalSaved'], data => {
      if (!data.isOriginalSaved) {
        const myCookies = cookies.map(c => ({ ...c }));
        chrome.storage.local.set({ myCookies, isOriginalSaved: true });
      }
    });
  });
};


// 2. Save friend profile
saveProfileBtn.onclick = () => {
  const name = friendNameInput.value.trim();
  const cookies = cookieInput.value.trim();
  if (!name) return alert("Enter a display name.");
  if (!cookies) return alert("Paste the friend’s cookie string.");
  chrome.storage.local.get(['savedProfiles'], data => {
    const arr = Array.isArray(data.savedProfiles) ? data.savedProfiles : [];
    const existing = arr.find(p => p.name === name);
    if (existing) {
      if (!confirm(`Overwrite profile "${name}"?`)) return;
      existing.cookies = cookies;
    } else {
      arr.push({ name, cookies });
    }
    chrome.storage.local.set({ savedProfiles: arr }, () => {
      loadProfiles();
      alert("Profile saved.");
    });
  });
};

// 3. Load friend feed: switch cookies, navigate, inject blocker
loadFriendBtn.onclick = () => {
  const name = friendNameInput.value.trim();
  const cookies = cookieInput.value.trim();
  if (!name || !cookies) {
    return alert("Fill friend name and cookie string, or select a saved profile.");
  }
  loadFriendSession(name, cookies);
};

function loadProfiles() {
  profileList.innerHTML = '';
  chrome.storage.local.get(['savedProfiles'], data => {
    const arr = Array.isArray(data.savedProfiles) ? data.savedProfiles : [];
    arr.forEach(p => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = p.name;
      span.className = "profile-name";
      const btns = document.createElement("div");
      btns.className = "profile-buttons";
      const loadB = document.createElement("button");
      loadB.textContent = "Load";
      loadB.onclick = () => {
        friendNameInput.value = p.name;
        cookieInput.value = p.cookies;
        loadFriendSession(p.name, p.cookies);
      };
      const delB = document.createElement("button");
      delB.textContent = "Delete";
      delB.onclick = () => {
        if (!confirm(`Delete profile "${p.name}"?`)) return;
        chrome.storage.local.get(['savedProfiles'], data2 => {
          const arr2 = Array.isArray(data2.savedProfiles) ? data2.savedProfiles : [];
          const newArr = arr2.filter(x => x.name !== p.name);
          chrome.storage.local.set({ savedProfiles: newArr }, () => {
            loadProfiles();
          });
        });
      };
      btns.appendChild(loadB);
      btns.appendChild(delB);
      li.appendChild(span);
      li.appendChild(btns);
      profileList.appendChild(li);
    });
  });
}

// function loadFriendSession(friendName, friendCookieString) {
//   chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
//     const tab = tabs[0];
//     if (!tab.url.startsWith("https://x.com") &&
//         !confirm("Continue to load friend’s session?")) return;

//     // 2. Save **only if not already saved**
//     chrome.storage.local.get(['myCookies'], data => {
//       const alreadySaved = Array.isArray(data.myCookies) && data.myCookies.length > 0;
//       const saveOriginal = !alreadySaved;

//       chrome.cookies.getAll({ domain: "x.com" }, existingCookies => {
//         const cookieArray = existingCookies.map(c => ({
//           name: c.name, value: c.value,
//           domain: c.domain, path: c.path,
//           secure: c.secure, httpOnly: c.httpOnly,
//           sameSite: c.sameSite, expirationDate: c.expirationDate
//         }));
//         // Save only first time
//         if (saveOriginal) {
//           chrome.storage.local.set({ myCookies: cookieArray });
//         }
//         // 3. Remove and 4. Set friend’s cookies…
//         removeAllXComCookies(() => {
//           /* same parsing & chrome.cookies.set logic */
//           /* … */
//           setTimeout(() => {
//             chrome.tabs.update(tab.id, { url: "https://x.com/home" });
//           }, 500);
//         });
//       });
//     });
//   });
// }

// Updated loadFriendSession function
function loadFriendSession(friendName, friendCookieString) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab.url.startsWith("https://x.com") && 
        !confirm("You are not on x.com. Continue?")) return;

    // 1. Check if original cookies are already saved
    chrome.storage.local.get(['myCookies', 'isOriginalSaved'], data => {
      // 2. Save ONLY if original cookies don't exist
      if (!data.isOriginalSaved || !data.myCookies) {
        chrome.cookies.getAll({ domain: "x.com" }, existingCookies => {
          const myCookies = existingCookies.map(c => ({ ...c }));
          chrome.storage.local.set({ 
            myCookies, 
            isOriginalSaved: true // Mark as saved
          }, () => removeAndSetFriendCookies(friendCookieString, tab));
        });
      } else {
        removeAndSetFriendCookies(friendCookieString, tab);
      }
    });
  });
}

// Helper function for cookie removal/setting
function removeAndSetFriendCookies(friendCookieString, tab) {
  removeAllXComCookies(() => {
    friendCookieString.split(";").map(s => s.trim()).filter(Boolean).forEach(pair => {
      const [name, value] = pair.split("=").map(s => s.trim());
      if (name && value) {
        chrome.cookies.set({
          url: "https://x.com",
          name,
          value,
          domain: ".x.com",
          path: "/",
          secure: true
        });
      }
    });
    setTimeout(() => chrome.tabs.update(tab.id, { url: "https://x.com/home" }), 500);
  });
}


function removeAllXComCookies(callback) {
  chrome.cookies.getAll({ domain: "x.com" }, cookies => {
    if (!cookies || cookies.length === 0) {
      callback();
      return;
    }
    let count = 0;
    cookies.forEach(c => {
      const domainNoDot = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
      const url = `https://${domainNoDot}${c.path}`;
      chrome.cookies.remove({ url: url, name: c.name }, () => {
        count++;
        if (count >= cookies.length) {
          callback();
        }
      });
    });
    // fallback if removal events don’t fire
    setTimeout(() => {
      callback();
    }, 1500);
  });
}

// 4. Restore my feed: set back your saved cookies
restoreBtn.onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab.url.startsWith("https://x.com")) {
      if (!confirm("You are not on x.com. Restore your session anyway?")) return;
    }
    chrome.storage.local.get(['myCookies'], data => {
      const myCookies = data.myCookies;
      if (!Array.isArray(myCookies) || myCookies.length === 0) {
        return alert("No saved original cookies found.");
      }
      // Remove any friend cookies
      removeAllXComCookies(() => {
        // Restore each cookie exactly
        myCookies.forEach(c => {
          const domainNoDot = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
          const url = `https://${domainNoDot}${c.path}`;
          const details = {
            url: url,
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly
          };
          if (c.sameSite) details.sameSite = c.sameSite;
          if (c.expirationDate) details.expirationDate = c.expirationDate;
          chrome.cookies.set(details);
        });
        // Wait briefly then navigate to home
        setTimeout(() => {
          chrome.tabs.update(tab.id, { url: "https://x.com/home" });
          // RESET THE SAVED FLAG
          chrome.storage.local.set({ isOriginalSaved: false }); 
        }, 500);
      });
    });
  });
};
