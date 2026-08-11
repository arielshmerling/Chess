/**
 * Two-step login screen: "Who are you?" → password → authenticate.
 * Without JavaScript the form posts to /login with both fields as before.
 * After three failed password attempts, show a Forgot password link.
 */
(function () {
    "use strict";

    var SORRY_MS = 3000;
    var PROMPT_SWAP_MS = 220;
    var FAILED_ATTEMPTS_BEFORE_FORGOT = 3;

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    var screen = document.getElementById("loginScreen");
    var form = document.getElementById("loginForm");
    var prompt = document.getElementById("loginPrompt");
    var usernameInput = document.getElementById("username");
    var passwordInput = document.getElementById("password");
    var nextButton = document.getElementById("loginNext");
    var errorText = document.getElementById("loginError");
    var row = document.getElementById("loginRow");
    var forgotEl = document.getElementById("loginForgot");

    if (!screen || !form || !prompt || !usernameInput || !passwordInput || !nextButton || !row) {
        return;
    }

    screen.classList.add("login-screen--js");

    var step = "username";
    var pending = false;
    var sorryTimer = null;
    var promptTimer = null;
    var failedPasswordAttempts = 0;

    function revealForgotPassword() {
        if (forgotEl) {
            forgotEl.hidden = false;
        }
    }

    function setPrompt(text) {
        if (promptTimer) {
            clearTimeout(promptTimer);
        }
        prompt.classList.add("is-swapping");
        promptTimer = setTimeout(function () {
            promptTimer = null;
            prompt.textContent = text;
            prompt.classList.remove("is-swapping");
        }, PROMPT_SWAP_MS);
    }

    function setActiveInput(active) {
        [usernameInput, passwordInput].forEach(function (input) {
            var isActive = input === active;
            input.tabIndex = isActive ? 0 : -1;
            if (isActive) {
                input.removeAttribute("aria-hidden");
            } else {
                input.setAttribute("aria-hidden", "true");
            }
        });
        if (active) {
            setTimeout(function () {
                active.focus();
            }, PROMPT_SWAP_MS);
        }
    }

    function clearError() {
        if (errorText) {
            errorText.textContent = "";
        }
    }

    function goToUsername() {
        step = "username";
        screen.setAttribute("data-step", "username");
        usernameInput.value = "";
        passwordInput.value = "";
        nextButton.disabled = false;
        setPrompt(t("auth.whoAreYou"));
        setActiveInput(usernameInput);
    }

    function goToPassword() {
        step = "password";
        screen.setAttribute("data-step", "password");
        passwordInput.value = "";
        setPrompt(t("auth.enterPassword"));
        setActiveInput(passwordInput);
    }

    function showSorry() {
        step = "sorry";
        screen.setAttribute("data-step", "sorry");
        passwordInput.value = "";
        nextButton.disabled = true;
        setPrompt(t("auth.sorry"));
        if (sorryTimer) {
            clearTimeout(sorryTimer);
        }
        sorryTimer = setTimeout(function () {
            sorryTimer = null;
            goToUsername();
        }, SORRY_MS);
    }

    function rejectEmpty() {
        row.classList.remove("is-invalid");
        /* Restart the animation on repeated empty submits. */
        void row.offsetWidth;
        row.classList.add("is-invalid");
        setTimeout(function () {
            row.classList.remove("is-invalid");
        }, 400);
    }

    /** Only same-origin paths may come back from the server response. */
    function safeRedirect(url) {
        if (typeof url !== "string" || url.charAt(0) !== "/") {
            return "/Home";
        }
        if (url.charAt(1) === "/" || url.charAt(1) === "\\") {
            return "/Home";
        }
        return url;
    }

    function authenticate() {
        if (pending) {
            return;
        }
        pending = true;
        nextButton.disabled = true;

        fetch("/api/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                username: usernameInput.value.trim(),
                password: passwordInput.value,
            }),
        })
            .then(function (res) {
                return res.ok ? res.json() : null;
            })
            .then(function (data) {
                if (data && data.ok) {
                    failedPasswordAttempts = 0;
                    window.location.assign(safeRedirect(data.redirectUrl));
                    return;
                }
                pending = false;
                failedPasswordAttempts += 1;
                if (failedPasswordAttempts >= FAILED_ATTEMPTS_BEFORE_FORGOT) {
                    revealForgotPassword();
                }
                showSorry();
            })
            .catch(function () {
                pending = false;
                failedPasswordAttempts += 1;
                if (failedPasswordAttempts >= FAILED_ATTEMPTS_BEFORE_FORGOT) {
                    revealForgotPassword();
                }
                showSorry();
            });
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearError();

        if (step === "sorry" || pending) {
            return;
        }
        if (step === "username") {
            if (!usernameInput.value.trim()) {
                rejectEmpty();
                return;
            }
            goToPassword();
            return;
        }
        if (!passwordInput.value) {
            rejectEmpty();
            return;
        }
        authenticate();
    });

    setActiveInput(usernameInput);
    usernameInput.focus();
})();
