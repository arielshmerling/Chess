/**
 * New-game options dialog (opened from sidebar).
 */
(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    const Settings = window.DesktopGameSettings;
    const Dialog = window.DesktopDialog;

    let activeHandle = null;

    function closeNewGameDialog() {
        if (activeHandle) {
            activeHandle.close();
            activeHandle = null;
        }
    }

    function showNewGameDialog(onStart) {
        closeNewGameDialog();
        const last = Settings.loadLastOptions();

        const form = document.createElement("form");
        form.className = "desktop-form desktop-form--new-game";

        const row = document.createElement("section");
        row.className = "desktop-new-game-block";
        row.innerHTML =
            '<h2 class="desktop-form-section-title">' + t("play.newGameDialog.yourColor") + "</h2>" +
            '<div class="desktop-option-group desktop-option-group--equal" role="radiogroup">' +
            '<label class="desktop-option-pill"><input type="radio" name="color" value="white"' +
            (last.color !== "black" ? " checked" : "") +
            "><span>" + t("common.white") + "</span></label>" +
            '<label class="desktop-option-pill"><input type="radio" name="color" value="black"' +
            (last.color === "black" ? " checked" : "") +
            "><span>" + t("common.black") + "</span></label></div>";
        form.appendChild(row);

        const fields = document.createElement("section");
        fields.className = "desktop-new-game-fields";
        const engineOptions =
            Settings && Array.isArray(Settings.ENGINE_OPTIONS) && Settings.ENGINE_OPTIONS.length
                ? Settings.ENGINE_OPTIONS
                : [
                      { value: "brain43", label: t("play.newGameDialog.brain43") },
                      { value: "brain42", label: t("play.newGameDialog.brain42") },
                      { value: "brain41", label: t("play.newGameDialog.brain41") },
                  ];
        const selectedEngine = Settings.normalizeEngine
            ? Settings.normalizeEngine(last.engine)
            : last.engine || "brain43";
        let engineOptionsHtml = "";
        for (let i = 0; i < engineOptions.length; i += 1) {
            const opt = engineOptions[i];
            engineOptionsHtml +=
                '<option value="' +
                opt.value +
                '"' +
                (selectedEngine === opt.value ? " selected" : "") +
                ">" +
                (opt.label || opt.value) +
                "</option>";
        }
        fields.innerHTML =
            '<div class="desktop-field"><label class="desktop-form-section-title" for="dlgEngine">' +
            t("play.newGameDialog.engine") +
            '</label><select name="engine" id="dlgEngine">' +
            engineOptionsHtml +
            "</select></div>" +
            '<div class="desktop-field"><label class="desktop-form-section-title" for="dlgTime">' +
            t("play.newGameDialog.timePerSideMinutes") +
            '</label><input type="number" name="timeMinutes" id="dlgTime" min="1" max="180" value="' +
            (last.timeMinutes || 90) +
            '"></div></section>';
        form.appendChild(fields);

        const checks = document.createElement("div");
        checks.className = "desktop-form-checks";
        checks.innerHTML =
            '<label class="desktop-check"><input type="checkbox" name="allowUndo" value="1"' +
            (last.allowUndo !== false ? " checked" : "") +
            '><span class="desktop-check-box" aria-hidden="true"></span><span>' +
            t("play.newGameDialog.allowUndo") +
            "</span></label>" +
            '<label class="desktop-check" title="' +
            t("play.newGameDialog.privateHint").replace(/"/g, "&quot;") +
            '"><input type="checkbox" name="private" value="1"' +
            (last.isPrivate === true ? " checked" : "") +
            '><span class="desktop-check-box" aria-hidden="true"></span><span>' +
            t("play.newGameDialog.private") +
            "</span></label>";
        form.appendChild(checks);

        const errP = document.createElement("p");
        errP.id = "dlgNewGameError";
        errP.className = "desktop-error";
        errP.hidden = true;
        form.appendChild(errP);

        const actions = document.createElement("div");
        actions.className = "desktop-play-dialog-actions";
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "desktop-btn";
        cancelBtn.textContent = t("common.cancel");
        const startBtn = document.createElement("button");
        startBtn.type = "button";
        startBtn.className = "desktop-btn desktop-btn-gold";
        startBtn.textContent = t("common.start");
        actions.appendChild(cancelBtn);
        actions.appendChild(startBtn);
        form.appendChild(actions);

        function submit() {
            const fd = new FormData(form);
            const gamePrefs = Settings.loadGamePreferences();
            const payload = {
                color: fd.get("color") || "white",
                engine: fd.get("engine") || "brain43",
                allowUndo: fd.get("allowUndo") === "1",
                isPrivate: fd.get("private") === "1",
                timeMinutes: parseInt(fd.get("timeMinutes"), 10) || 90,
                mouse: gamePrefs.mouse,
                thinkingTimeSeconds: gamePrefs.thinkingTimeSeconds,
                showAvailableMoves: gamePrefs.showAvailableMoves,
            };
            payload.thinkingTimeSeconds = Settings.normalizeThinkingTimeSeconds(
                payload.thinkingTimeSeconds,
            );
            payload.difficulty = payload.thinkingTimeSeconds;
            Settings.saveNewGameOptions(payload);
            closeNewGameDialog();
            onStart(payload);
        }

        cancelBtn.addEventListener("click", closeNewGameDialog);
        startBtn.addEventListener("click", submit);
        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            submit();
        });

        activeHandle = Dialog.open({
            title: t("play.newGameDialog.title"),
            body: form,
            panelClass: "desktop-play-dialog--new-game",
            dismissOnBackdrop: true,
            onCancel: closeNewGameDialog,
            onClose: function () {
                activeHandle = null;
            },
        });
    }

    window.DesktopNewGameDialog = {
        show: showNewGameDialog,
        close: closeNewGameDialog,
    };
})();
