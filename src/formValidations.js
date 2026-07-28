(function () {
    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const confirm_password = document.getElementById("confirmPassword");
    const email = document.getElementById("email");

    username.onblur = validateUsername;
    password.onchange = validatePassword;
    confirm_password.onkeyup = validatePassword;
    password.onkeyup = checkPasswordStrength;
    email.onkeyup = validateEmail;

    function validateEmail() {
        if (email.value.match(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)) {
            email.setCustomValidity("");
        }
        else {
            email.setCustomValidity(t("validation.validEmail"));
        }
        reportValidity(email);
    }


    function validatePassword() {
        if (password.value != confirm_password.value) {
            confirm_password.setCustomValidity(t("validation.passwordsMustMatch"));
        } else {
            confirm_password.setCustomValidity("");
        }
        reportValidity(confirm_password);
    }

    async function isUsernameAvailable(username) {
        if (username.match(/^[0-9a-zA-Z]{1,30}$/)) {
            const path = "/validateUsername?username=" + username;
            //  console.log(path);
            try {
                const response = await axios.get(path);
                return response.data == "NOT FOUND"; // user name is not taken

            } catch (error) {
                console.error(error);
            }
        }
        return false;
    }

    async function validateUsername() {
        if (username == "") {
            username.setCustomValidity(t("validation.chooseUsername"));
        }
        else if (await isUsernameAvailable(username.value)) {
            username.setCustomValidity("");
        } else {
            username.setCustomValidity(t("validation.usernameNotAvailable"));
        }
        reportValidity(username);
    }

    /**
     * @param {string} value: passwordValue
     */
    function checkPasswordStrength() {

        console.log("checking password strength");
        const value = password.value;
        const isNonWhiteSpace = /^\S*$/;
        if (!isNonWhiteSpace.test(value)) {
            password.setCustomValidity(t("validation.passwordNoWhitespace"));
            return;
        }

        const isContainsUppercase = /^(?=.*[A-Z]).*$/;
        if (!isContainsUppercase.test(value)) {
            password.setCustomValidity(t("validation.passwordUppercase"));
            return;
        }

        const isContainsLowercase = /^(?=.*[a-z]).*$/;
        if (!isContainsLowercase.test(value)) {
            password.setCustomValidity(t("validation.passwordLowercase"));
            return;
        }

        const isContainsNumber = /^(?=.*[0-9]).*$/;
        if (!isContainsNumber.test(value)) {
            password.setCustomValidity(t("validation.passwordDigit"));
            return;
        }

        const isContainsSymbol =
            /^(?=.*[~`!@#$%^&*()--+={}\\[\]|\\:;"'<>,.?/_₹]).*$/;
        if (!isContainsSymbol.test(value)) {
            password.setCustomValidity(t("validation.passwordSymbol"));
            return;
        }

        const isValidLength = /^.{8,30}$/;
        if (!isValidLength.test(value)) {
            password.setCustomValidity(t("validation.passwordLength"));
            return;
        }

        password.setCustomValidity("");
        reportValidity(password);
    }

    function reportValidity(element) {
        const form = element.form;
        if (form.classList.contains("validated")) {
            Array.from(form.elements).forEach(el => {
                const msgElement = document.getElementById(el.id + "ValidationMessage");
                if (msgElement) { msgElement.innerText = el.validationMessage; }
            });
        }
    }
})();