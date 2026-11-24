const quillEditors = {};
const EDITOR_BACKING_INPUT_MAP = {
  ticketDescriptionEditor: "ticketDescription",
  detailAdminNoteEditor: "detailAdminNote",
  adminActionNoteEditor: "adminActionNote",
  borrowPurposeEditor: "borrowPurpose",
  inputKbContentEditor: "inputKbContent",
  editHistoryNotesEditor: "editHistoryNotes"
};

function syncEditorToBackingInput(editorId) {
  const backingId = EDITOR_BACKING_INPUT_MAP[editorId];
  if (!backingId) return;
  const backingEl = document.getElementById(backingId);
  if (!backingEl) return;
  const q = quillEditors[editorId];
  if (q) {
    backingEl.value = (q.getText() || "").trim();
  } else {
    const el = document.getElementById(editorId);
    if (el) backingEl.value = (el.innerText || "").trim();
  }
}

function initQuillEditor(editorId, options = {}) {
  const el = document.getElementById(editorId);
  if (!el) return null;
  if (quillEditors[editorId]) return quillEditors[editorId];

  const placeholder = options.placeholder || el.getAttribute("data-placeholder") || "พิมพ์ข้อความที่นี่...";
  if (typeof window.Quill !== "function") {
    // Graceful fallback if Quill CDN is unavailable
    el.setAttribute("contenteditable", "true");
    el.classList.add("rich-editor-content", "p-3", "min-h-[100px]", "outline-none");
    el.addEventListener("input", () => syncEditorToBackingInput(editorId));
    return null;
  }

  const allowImage = options.allowImage !== false;
  const toolbarConfig = options.compact
    ? [
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        allowImage ? ["link", "image", "clean"] : ["link", "clean"]
      ]
    : [
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        allowImage ? ["link", "image", "clean"] : ["link", "clean"]
      ];

  const q = new window.Quill(el, {
    theme: "snow",
    placeholder: placeholder,
    modules: {
      toolbar: {
        container: toolbarConfig,
        handlers: {
          image: function () {
            const fileInputId = options.imageInputId;
            const existingInput = fileInputId ? document.getElementById(fileInputId) : null;
            if (existingInput) {
              existingInput.click();
              return;
            }
            const tempInput = document.createElement("input");
            tempInput.type = "file";
            tempInput.accept = "image/*";
            tempInput.multiple = true;
            tempInput.onchange = () => handleRichEditorImagePick(tempInput, editorId);
            tempInput.click();
          }
        }
      }
    }
  });

  // Handle image paste & drag-drop inside Quill editor root via existing compressor
  if (q.root) {
    q.root.addEventListener("paste", (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(it => it.kind === "file" && it.type && it.type.startsWith("image/"));
      if (imageItems.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        imageItems.forEach(it => {
          const file = it.getAsFile();
          if (file) insertImageFileIntoRichEditor(editorId, file);
        });
      }
    }, true);

    q.root.addEventListener("drop", (e) => {
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type && f.type.startsWith("image/"));
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        files.forEach(f => insertImageFileIntoRichEditor(editorId, f));
      }
    }, true);
  }

  q.on("text-change", () => {
    syncEditorToBackingInput(editorId);
  });

  quillEditors[editorId] = q;
  return q;
}

function initAllStaticQuillEditors() {
  initQuillEditor("ticketDescriptionEditor", {
    imageInputId: "ticketDescInlineImageInput",
    allowImage: true
  });
  initQuillEditor("detailAdminNoteEditor", {
    imageInputId: "detailAdminNoteImageInput",
    compact: true,
    allowImage: true
  });
  initQuillEditor("replyMessageInput", {
    imageInputId: "replyInlineImageInput",
    compact: true,
    allowImage: true
  });
  initQuillEditor("adminActionNoteEditor", {
    imageInputId: "adminActionNoteImageInput",
    compact: true,
    allowImage: true
  });
  initQuillEditor("borrowPurposeEditor", {
    compact: true,
    allowImage: false
  });
  initQuillEditor("inputKbContentEditor", {
    compact: true,
    allowImage: false
  });
  initQuillEditor("editHistoryNotesEditor", {
    compact: true,
    allowImage: false
  });
}

