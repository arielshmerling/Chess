/*global axios*/

(function () {
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
            email.setCustomValidity("Please fill in a valid email");
        }
        reportValidity(email);
    }


    function validatePassword() {
        if (password.value != confirm_password.value) {
            confirm_password.setCustomValidity("Please ensure Password fields are identical.");
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
            username.setCustomValidity("Please choose a username");
        }
        else if (await isUsernameAvailable(username.value)) {
            username.setCustomValidity("");
        } else {
            username.setCustomValidity("This username is not available");
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
            password.setCustomValidity("Password must not contain Whitespaces.");
            return;
        }

        const isContainsUppercase = /^(?=.*[A-Z]).*$/;
        if (!isContainsUppercase.test(value)) {
            password.setCustomValidity("Password must have at least one Uppercase Character.");
            return;
        }

        const isContainsLowercase = /^(?=.*[a-z]).*$/;
        if (!isContainsLowercase.test(value)) {
            password.setCustomValidity("Password must have at least one Lowercase Character.");
            return;
        }

        const isContainsNumber = /^(?=.*[0-9]).*$/;
        if (!isContainsNumber.test(value)) {
            password.setCustomValidity("Password must contain at least one Digit.");
            return;
        }

        const isContainsSymbol =
            /^(?=.*[~`!@#$%^&*()--+={}\\[\]|\\:;"'<>,.?/_₹]).*$/;
        if (!isContainsSymbol.test(value)) {
            password.setCustomValidity("Password must contain at least one Special Symbol.");
            return;
        }

        const isValidLength = /^.{8,30}$/;
        if (!isValidLength.test(value)) {
            password.setCustomValidity("Password must be 8-30 Characters Long.");
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