/**
 * New-game options dialog (opened from sidebar).
 */
(function () {
    "use strict";

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

        const row = document.createElement("div");
        row.className = "desktop-new-game-row";

        function colorBlock() {
            const sec = document.createElement("section");
            sec.className = "desktop-new-game-block";
            sec.innerHTML =
                '<h2 class="desktop-form-section-title">Your color</h2>' +
                '<div class="desktop-option-group desktop-option-group--equal" role="radiogroup">' +
                '<label class="desktop-option-pill"><input type="radio" name="color" value="white"' +
                (last.color !== "black" ? " checked" : "") +
                '><span>White</span></label>' +
                '<label class="desktop-option-pill"><input type="radio" name="color" value="black"' +
                (last.color === "black" ? " checked" : "") +
                "><span>Black</span></label></div>";
            return sec;
        }

        function mouseBlock() {
            const sec = document.createElement("section");
            sec.className = "desktop-new-game-block";
            sec.innerHTML =
                '<h2 class="desktop-form-section-title">Mouse control</h2>' +
                '<div class="desktop-option-group desktop-option-group--equal" role="radiogroup">' +
                '<label class="desktop-option-pill"><input type="radio" name="mouse" value="drag"' +
                (last.mouse !== "double" ? " checked" : "") +
                '><span>Drag</span></label>' +
                '<label class="desktop-option-pill"><input type="radio" name="mouse" value="double"' +
                (last.mouse === "double" ? " checked" : "") +
                "><span>Double-click</span></label></div>";
            return sec;
        }

        row.appendChild(colorBlock());
        row.appendChild(mouseBlock());
        form.appendChild(row);

        const fields = document.createElement("section");
        fields.className = "desktop-new-game-fields";
        fields.innerHTML =
            '<div class="desktop-field"><label class="desktop-form-section-title" for="dlgEngine">Engine</label>' +
            '<select name="engine" id="dlgEngine">' +
            '<option value="brain42"' +
            (last.engine === "brain42" ? " selected" : "") +
            '>Brain 4.2</option>' +
            '<option value="brain41"' +
            (last.engine === "brain41" ? " selected" : "") +
            '>Brain 4.1</option></select></div>' +
            '<div class="desktop-field"><span class="desktop-form-section-title" id="dlgDiffLabel">Difficulty</span>' +
            '<div class="desktop-slider-row" aria-labelledby="dlgDiffLabel">' +
            '<input type="range" name="difficulty" min="1" max="5" value="' +
            (last.difficulty || 3) +
            '" id="dlgDifficulty" class="desktop-slider--gold">' +
            '<output id="dlgDifficultyOut" class="desktop-slider-value">' +
            (last.difficulty || 3) +
            "</output></div></div>" +
            '<div class="desktop-field"><label class="desktop-form-section-title" for="dlgTime">Time per side (minutes)</label>' +
            '<input type="number" name="timeMinutes" id="dlgTime" min="1" max="180" value="' +
            (last.timeMinutes || 90) +
            '"></div></section>';
        form.appendChild(fields);

        const checks = document.createElement("div");
        checks.className = "desktop-form-checks";
        checks.innerHTML =
            '<label class="desktop-check"><input type="checkbox" name="showMoves" value="1"' +
            (last.showAvailableMoves !== false ? " checked" : "") +
            '><span class="desktop-check-box" aria-hidden="true"></span><span>Show available moves</span></label>' +
            '<label class="desktop-check"><input type="checkbox" name="allowUndo" value="1"' +
            (last.allowUndo !== false ? " checked" : "") +
            '><span class="desktop-check-box" aria-hidden="true"></span><span>Allow undo</span></label>';
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
        cancelBtn.textContent = "Cancel";
        const startBtn = document.createElement("button");
        startBtn.type = "button";
        startBtn.className = "desktop-btn desktop-btn-gold";
        startBtn.textContent = "Start";
        actions.appendChild(cancelBtn);
        actions.appendChild(startBtn);
        form.appendChild(actions);

        const diffRange = form.querySelector("#dlgDifficulty");
        const diffOut = form.querySelector("#dlgDifficultyOut");
        if (diffRange && diffOut) {
            diffRange.addEventListener("input", function () {
                diffOut.textContent = diffRange.value;
            });
        }

        function submit() {
            const fd = new FormData(form);
            const payload = {
                color: fd.get("color") || "white",
                engine: fd.get("engine") || "brain42",
                difficulty: parseInt(fd.get("difficulty"), 10) || 3,
                mouse: fd.get("mouse") || "drag",
                showAvailableMoves: fd.get("showMoves") === "1",
                allowUndo: fd.get("allowUndo") === "1",
                timeMinutes: parseInt(fd.get("timeMinutes"), 10) || 90,
            };
            Settings.saveLastOptions(payload);
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
            title: "New game vs AI",
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
