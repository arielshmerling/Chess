/**
 * Unified modal dialogs for desktop play (confirm, alert, prompt, custom panel).
 */
(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    let lockHandler = null;
    let openCount = 0;

    function setLockHandlers(onLockChange) {
        lockHandler = typeof onLockChange === "function" ? onLockChange : null;
    }

    function setLocked(locked) {
        if (lockHandler) {
            lockHandler(locked);
        }
    }

    function createOverlay(dismissOnBackdrop, onDismiss) {
        const overlay = document.createElement("div");
        overlay.className = "desktop-play-dialog-overlay";
        overlay.setAttribute("role", "presentation");
        if (dismissOnBackdrop) {
            overlay.addEventListener("click", function (ev) {
                if (ev.target === overlay) {
                    onDismiss();
                }
            });
        }
        return overlay;
    }

    function createPanel(title, panelClass) {
        const panel = document.createElement("div");
        panel.className = "desktop-play-dialog" + (panelClass ? " " + panelClass : "");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        if (title) {
            const heading = document.createElement("h3");
            heading.className = "desktop-play-dialog-title";
            heading.textContent = title;
            panel.appendChild(heading);
        }
        return panel;
    }

    function createActions(buttons) {
        const actions = document.createElement("div");
        actions.className = "desktop-play-dialog-actions";
        buttons.forEach(function (btn) {
            const el = document.createElement("button");
            el.type = "button";
            el.className = btn.className || "desktop-btn";
            el.textContent = btn.label;
            el.addEventListener("click", btn.onClick);
            actions.appendChild(el);
        });
        return actions;
    }

    /**
     * @param {object} opts
     * @returns {{ close: function, overlay: HTMLElement, panel: HTMLElement }}
     */
    function openDialog(opts) {
        opts = opts || {};
        const overlay = createOverlay(opts.dismissOnBackdrop !== false, function () {
            handle.close();
            if (opts.onCancel) {
                opts.onCancel();
            }
        });
        const panel = createPanel(opts.title, opts.panelClass);

        if (opts.body != null) {
            if (typeof opts.body === "string") {
                const p = document.createElement("p");
                p.className = "desktop-play-dialog-message";
                p.textContent = opts.body;
                panel.appendChild(p);
            } else if (opts.body instanceof Node) {
                panel.appendChild(opts.body);
            }
        }

        if (opts.footer instanceof Node) {
            panel.appendChild(opts.footer);
        } else if (opts.buttons && opts.buttons.length) {
            panel.appendChild(createActions(opts.buttons));
        }

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        openCount++;
        setLocked(true);

        let focusSession = null;
        let closed = false;

        const handle = {
            overlay: overlay,
            panel: panel,
            close: function closeDialog() {
                if (closed || !overlay.parentNode) {
                    return;
                }
                closed = true;
                if (focusSession && focusSession.release) {
                    focusSession.release();
                    focusSession = null;
                }
                overlay.remove();
                openCount = Math.max(0, openCount - 1);
                if (openCount === 0) {
                    setLocked(false);
                }
                if (opts.onClose) {
                    opts.onClose();
                }
            },
        };

        panel.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        function onKey(e) {
            if (e.key === "Escape" && opts.dismissOnBackdrop !== false) {
                e.preventDefault();
                handle.close();
                if (opts.onCancel) {
                    opts.onCancel();
                }
            }
        }
        document.addEventListener("keydown", onKey);
        const originalClose = handle.close;
        handle.close = function () {
            document.removeEventListener("keydown", onKey);
            originalClose();
        };

        const focusEl = panel.querySelector(
            "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (window.ShmerlingFocusTrap && typeof window.ShmerlingFocusTrap.trapFocus === "function") {
            focusSession = window.ShmerlingFocusTrap.trapFocus(panel, { initialFocus: focusEl });
        } else if (focusEl && focusEl.focus) {
            focusEl.focus();
        }

        return handle;
    }

    function confirm(opts) {
        opts = opts || {};
        let handle;
        handle = openDialog({
            title: opts.title || t("common.confirm"),
            body: opts.message || "",
            panelClass: "desktop-play-dialog--confirm",
            dismissOnBackdrop: opts.dismissOnBackdrop !== false,
            buttons: [
                {
                    label: opts.cancelLabel || t("common.no"),
                    className: "desktop-btn",
                    onClick: function () {
                        handle.close();
                        if (opts.onCancel) {
                            opts.onCancel();
                        }
                    },
                },
                {
                    label: opts.confirmLabel || t("common.yes"),
                    className: "desktop-btn desktop-btn-gold",
                    onClick: function () {
                        handle.close();
                        if (opts.onConfirm) {
                            opts.onConfirm();
                        }
                    },
                },
            ],
            onCancel: opts.onCancel,
        });
        return handle;
    }

    function alert(opts) {
        opts = opts || {};
        let handle;
        handle = openDialog({
            title: opts.title || t("common.notice"),
            body: opts.message || "",
            panelClass: "desktop-play-dialog--alert",
            dismissOnBackdrop: opts.dismissOnBackdrop !== false,
            buttons: [
                {
                    label: opts.okLabel || t("common.ok"),
                    className: "desktop-btn desktop-btn-gold",
                    onClick: function () {
                        handle.close();
                        if (opts.onClose) {
                            opts.onClose();
                        }
                    },
                },
            ],
            onClose: opts.onClose,
        });
        return handle;
    }

    function prompt(opts) {
        opts = opts || {};
        const body = document.createElement("div");
        body.className = "desktop-play-dialog-prompt-body";

        const label = document.createElement("label");
        label.className = "desktop-play-dialog-label";
        label.textContent = opts.label || "";
        label.setAttribute("for", "desktopDialogPromptInput");
        body.appendChild(label);

        const input = document.createElement("input");
        input.type = "text";
        input.id = "desktopDialogPromptInput";
        input.className = "desktop-play-dialog-input";
        input.value = opts.defaultValue != null ? String(opts.defaultValue) : "";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("spellcheck", "false");
        body.appendChild(input);

        const errorEl = document.createElement("p");
        errorEl.className = "desktop-play-dialog-error";
        errorEl.hidden = true;
        body.appendChild(errorEl);

        let handle;
        function submit() {
            const trimmed = input.value.trim();
            if (!trimmed && opts.required !== false) {
                errorEl.textContent = opts.errorMessage || t("common.pleaseEnterValue");
                errorEl.hidden = false;
                input.focus();
                input.select();
                return;
            }
            errorEl.hidden = true;
            handle.close();
            if (opts.onSubmit) {
                opts.onSubmit(trimmed);
            }
        }

        handle = openDialog({
            title: opts.title || t("common.input"),
            body: body,
            panelClass: "desktop-play-dialog--prompt",
            dismissOnBackdrop: opts.dismissOnBackdrop !== false,
            buttons: [
                {
                    label: opts.cancelLabel || t("common.cancel"),
                    className: "desktop-btn",
                    onClick: function () {
                        handle.close();
                        if (opts.onCancel) {
                            opts.onCancel();
                        }
                    },
                },
                {
                    label: opts.confirmLabel || t("common.ok"),
                    className: "desktop-btn desktop-btn-gold",
                    onClick: submit,
                },
            ],
            onCancel: opts.onCancel,
        });

        input.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                submit();
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                handle.close();
                if (opts.onCancel) {
                    opts.onCancel();
                }
            } else if (!errorEl.hidden) {
                errorEl.hidden = true;
            }
        });
        input.focus();
        input.select();
        return handle;
    }

    window.DesktopDialog = {
        setLockHandlers: setLockHandlers,
        open: openDialog,
        confirm: confirm,
        alert: alert,
        prompt: prompt,
    };
})();
