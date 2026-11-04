/**
 * NODACO NOTES - MOBILE-FIRST JAVASCRIPT CONTROLLER
 */

(function () {
  "use strict";

  const GITHUB_REPO = "Nodaco35/my-portfolio";
  const GITHUB_BRANCH = "main";
  const NOTES_DIR = "note";
  const CACHE_KEY = "nodaco_notes_list_cache";
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // State
  let allNotes = [];
  let currentNote = null;

  // DOM Elements
  const drawer = document.getElementById("notesDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerToggle = document.getElementById("drawerToggle");
  const btnCloseDrawer = document.getElementById("btnCloseDrawer");
  const btnRefresh = document.getElementById("btnRefresh");
  const searchInput = document.getElementById("searchInput");
  const notesList = document.getElementById("notesList");
  const notesBadge = document.getElementById("notesBadge");

  const noteDisplayTitle = document.getElementById("noteDisplayTitle");
  const noteFileBadge = document.getElementById("noteFileBadge");
  const btnShare = document.getElementById("btnShare");
  const btnRawDoc = document.getElementById("btnRawDoc");
  const markdownBody = document.getElementById("markdownBody");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const fabScrollTop = document.getElementById("fabScrollTop");
  const toast = document.getElementById("toast");

  // ================= UI HELPERS =================
  function showToast(message, duration = 2200) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  function formatTitle(filename) {
    return filename
      .replace(/\.md$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  function toggleDrawer(open) {
    if (!drawer || !drawerBackdrop) return;
    const shouldOpen = open !== undefined ? open : !drawer.classList.contains("open");
    if (shouldOpen) {
      drawer.classList.add("open");
      drawerBackdrop.classList.add("active");
      document.body.style.overflow = window.innerWidth < 992 ? "hidden" : "";
    } else {
      drawer.classList.remove("open");
      drawerBackdrop.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  // ================= FETCH NOTES LIST =================
  async function fetchNotesList(forceRefresh = false) {
    // Check sessionStorage cache first
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data && parsed.data.length > 0) {
            return parsed.data;
          }
        }
      } catch (e) {
        console.warn("Lỗi đọc cache:", e);
      }
    }

    // Try GitHub Contents API first
    try {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${NOTES_DIR}`;
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/vnd.github.v3+json" }
      });

      if (response.ok) {
        const data = await response.json();
        const mdFiles = data
          .filter(item => item.type === "file" && item.name.toLowerCase().endsWith(".md"))
          .map(item => ({
            name: item.name,
            title: formatTitle(item.name),
            path: item.path,
            download_url: item.download_url
          }));

        if (mdFiles.length > 0) {
          saveCache(mdFiles);
          return mdFiles;
        }
      }
    } catch (apiErr) {
      console.warn("GitHub API fetch thất bại, chuyển sang fallback notes.json:", apiErr);
    }

    // Fallback: Read local notes.json
    try {
      const fallbackResponse = await fetch("notes.json?t=" + Date.now());
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const items = fallbackData.map(item => ({
          name: item.name,
          title: item.title || formatTitle(item.name),
          path: item.path || `note/${item.name}`,
          download_url: null
        }));
        saveCache(items);
        return items;
      }
    } catch (localErr) {
      console.error("Không thể tải notes.json:", localErr);
    }

    return [];
  }

  function saveCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {
      console.warn("Không thể lưu cache:", e);
    }
  }

  // ================= RENDER NOTES LIST =================
  function renderNotesList(notesToRender) {
    if (!notesList) return;
    notesList.innerHTML = "";

    if (notesToRender.length === 0) {
      notesList.innerHTML = `<li class="empty-state">Không tìm thấy ghi chú nào phù hợp.</li>`;
      return;
    }

    notesToRender.forEach(note => {
      const li = document.createElement("li");
      li.className = "note-item" + (currentNote && currentNote.name === note.name ? " active" : "");
      li.setAttribute("data-filename", note.name);

      li.innerHTML = `
        <div class="note-item-title">${escapeHtml(note.title)}</div>
        <div class="note-item-meta">
          <svg viewBox="0 0 16 16"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/></svg>
          <span>${escapeHtml(note.name)}</span>
        </div>
      `;

      li.addEventListener("click", () => {
        selectNote(note, true);
        if (window.innerWidth < 992) {
          toggleDrawer(false);
        }
      });

      notesList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ================= LOAD & RENDER SINGLE NOTE =================
  async function selectNote(note, updateHistory = true) {
    if (!note) return;
    currentNote = note;

    // Update active class in list
    document.querySelectorAll(".note-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-filename") === note.name);
    });

    // Update URL query parameter
    if (updateHistory) {
      const newUrl = `${window.location.pathname}?doc=${encodeURIComponent(note.name)}`;
      window.history.pushState({ doc: note.name }, "", newUrl);
    }
    document.title = `${note.title} | Nodaco's Notes`;

    // Update Header Bar
    if (noteDisplayTitle) noteDisplayTitle.textContent = note.title;
    if (noteFileBadge) noteFileBadge.innerHTML = `📄 ${escapeHtml(note.name)}`;
    if (btnRawDoc) {
      btnRawDoc.href = `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/note/${encodeURIComponent(note.name)}`;
    }

    // Show Loading
    if (loadingIndicator) loadingIndicator.style.display = "flex";
    if (markdownBody) markdownBody.innerHTML = "";

    try {
      // Priority 1: fetch from local relative path ../note/filename.md
      let content = "";
      const localUrl = `../note/${encodeURIComponent(note.name)}`;

      let resp = await fetch(localUrl + "?t=" + Date.now());
      if (resp.ok) {
        content = await resp.text();
      } else if (note.download_url) {
        // Priority 2: fallback to GitHub raw download url
        resp = await fetch(note.download_url);
        if (resp.ok) content = await resp.text();
      }

      if (!content) {
        throw new Error("Không thể tải nội dung file ghi chú.");
      }

      // Parse Markdown
      renderMarkdownContent(content);
    } catch (err) {
      console.error("Lỗi khi tải ghi chú:", err);
      if (markdownBody) {
        markdownBody.innerHTML = `
          <div style="text-align:center; padding: 40px 10px; color: #f85149;">
            <h3>⚠️ Không thể mở bài viết này</h3>
            <p style="margin-top: 8px; color: var(--text-secondary); font-size: 0.95rem;">
              ${escapeHtml(err.message || "File có thể chưa được đồng bộ lên máy chủ.")}
            </p>
          </div>
        `;
      }
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderMarkdownContent(rawMarkdown) {
    if (!window.marked) {
      markdownBody.innerHTML = `<pre>${escapeHtml(rawMarkdown)}</pre>`;
      return;
    }

    // Configure marked
    window.marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false
    });

    const html = window.marked.parse(rawMarkdown);
    markdownBody.innerHTML = html;

    // Enhance Tables for mobile: wrap with .table-responsive
    const tables = markdownBody.querySelectorAll("table");
    tables.forEach(table => {
      const wrapper = document.createElement("div");
      wrapper.className = "table-responsive";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    // Enhance Code Blocks: syntax highlight & copy button
    const preBlocks = markdownBody.querySelectorAll("pre");
    preBlocks.forEach(pre => {
      const code = pre.querySelector("code");
      if (!code) return;

      // Extract language class (e.g. language-js)
      let lang = "code";
      code.classList.forEach(cls => {
        if (cls.startsWith("language-")) {
          lang = cls.replace("language-", "");
        }
      });

      // Highlight with highlight.js if available
      if (window.hljs) {
        window.hljs.highlightElement(code);
      }

      // Create custom container
      const container = document.createElement("div");
      container.className = "code-block-wrapper";

      const header = document.createElement("div");
      header.className = "code-block-header";
      header.innerHTML = `
        <span>${escapeHtml(lang.toUpperCase())}</span>
        <button class="btn-copy-code" type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
          </svg>
          <span>Copy</span>
        </button>
      `;

      const copyBtn = header.querySelector(".btn-copy-code");
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.innerText);
          copyBtn.innerHTML = `<span>✓ Copied!</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
              </svg>
              <span>Copy</span>
            `;
          }, 2000);
          showToast("Đã sao chép đoạn mã!");
        } catch (copyErr) {
          showToast("Không thể sao chép đoạn mã.");
        }
      });

      pre.parentNode.insertBefore(container, pre);
      container.appendChild(header);
      container.appendChild(pre);
    });
  }

  // ================= SHARE & URL SYNC =================
  async function handleShare() {
    if (!currentNote) return;
    const shareUrl = window.location.href;
    const shareData = {
      title: `${currentNote.title} - Nodaco Notes`,
      text: `Đọc ghi chú "${currentNote.title}" trên portfolio của Nodaco:`,
      url: shareUrl
    };

    if (navigator.share && /mobile/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled share or failed, fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Đã sao chép liên kết ghi chú vào bộ nhớ tạm!");
    } catch (e) {
      showToast("Không thể sao chép link.");
    }
  }

  // ================= EVENT LISTENERS =================
  function setupEvents() {
    if (drawerToggle) {
      drawerToggle.addEventListener("click", () => toggleDrawer(true));
    }
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener("click", () => toggleDrawer(false));
    }
    if (drawerBackdrop) {
      drawerBackdrop.addEventListener("click", () => toggleDrawer(false));
    }

    // Refresh button
    if (btnRefresh) {
      btnRefresh.addEventListener("click", async () => {
        showToast("Đang làm mới danh sách ghi chú...");
        btnRefresh.style.transform = "rotate(180deg)";
        sessionStorage.removeItem(CACHE_KEY);
        allNotes = await fetchNotesList(true);
        if (notesBadge) notesBadge.textContent = allNotes.length;
        renderNotesList(allNotes);
        setTimeout(() => { btnRefresh.style.transform = ""; }, 400);
      });
    }

    // Instant Search
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          renderNotesList(allNotes);
        } else {
          const filtered = allNotes.filter(note =>
            note.title.toLowerCase().includes(query) ||
            note.name.toLowerCase().includes(query)
          );
          renderNotesList(filtered);
        }
      });
    }

    // Share button
    if (btnShare) {
      btnShare.addEventListener("click", handleShare);
    }

    // Floating action button - Scroll to top
    if (fabScrollTop) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
          fabScrollTop.classList.add("show");
        } else {
          fabScrollTop.classList.remove("show");
        }
      });

      fabScrollTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Browser back/forward navigation support
    window.addEventListener("popstate", (e) => {
      const urlParams = new URLSearchParams(window.location.search);
      const docParam = urlParams.get("doc");
      if (docParam && allNotes.length > 0) {
        const found = allNotes.find(n => n.name.toLowerCase() === docParam.toLowerCase());
        if (found) selectNote(found, false);
      }
    });
  }

  // ================= INITIALIZATION =================
  async function init() {
    setupEvents();

    if (loadingIndicator) loadingIndicator.style.display = "flex";

    allNotes = await fetchNotesList();
    if (notesBadge) notesBadge.textContent = allNotes.length;
    renderNotesList(allNotes);

    if (allNotes.length === 0) {
      if (loadingIndicator) loadingIndicator.style.display = "none";
      if (markdownBody) {
        markdownBody.innerHTML = `
          <div style="text-align:center; padding: 60px 10px;">
            <h3>Chưa có ghi chú nào</h3>
            <p style="color: var(--text-secondary); margin-top: 8px;">
              Hãy thêm file .md vào thư mục <code>note/</code> và đẩy lên GitHub.
            </p>
          </div>
        `;
      }
      return;
    }

    // Check URL query param ?doc=...
    const urlParams = new URLSearchParams(window.location.search);
    const targetDoc = urlParams.get("doc");
    let initialNote = allNotes[0];

    if (targetDoc) {
      const match = allNotes.find(n => n.name.toLowerCase() === targetDoc.toLowerCase());
      if (match) initialNote = match;
    }

    await selectNote(initialNote, !targetDoc);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
