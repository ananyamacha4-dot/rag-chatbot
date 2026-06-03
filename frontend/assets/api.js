const API_BASE_URL = "";

async function parseResponse(response) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(data.detail || data.message || "Request failed.");
    }

    return data;
}

export const api = {
    async signup(username, password) {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        return parseResponse(response);
    },

    async login(username, password) {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        return parseResponse(response);
    },

    async uploadDocument(file, userId, onProgress) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", userId);

        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open("POST", `${API_BASE_URL}/upload`);

            request.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable && onProgress) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            });

            request.addEventListener("load", () => {
                try {
                    const data = JSON.parse(request.responseText || "{}");

                    if (request.status >= 200 && request.status < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(data.detail || "Upload failed."));
                    }
                } catch (error) {
                    reject(error);
                }
            });

            request.addEventListener("error", () => reject(new Error("Upload failed.")));
            request.send(formData);
        });
    },

    async getDocuments(userId) {
        const response = await fetch(`${API_BASE_URL}/documents?user_id=${encodeURIComponent(userId)}`);
        return parseResponse(response);
    },

    async deleteDocument(documentId, userId) {
        const response = await fetch(
            `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}?user_id=${encodeURIComponent(userId)}`,
            {
                method: "DELETE"
            }
        );
        return parseResponse(response);
    },

    async chat(question, userId) {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question,
                user_id: userId
            })
        });

        return parseResponse(response);
    },

    async getMessages(userId) {
        const response = await fetch(`${API_BASE_URL}/messages/${userId}`);
        return parseResponse(response);
    }
};
