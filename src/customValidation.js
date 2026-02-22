/* eslint-disable-next-line no-unused-vars */
function overrideFormValidity() {
    const forms = document.querySelectorAll(".validated-form");
    Array.from(forms)
        .forEach(function (form) {
            form.addEventListener("submit", function (event) {

                if (!form.checkValidity()) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                form.classList.add("validated");

                Array.from(form.elements).forEach(el => {
                    const msgElement = document.getElementById(el.id + "ValidationMessage");
                    if (msgElement) {
                        msgElement.innerText = el.validationMessage;
                    }
                });

            }, false);
        });
};