import { api } from "./api.js";
import { logout, requireSession } from "./auth.js";

const session = requireSession();

const state = {
    documents: [],
    history: []
};

const elements = {
    username: document.getElementById("username"),
    userMeta: document.getElementById("userMeta"),
    pageTitle: document.getElementById("pageTitle"),
    navButtons: document.querySelectorAll("[data-section-target]"),
    sections: document.querySelectorAll("[data-section]"),
    logoutButton: document.getElementById("logoutButton"),
    dropZone: document.getElementById("dropZone"),
    fileInput: document.getElementById("fileInput"),
    uploadButton: document.getElementById("uploadButton"),
    uploadStatus: document.getElementById("uploadStatus"),
    progressBar: document.getElementById("progressBar"),
    documentSearch: document.getElementById("documentSearch"),
    documentsGrid: document.getElementById("documentsGrid"),
    chatForm: document.getElementById("chatForm"),
    questionInput: document.getElementById("questionInput"),
    sendButton: document.getElementById("sendButton"),
    chatLog: document.getElementById("chatLog"),
    historyList: document.getElementById("historyList"),
    statsDocuments: document.getElementById("statsDocuments"),
    statsMessages: document.getElementById("statsMessages"),
    statsChunks: document.getElementById("statsChunks"),
    toast: document.getElementById("toast")
};

