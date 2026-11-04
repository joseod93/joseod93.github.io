(function () {
    "use strict";

    var STORAGE_KEY = "claude_bridge_config";

    var els = {
        configPanel: document.getElementById("config-panel"),
        btnConfig: document.getElementById("btn-config"),
        inputEndpoint: document.getElementById("input-endpoint"),
        inputToken: document.getElementById("input-token"),
        btnSave: document.getElementById("btn-save"),
        btnTest: document.getElementById("btn-test"),
        configMsg: document.getElementById("config-msg"),
        statusBadge: document.getElementById("status-badge"),
        messages: document.getElementById("messages"),
        inputPrompt: document.getElementById("input-prompt"),
        btnSend: document.getElementById("btn-send"),
        btnClear: document.getElementById("btn-clear")
    };

    var state = {
        endpoint: "",
        token: "",
        sending: false
    };

    function loadConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var cfg = JSON.parse(raw);
                state.endpoint = cfg.endpoint || "";
                state.token = cfg.token || "";
                els.inputEndpoint.value = state.endpoint;
                els.inputToken.value = state.token;
            }
        } catch (e) {}
    }

    function saveConfig() {
        state.endpoint = els.inputEndpoint.value.replace(/\/+$/, "");
        state.token = els.inputToken.value;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                endpoint: state.endpoint,
                token: state.token
            }));
        } catch (e) {}
        showConfigMsg("Saved.", "var(--success)");
    }

    function showConfigMsg(text, color) {
        els.configMsg.textContent = text;
        els.configMsg.style.color = color || "var(--text-muted)";
    }

    function setBadge(connected) {
        if (connected) {
            els.statusBadge.textContent = "Connected";
            els.statusBadge.classList.add("connected");
        } else {
            els.statusBadge.textContent = "Disconnected";
            els.statusBadge.classList.remove("connected");
        }
    }

    function testConnection() {
        if (!state.endpoint) {
            showConfigMsg("Enter an endpoint URL first.", "var(--error)");
            return;
        }
        showConfigMsg("Testing...", "var(--text-muted)");
        var headers = { "Content-Type": "application/json" };
        if (state.token) headers["Authorization"] = "Bearer " + state.token;

        fetch(state.endpoint + "/health", { method: "GET", headers: headers })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.status === "ok") {
                    showConfigMsg("Connection OK", "var(--success)");
                    setBadge(true);
                } else {
                    showConfigMsg("Unexpected response", "var(--error)");
                    setBadge(false);
                }
            })
            .catch(function (err) {
                showConfigMsg("Failed: " + err.message, "var(--error)");
                setBadge(false);
            });
    }

    function addMessage(text, type) {
        var welcome = els.messages.querySelector(".welcome");
        if (welcome) welcome.remove();

        var div = document.createElement("div");
        div.className = "msg msg-" + type;
        div.textContent = text;

        if (type === "assistant") {
            var meta = document.createElement("div");
            meta.className = "msg-meta";
            meta.textContent = new Date().toLocaleTimeString();
            div.appendChild(meta);
        }

        els.messages.appendChild(div);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function setLoading(loading) {
        state.sending = loading;
        els.btnSend.disabled = loading;
        els.btnSend.innerHTML = loading
            ? '<span class="spinner"></span>'
            : "Send";
    }

    function sendPrompt() {
        var text = els.inputPrompt.value.trim();
        if (!text || state.sending) return;

        if (!state.endpoint) {
            addMessage("Configure the relay endpoint first.", "error");
            return;
        }

        addMessage(text, "user");
        els.inputPrompt.value = "";
        setLoading(true);

        var headers = { "Content-Type": "application/json" };
        if (state.token) headers["Authorization"] = "Bearer " + state.token;

        fetch(state.endpoint + "/chat", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ prompt: text })
        })
            .then(function (r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(function (data) {
                setBadge(true);
                addMessage(data.response || JSON.stringify(data), "assistant");
            })
            .catch(function (err) {
                setBadge(false);
                addMessage("Error: " + err.message, "error");
            })
            .finally(function () {
                setLoading(false);
                els.inputPrompt.focus();
            });
    }

    function clearHistory() {
        els.messages.innerHTML =
            '<div class="welcome"><p>History cleared.</p></div>';
    }

    els.btnConfig.addEventListener("click", function () {
        els.configPanel.classList.toggle("hidden");
    });
    els.btnSave.addEventListener("click", saveConfig);
    els.btnTest.addEventListener("click", testConnection);
    els.btnSend.addEventListener("click", sendPrompt);
    els.btnClear.addEventListener("click", clearHistory);

    els.inputPrompt.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
        }
    });

    loadConfig();
    if (state.endpoint) testConnection();
})();