function setRichEditorContent(editorId, htmlOrText = "", isHtml = false) {
  const q = quillEditors[editorId] || initQuillEditor(editorId, { compact: true });
  const raw = String(htmlOrText || "");
  if (q) {
    if (!raw.trim()) {
      q.setText("");
    } else if (isHtml || /<[a-z][\s\S]*>/i.test(raw)) {
      q.root.innerHTML = sanitizeRichHtml(raw);
    } else {
      q.setText(raw);
    }
    syncEditorToBackingInput(editorId);
    return;
  }
  const el = document.getElementById(editorId);
  if (!el) return;
  if ("value" in el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
    el.value = raw;
  } else if (isHtml || /<[a-z][\s\S]*>/i.test(raw)) {
    el.innerHTML = sanitizeRichHtml(raw);
  } else {
    el.innerText = raw;
  }
  syncEditorToBackingInput(editorId);
}

function clearRichEditor(editorId) {
  setRichEditorContent(editorId, "", false);
}

function focusRichEditor(editorId) {
  const q = quillEditors[editorId];
  if (q) {
    q.focus();
    return;
  }
  const el = document.getElementById(editorId);
  if (el) el.focus();
}

function getRichEditorData(editorId) {
  const q = quillEditors[editorId];
  if (q && q.root) {
    const html = sanitizeRichHtml(q.root.innerHTML);
    const text = (q.getText() || "").trim();
    const hasImages = /<img\b/i.test(html);
    syncEditorToBackingInput(editorId);
    return { html, text, hasImages };
  }
  const el = document.getElementById(editorId);
  if (!el) return { html: "", text: "", hasImages: false };
  if ("value" in el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
    const text = (el.value || "").trim();
    const html = text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") : "";
    return { html, text, hasImages: false };
  }
  const rootEl = el.querySelector?.(".ql-editor") || el;
  const html = sanitizeRichHtml(rootEl.innerHTML);
  const text = (rootEl.innerText || "").trim();
  const hasImages = /<img\b/i.test(html);
  return { html, text, hasImages };
}

function execRichCmd(editorId, cmd, value = null) {
  const q = quillEditors[editorId];
  if (q) {
    q.focus();
    if (cmd === "bold") q.format("bold", !q.getFormat().bold);
    else if (cmd === "underline") q.format("underline", !q.getFormat().underline);
    else if (cmd === "removeFormat") {
      const range = q.getSelection();
      if (range) q.removeFormat(range.index, range.length);
    }
    return;
  }
  const el = document.getElementById(editorId);
  if (!el) return;
  el.focus();
  try {
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, value);
  } catch (_) {}
}

function applyRichTextColor(editorId, colorHex) {
  const q = quillEditors[editorId];
  if (q) {
    q.focus();
    q.format("color", colorHex);
    return;
  }
  const el = document.getElementById(editorId);
  if (!el) return;
  el.focus();
  try {
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, colorHex);
  } catch (_) {}
}

function insertImageFileIntoRichEditor(editorId, file) {
  const el = document.getElementById(editorId);
  if (!el || !file || !file.type || !file.type.startsWith("image/")) return;
  readAndPrepareAttachmentFile(file, (dataUrl, fileName) => {
    const q = quillEditors[editorId];
    if (q) {
      q.focus();
      const range = q.getSelection(true);
      const index = range ? range.index : q.getLength();
      q.insertEmbed(index, "image", dataUrl, "user");
      q.setSelection(index + 1, 0);
      syncEditorToBackingInput(editorId);
      return;
    }
    el.focus();
    const safeAlt = escapeQuotes(fileName || "image");
    const imgHtml = `<img src="${dataUrl}" alt="${safeAlt}" />&nbsp;`;
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        document.execCommand("insertHTML", false, imgHtml);
      } else {
        el.insertAdjacentHTML("beforeend", (el.innerHTML.trim() ? "<br>" : "") + imgHtml);
      }
    } catch (_) {
      el.insertAdjacentHTML("beforeend", (el.innerHTML.trim() ? "<br>" : "") + imgHtml);
    }
  });
}

function handleRichEditorPaste(e, editorId) {
  const items = Array.from(e.clipboardData?.items || []);
  const imageItems = items.filter(it => it.kind === "file" && it.type && it.type.startsWith("image/"));
  if (imageItems.length > 0) {
    e.preventDefault();
    imageItems.forEach(it => {
      const file = it.getAsFile();
      if (file) insertImageFileIntoRichEditor(editorId, file);
    });
  }
}