function showToast(message, type = "success") {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type === "error" ? "error" : ""}`;
    setTimeout(() => {
        elements.toast.className = "toast";
    }, 3200);
}

function formatTime(value = new Date()) {
    return new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short"
    }).format(new Date(value));
}

function parseHistoryMessage(message) {
    try {
        return JSON.parse(message.message);
    } catch {
        return {
            type: "legacy",
            question: message.message,
            answer: "",
            created_at: null
        };
    }
}

function setSection(sectionName) {
    elements.sections.forEach((section) => {
        section.classList.toggle("active", section.dataset.section === sectionName);
    });

    elements.navButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.sectionTarget === sectionName);
    });

    const activeButton = [...elements.navButtons].find(
        (button) => button.dataset.sectionTarget === sectionName
    );
    elements.pageTitle.textContent = activeButton ? activeButton.textContent.trim() : "Dashboard";
}

function renderStats() {
    elements.statsDocuments.textContent = state.documents.length;
    elements.statsMessages.textContent = state.history.length;
    elements.statsChunks.textContent = state.documents.reduce(
        (total, doc) => total + Number(doc.chunks || 0),
        0
    );
}

function renderDocuments() {
    const search = elements.documentSearch.value.trim().toLowerCase();
    const documents = state.documents.filter((doc) =>
        doc.filename.toLowerCase().includes(search)
    );

    if (documents.length === 0) {
        elements.documentsGrid.innerHTML = `<div class="empty">No documents found.</div>`;
        renderStats();
        return;
    }

    elements.documentsGrid.innerHTML = documents.map((doc) => `
        <article class="doc-card">
            <div class="doc-card-header">
                <h3>${escapeHtml(doc.filename)}</h3>
                <button class="doc-delete-button" type="button" data-document-id="${doc.id}" data-document-name="${escapeHtml(doc.filename)}" title="Delete document" aria-label="Delete ${escapeHtml(doc.filename)}">
                    &times;
                </button>
            </div>
            <div class="meta">Document ID: ${doc.id}</div>
            <div class="meta">${doc.characters || 0} characters</div>
            <div class="meta">${doc.chunks || 0} chunk(s)</div>
        </article>
    `).join("");

    renderStats();
}

function addChatMessage(role, text, createdAt = new Date()) {
    const message = document.createElement("div");
    message.className = `message ${role}`;
    message.innerHTML = `
        ${escapeHtml(text)}
        <span class="timestamp">${formatTime(createdAt)}</span>
    `;
    elements.chatLog.appendChild(message);
    elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
    return message;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderHistory() {
    const chatItems = state.history
        .map(parseHistoryMessage)
        .filter((item) => item.question || item.answer);

    if (chatItems.length === 0) {
        elements.historyList.innerHTML = `<div class="empty">No chat history yet.</div>`;
        elements.chatLog.innerHTML = `<div class="empty">Ask a question from your uploaded documents.</div>`;
        renderStats();
        return;
    }

    elements.historyList.innerHTML = chatItems.slice().reverse().map((item) => `
        <article class="history-card">
            <h3>${escapeHtml(item.question || "Message")}</h3>
            <p>${escapeHtml(item.answer || "")}</p>
            <div class="meta">${item.created_at ? formatTime(item.created_at) : "Saved in PostgreSQL"}</div>
        </article>
    `).join("");

    elements.chatLog.innerHTML = "";
    chatItems.forEach((item) => {
        if (item.question) {
            addChatMessage("user", item.question, item.created_at || new Date());
        }
        if (item.answer) {
            addChatMessage("assistant", item.answer, item.created_at || new Date());
        }
    });

    renderStats();
}

async function loadDocuments() {
    try {
        state.documents = await api.getDocuments(session.user.id);
        renderDocuments();
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function deleteDocument(documentId, filename) {
    const confirmed = window.confirm(`Permanently delete "${filename}"?`);

    if (!confirmed) {
        return;
    }

    try {
        await api.deleteDocument(documentId, session.user.id);
        showToast("Document deleted.");
        await loadDocuments();
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function loadHistory() {
    try {
        state.history = await api.getMessages(session.user.id);
        renderHistory();
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function uploadSelectedFile(file) {
    if (!file) {
        showToast("Choose a PDF first.", "error");
        return;
    }

    if (file.type !== "application/pdf") {
        showToast("Only PDF files are supported.", "error");
        return;
    }

    elements.uploadButton.disabled = true;
    elements.uploadStatus.textContent = "Uploading and indexing document...";
    elements.progressBar.style.width = "5%";

    try {
        const result = await api.uploadDocument(file, session.user.id, (progress) => {
            elements.progressBar.style.width = `${progress}%`;
        });
        elements.uploadStatus.textContent = `${result.filename} uploaded with ${result.chunks} chunk(s).`;
        showToast("Document uploaded successfully.");
        await loadDocuments();
    } catch (error) {
        elements.uploadStatus.textContent = "Upload failed.";
        showToast(error.message, "error");
    } finally {
        elements.uploadButton.disabled = false;
        setTimeout(() => {
            elements.progressBar.style.width = "0";
        }, 900);
    }
}

async function sendQuestion(event) {
    event.preventDefault();

    const question = elements.questionInput.value.trim();

    if (!question) {
        return;
    }

    if (state.documents.length === 0) {
        showToast("Upload a PDF before asking questions.", "error");
    }

    elements.questionInput.value = "";
    elements.sendButton.disabled = true;
    addChatMessage("user", question);
    const typingMessage = addChatMessage("assistant", "Typing...");

    try {
        const response = await api.chat(question, session.user.id);
        typingMessage.innerHTML = `
            ${escapeHtml(response.answer)}
            <span class="timestamp">${formatTime()}</span>
        `;
        await loadHistory();
    } catch (error) {
        typingMessage.innerHTML = `
            ${escapeHtml(error.message)}
            <span class="timestamp">${formatTime()}</span>
        `;
        showToast(error.message, "error");
    } finally {
        elements.sendButton.disabled = false;
        elements.questionInput.focus();
    }
}

function bindEvents() {
    elements.navButtons.forEach((button) => {
        button.addEventListener("click", () => setSection(button.dataset.sectionTarget));
    });

    elements.logoutButton.addEventListener("click", logout);
    elements.documentSearch.addEventListener("input", renderDocuments);
    elements.chatForm.addEventListener("submit", sendQuestion);
    elements.documentsGrid.addEventListener("click", (event) => {
        const deleteButton = event.target.closest("[data-document-id]");

        if (!deleteButton) {
            return;
        }

        deleteDocument(
            deleteButton.dataset.documentId,
            deleteButton.dataset.documentName
        );
    });

    elements.uploadButton.addEventListener("click", () => {
        uploadSelectedFile(elements.fileInput.files[0]);
    });

    elements.dropZone.addEventListener("click", () => elements.fileInput.click());
    elements.dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("dragging");
    });
    elements.dropZone.addEventListener("dragleave", () => {
        elements.dropZone.classList.remove("dragging");
    });
    elements.dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("dragging");
        const file = event.dataTransfer.files[0];
        elements.fileInput.files = event.dataTransfer.files;
        uploadSelectedFile(file);
    });
}

async function init() {
    if (!session) {
        return;
    }

    elements.username.textContent = session.user.username;
    elements.userMeta.textContent = `User ID ${session.user.id}`;
    bindEvents();
    setSection("overview");
    await Promise.all([
        loadDocuments(),
        loadHistory()
    ]);
}

init();
