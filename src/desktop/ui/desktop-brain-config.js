/**
 * Brain configuration panel for desktop play (sidebar dock).
 */
(function (global) {
    "use strict";

    function t(key, params) {
        if (global.ShmerlingStrings && typeof global.ShmerlingStrings.t === "function") {
            return global.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    const ENGINE_OPTIONS = [
        { value: "brain43", label: t("play.newGameDialog.brain43") },
        { value: "brain42", label: t("play.newGameDialog.brain42") },
        { value: "brain41", label: t("play.newGameDialog.brain41") },
        { value: "brain4", label: t("play.newGameDialog.brain4") },
        { value: "brain3", label: t("site.playNow.brain3") },
        { value: "brain2", label: t("site.playNow.brain2") },
        { value: "brain", label: t("desktop.brainConfig.brainLabel") },
    ];

    const PAWN_FILE_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

    const SECTION_TITLES = {
        pieceScores: t("desktop.brainConfig.pieceScores"),
        specialEvaluations: t("desktop.brainConfig.specialEvaluations"),
        gamePhase: t("desktop.brainConfig.gamePhase"),
        "pawnFileValues.openingMidGame": t("desktop.brainConfig.pawnFilesOpeningMid"),
        "pawnFileValues.endGame": t("desktop.brainConfig.pawnFilesEndGame"),
    };

    let panelRoot = null;
    let engineSelect = null;
    let statusEl = null;
    let tableBody = null;
    let saveBtn = null;
    let discardBtn = null;

    const state = {
        engine: "brain43",
        saved: null,
        draft: null,
        dirty: false,
    };

    function humanizeKey(key) {
        return key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, function (c) {
                return c.toUpperCase();
            })
            .trim();
    }

    function sectionTitle(section) {
        return SECTION_TITLES[section] || humanizeKey(section);
    }

    /**
     * Flat list of editable numeric fields (section + key).
     * @param {object} config
     * @returns {{ section: string, key: string, label: string }[]}
     */
    /** Panel edits flat sections; brain42 phased blocks (mid/end) stay on save. */
    function normalizeConfigForPanel(config, engine) {
        const copy = JSON.parse(JSON.stringify(config || {}));
        if ((engine !== "brain42" && engine !== "brain43") || !copy.startGame) {
            return copy;
        }
        if (!copy.pieceScores && copy.startGame.pieceScores) {
            copy.pieceScores = copy.startGame.pieceScores;
        }
        if (!copy.specialEvaluations && copy.startGame.specialEvaluations) {
            copy.specialEvaluations = copy.startGame.specialEvaluations;
        }
        return copy;
    }

    function getConfigBlock(cfg, sectionPath) {
        if (!cfg) {
            return undefined;
        }
        const parts = sectionPath.split(".");
        let block = cfg;
        for (let i = 0; i < parts.length; i++) {
            block = block && block[parts[i]];
        }
        return block;
    }

    function setConfigBlock(cfg, sectionPath, key, value) {
        const parts = sectionPath.split(".");
        let block = cfg;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!block[part] || typeof block[part] !== "object") {
                block[part] = {};
            }
            block = block[part];
        }
        block[key] = value;
    }

    function prepareConfigForSave(draft, engine) {
        const copy = JSON.parse(JSON.stringify(draft || {}));
        if ((engine === "brain42" || engine === "brain43") && copy.startGame) {
            if (copy.pieceScores) {
                copy.startGame.pieceScores = copy.pieceScores;
                delete copy.pieceScores;
            }
            if (copy.specialEvaluations) {
                copy.startGame.specialEvaluations = copy.specialEvaluations;
                delete copy.specialEvaluations;
            }
        }
        return copy;
    }

    function buildFieldList(config) {
        const fields = [];
        if (!config || typeof config !== "object") {
            return fields;
        }
        const sections = ["pieceScores", "specialEvaluations", "gamePhase"];
        for (let s = 0; s < sections.length; s++) {
            const section = sections[s];
            const block = config[section];
            if (!block || typeof block !== "object") {
                continue;
            }
            const keys = Object.keys(block).sort();
            for (let k = 0; k < keys.length; k++) {
                const key = keys[k];
                if (typeof block[key] === "number") {
                    fields.push({
                        section: section,
                        key: key,
                        label: humanizeKey(key),
                    });
                }
            }
        }
        if (config.pawnFileValues) {
            const pawnSections = ["pawnFileValues.openingMidGame", "pawnFileValues.endGame"];
            for (let p = 0; p < pawnSections.length; p++) {
                const sectionPath = pawnSections[p];
                const block = getConfigBlock(config, sectionPath);
                if (!block) {
                    continue;
                }
                for (let f = 0; f < PAWN_FILE_LETTERS.length; f++) {
                    const file = PAWN_FILE_LETTERS[f];
                    if (typeof block[file] === "number") {
                        fields.push({
                            section: sectionPath,
                            key: file,
                            label: file + " file",
                        });
                    }
                }
            }
        }
        return fields;
    }

    function getFieldValue(cfg, field) {
        const block = getConfigBlock(cfg, field.section);
        return block ? block[field.key] : undefined;
    }

    function setFieldValue(cfg, field, value) {
        setConfigBlock(cfg, field.section, field.key, value);
    }

    function inputStepForField(field) {
        if (field.section === "gamePhase") {
            return "1";
        }
        if (field.section.indexOf("pawnFileValues") === 0) {
            return "0.01";
        }
        return "0.01";
    }

    function setDirty(dirty) {
        state.dirty = !!dirty;
        if (panelRoot) {
            panelRoot.classList.toggle("desktop-play-config--dirty", state.dirty);
        }
        if (saveBtn) {
            saveBtn.disabled = !state.dirty;
        }
        if (discardBtn) {
            discardBtn.disabled = !state.dirty;
        }
    }

    function isDraftDirty() {
        const fields = buildFieldList(state.draft);
        return fields.some(function (field) {
            return (
                Number(getFieldValue(state.draft, field))
                !== Number(getFieldValue(state.saved, field))
            );
        });
    }

    function renderTable() {
        if (!tableBody) {
            return;
        }
        tableBody.innerHTML = "";
        const fields = buildFieldList(state.draft || state.saved || {});
        let lastSection = null;

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.section !== lastSection) {
                lastSection = field.section;
                const headerRow = document.createElement("tr");
                headerRow.className = "desktop-play-config-group";
                const headerCell = document.createElement("td");
                headerCell.colSpan = 2;
                headerCell.textContent = sectionTitle(field.section);
                headerRow.appendChild(headerCell);
                tableBody.appendChild(headerRow);
            }

            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            nameCell.className = "desktop-play-config-name";
            nameCell.textContent = field.label;

            const valueCell = document.createElement("td");
            valueCell.className = "desktop-play-config-value";
            const input = document.createElement("input");
            input.type = "number";
            input.step = inputStepForField(field);
            const current = getFieldValue(state.draft, field);
            input.value = String(current != null ? current : 0);
            input.addEventListener("input", function () {
                const parsed = Number(input.value);
                setFieldValue(
                    state.draft,
                    field,
                    Number.isFinite(parsed) ? parsed : 0,
                );
                setDirty(isDraftDirty());
            });
            valueCell.appendChild(input);
            row.appendChild(nameCell);
            row.appendChild(valueCell);
            tableBody.appendChild(row);
        }
    }

    function updateStatusText() {
        if (!statusEl) {
            return;
        }
        const opt = ENGINE_OPTIONS.find(function (o) {
            return o.value === state.engine;
        });
        statusEl.textContent = opt ? opt.label : state.engine;
    }

    async function loadEngine(engineName) {
        const safe = ENGINE_OPTIONS.some(function (o) {
            return o.value === engineName;
        })
            ? engineName
            : "brain43";
        state.engine = safe;
        if (engineSelect) {
            engineSelect.value = safe;
        }
        if (statusEl) {
            statusEl.textContent = t("desktop.brainConfig.loading");
        }
        const Api = global.DesktopApi;
        if (!Api) {
            throw new Error("Desktop API is not available");
        }
        const response = await Api.get("/brain-config?engine=" + encodeURIComponent(safe));
        const loaded =
            response && response.config && typeof response.config === "object"
                ? response.config
                : { pieceScores: {} };
        const normalized = normalizeConfigForPanel(loaded, safe);
        state.saved = normalized;
        state.draft = JSON.parse(JSON.stringify(normalized));
        renderTable();
        setDirty(false);
        updateStatusText();
    }

    async function saveDraft() {
        const Api = global.DesktopApi;
        if (!Api) {
            throw new Error("Desktop API is not available");
        }
        const response = await Api.post("/brain-config", {
            engine: state.engine,
            config: prepareConfigForSave(state.draft, state.engine),
        });
        const saved =
            response && response.config && typeof response.config === "object"
                ? response.config
                : state.draft;
        const normalized = normalizeConfigForPanel(saved, state.engine);
        state.saved = normalized;
        state.draft = JSON.parse(JSON.stringify(normalized));
        renderTable();
        setDirty(false);
        updateStatusText();
    }

    function discardDraft() {
        if (!state.saved) {
            return;
        }
        state.draft = JSON.parse(JSON.stringify(state.saved));
        renderTable();
        setDirty(false);
    }

    function mountPanel(rootEl, options) {
        if (!rootEl || panelRoot) {
            return;
        }
        panelRoot = rootEl;
        panelRoot.className = "desktop-play-config-panel";
        panelRoot.innerHTML = "";

        const engineRow = document.createElement("div");
        engineRow.className = "desktop-play-config-engine";
        const engineLabel = document.createElement("label");
        engineLabel.setAttribute("for", "desktopBrainConfigEngine");
        engineLabel.textContent = t("desktop.brainConfig.brainLabel");
        engineSelect = document.createElement("select");
        engineSelect.id = "desktopBrainConfigEngine";
        engineSelect.className = "desktop-play-config-engine-select";
        ENGINE_OPTIONS.forEach(function (opt) {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            engineSelect.appendChild(option);
        });
        engineSelect.addEventListener("change", function () {
            if (state.dirty) {
                const proceed = global.confirm(
                    t("desktop.brainConfig.discardSwitchConfirm"),
                );
                if (!proceed) {
                    engineSelect.value = state.engine;
                    return;
                }
            }
            loadEngine(engineSelect.value).catch(function (err) {
                console.error("[BrainConfig]", err);
                if (global.alert) {
                    global.alert(err.message || t("classic.failedLoadBrainConfig"));
                }
            });
        });
        engineRow.appendChild(engineLabel);
        engineRow.appendChild(engineSelect);
        panelRoot.appendChild(engineRow);

        statusEl = document.createElement("p");
        statusEl.className = "desktop-play-config-status";
        panelRoot.appendChild(statusEl);

        const table = document.createElement("table");
        table.className = "desktop-play-config-table";
        table.innerHTML =
            "<thead><tr><th>Setting</th><th>Value</th></tr></thead><tbody></tbody>";
        tableBody = table.querySelector("tbody");
        panelRoot.appendChild(table);

        const actions = document.createElement("div");
        actions.className = "desktop-play-config-actions";
        saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "desktop-play-config-save";
        saveBtn.textContent = t("desktop.brainConfig.save");
        saveBtn.disabled = true;
        saveBtn.addEventListener("click", function () {
            saveDraft()
                .then(function () {
                    if (options && typeof options.onSaved === "function") {
                        options.onSaved(state.engine);
                    }
                })
                .catch(function (err) {
                    console.error("[BrainConfig]", err);
                    if (global.alert) {
                        global.alert(err.message || t("classic.failedSaveBrainConfig"));
                    }
                });
        });
        discardBtn = document.createElement("button");
        discardBtn.type = "button";
        discardBtn.className = "desktop-play-config-discard";
        discardBtn.textContent = t("desktop.brainConfig.discard");
        discardBtn.disabled = true;
        discardBtn.addEventListener("click", discardDraft);
        actions.appendChild(saveBtn);
        actions.appendChild(discardBtn);
        panelRoot.appendChild(actions);

        const initial =
            options && options.initialEngine ? options.initialEngine : "brain43";
        loadEngine(initial).catch(function (err) {
            console.error("[BrainConfig]", err);
        });
    }

    function syncEngine(engineName) {
        if (!panelRoot) {
            return;
        }
        loadEngine(engineName).catch(function (err) {
            console.error("[BrainConfig]", err);
        });
    }

    function hasUnsavedChanges() {
        return state.dirty;
    }

    global.DesktopBrainConfig = {
        mountPanel: mountPanel,
        syncEngine: syncEngine,
        hasUnsavedChanges: hasUnsavedChanges,
        ENGINE_OPTIONS: ENGINE_OPTIONS,
    };
})(window);