function handleRichEditorDrop(e, editorId) {
  const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type && f.type.startsWith("image/"));
  if (files.length > 0) {
    e.preventDefault();
    e.stopPropagation();
    files.forEach(f => insertImageFileIntoRichEditor(editorId, f));
  }
}

function handleRichEditorImagePick(input, editorId) {
  const files = Array.from(input?.files || []);
  if (files.length === 0) return;
  files.forEach(f => insertImageFileIntoRichEditor(editorId, f));
  if (input && "value" in input) {
    try { input.value = ""; } catch (_) {}
  }
}

function handleRichDisplayImageClick(e) {
  const target = e.target;
  if (target && target.tagName && target.tagName.toUpperCase() === "IMG" && target.src) {
    openAttachmentPreviewModal({
      refId: "INLINE-IMG",
      name: target.alt || "รูปภาพประกอบ",
      isImage: true,
      displaySrc: target.src,
      base64: target.src.startsWith("data:") ? target.src : "",
      driveViewUrl: ""
    });
  }
}

const STORAGE_KEY_TICKET_RICH_CACHE = "it_asset_ticket_rich_cache";

function loadTicketRichCacheMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TICKET_RICH_CACHE);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveTicketRichCache(ticket) {
  if (!ticket || !ticket.ticket_id) return;
  try {
    const map = loadTicketRichCacheMap();
    const atts = Array.isArray(ticket.attachments)
      ? ticket.attachments.map(a => ({
          name: a.name || "",
          mime: a.mime || "",
          url: a.url || "",
          drive_file_id: a.drive_file_id || "",
          base64: (!a.drive_file_id && a.base64 && String(a.base64).length < 200000) ? a.base64 : ""
        }))
      : [];
    const safeComments = Array.isArray(ticket.comments)
      ? ticket.comments.map(c => ({
          sender: c.sender || "",
          message: c.message || "",
          message_html: (c.message_html && String(c.message_html).length < 200000) ? c.message_html : "",
          time: c.time || "",
          edited_at: c.edited_at || "",
          is_internal: !!c.is_internal,
          attachments: Array.isArray(c.attachments)
            ? c.attachments.map(ca => ({
                name: ca.name || "",
                mime: ca.mime || "",
                url: ca.url || "",
                drive_file_id: ca.drive_file_id || "",
                base64: (!ca.drive_file_id && ca.base64 && String(ca.base64).length < 150000) ? ca.base64 : ""
              }))
            : []
        }))
      : [];
    map[ticket.ticket_id] = {
      description: ticket.description || "",
      description_html: (ticket.description_html && String(ticket.description_html).length < 300000) ? ticket.description_html : "",
      attachments: atts,
      comments: safeComments,
      updated_at: Date.now()
    };
    const keys = Object.keys(map);
    if (keys.length > 40) {
      keys.sort((a, b) => (map[a].updated_at || 0) - (map[b].updated_at || 0));
      keys.slice(0, keys.length - 40).forEach(k => delete map[k]);
    }
    localStorage.setItem(STORAGE_KEY_TICKET_RICH_CACHE, JSON.stringify(map));
  } catch (_) {}
}

function getTicketRichCache(ticketId) {
  if (!ticketId) return null;
  const map = loadTicketRichCacheMap();
  return map[ticketId] || null;
}

async function replaceInlineImagesWithDriveUrls(rawHtml, prefix, refId) {
  const html = String(rawHtml || "");
  if (!html || !/data:image\//i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const src = img.getAttribute("src") || "";
    if (src.startsWith("data:image/")) {
      const extMatch = src.match(/^data:image\/([a-zA-Z0-9+]+);/i);
      const ext = extMatch ? extMatch[1].replace("jpeg", "jpg") : "png";
      const fileName = `${prefix}_IMG_${i + 1}.${ext}`;
      try {
        const driveRes = await uploadFileToGoogleDrive(src, fileName, "Tickets", refId);
        const fileId = driveRes?.fileId || "";
        if (fileId && !String(fileId).startsWith("DRV_")) {
          img.setAttribute("src", `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`);
        }
      } catch (_) {}
    }
  }
  return doc.body.innerHTML;
}
