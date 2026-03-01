function populatePaletteSelctor() {
    const paletteSelctor = document.getElementById("paletteSelctor");
    if (paletteSelctor) {
        paletteSelctor.innerHTML = "";

        const palletes = [
            { id: "blue", theme: themes.blueTheme },
            { id: "dark", theme: themes.pinkTheme },
        ];

        for (const config of palletes) {
            const palette = addPalette(config);
            paletteSelctor.appendChild(palette);
        }

    }
}

function addPalette(paletteConfig) {
    const colorPalette = document.createElement("div");
    colorPalette.id = paletteConfig.id;
    colorPalette.onclick = () => setDefaultTheme(paletteConfig.theme);
    colorPalette.classList.add("colorPalette");

    colorPalette.appendChild(createColorSquare(paletteConfig.theme, "darker"));
    colorPalette.appendChild(createColorSquare(paletteConfig.theme, "dark"));
    colorPalette.appendChild(createColorSquare(paletteConfig.theme, "semiDark"));
    colorPalette.appendChild(createColorSquare(paletteConfig.theme, "semiLight"));
    colorPalette.appendChild(createColorSquare(paletteConfig.theme, "light"));

    return colorPalette;
}

function createColorSquare(theme, color) {
    const colorSquare = document.createElement("div");
    colorSquare.classList.add("colorSquare");
    colorSquare.style.backgroundColor = theme["--" + color];
    return colorSquare;
}


function setDefaultTheme(theme) {
    var r = document.querySelector(":root");
    Object.entries(theme).forEach(([key, value]) => {
        r.style.setProperty(key, value);
    });
}


const themes = {
    blueTheme: {
        "--panel-background": "#4e829f",
        "--textbox-background": "#98c1d9",
        "--textbox-forecolor": "#2c4668",
        "--textbox-highlight": "#e5e5e5", /*not set */
        "--textbox-disabled": "#838383",/*not set */

        "--button-background": "#233245",
        "--button-forecolor": "#a7a7a7",
        "--button-highlight": "#e5e5e5", /*not set */
        "--button-disabled": "#3b6e8b",
        "--button-disabled-text": "#a1a1a1",

        "--selection-selected": "#6ba2c3",
        "--selection-highlight": "#3d5a80",
        "--selection-border": "rgb(4, 211, 4)",


        "--darkSquare": "#98c1d9",
        "--lightSquare": "#e0fbfc",
        "--optionSquare": "rgb(92, 171, 125)",
        "--frame": "#293241",
        "--body-background": "#3d5a80",

        "--moves-panel-bg": "#354c69",
        "--moves-cell-bg": "#4e829f",
        "--moves-cell-text": "rgb(233, 231, 231)",
        "--moves-cell-highlight-bg": "rgb(152, 193, 217)",
        "--moves-cell-highlight-text": "rgb(233, 231, 231)",
        "--moves-cell-selected-bg": "rgb(92, 171, 125)",
        "--moves-header-text": "#999999",

        "--table-header-bg": "rgb(49, 75, 106)",
        "--table-header-text": "rgb(167 ,179, 196)",
        "--table-row-bg": "rgb(193, 219, 255)",
        "--table-row-text": "rgb(44 ,70 ,104)",
        "--table-link-text": "rgb(44 ,70 ,104)",
        "--table-link-hover": "rgb(255,255,255)",
        "--turnClock": "invert(1)",

        "--darker": "#293241",
        "--dark": "#3d5a80",
        "--semiDark": "#668ea5",
        "--semiLight": "#98c1d9",
        "--light": "#e0fbfc",
        "--lighter": "#ffffff",
        "--hero-bg-start": "rgba(41, 50, 65, 0.95)",
        "--hero-bg-mid": "rgba(61, 90, 128, 0.95)",
        "--hero-bg-end": "rgba(41, 50, 65, 0.95)",
        "--hero-border": "rgba(152, 193, 217, 0.3)",
        "--hero-pattern": "rgba(152, 193, 217, 0.03)",
        "--hero-overlay": "rgba(152, 193, 217, 0.15)",
        "--hero-greeting": "#6595b4",
    },

    darkTheme: {
        "--panel-background": "#2D3134",
        "--textbox-background": "#4C4C4C",
        "--textbox-forecolor": "#A5A5A5",
        "--textbox-highlight": "#e5e5e5",
        "--textbox-disabled": "#838383",

        "--button-background": "#4C4C4C",
        "--button-forecolor": "#A5A5A5",
        "--button-highlight": "#e5e5e5",
        "--button-disabled": "#2d3134",
        "--button-disabled-text": "#626568",


        "--selection-selected": "#373737",
        "--selection-highlight": "#838383",
        "--selection-border": "rgb(0, 91, 255)",

        "--darkSquare": "#bbbbbb",
        "--lightSquare": "#d9d9d9",
        "--optionSquare": "rgb(92, 171, 125)",
        "--frame": "#545454",
        "--body-background": "#242424",
        "--moves-panel-bg": "#2D3134",
        "--moves-cell-bg": "#4C4C4C",
        "--moves-cell-text": "rgb(233, 231, 231);",
        "--moves-cell-highlight-bg": "#838383",
        "--moves-cell-highlight-text": "rgb(233, 231, 231);",
        "--moves-cell-selected-bg": "rgb(92, 171, 125)",
        "--moves-header-text": "white",

        "--table-header-bg": "rgb(88, 88, 88)",
        "--table-header-text": "rgb(175 ,175 ,175)",
        "--table-row-bg": "rgb(53, 53, 53)",
        "--table-row-text": "rgb(115, 115, 115)",
        "--table-link-text": "rgb(44 ,70 ,104)",
        "--table-link-hover": "rgb(255,255,255)",

        "--turnClock": "invert(0.5)",

        "--darker": "#1a1a1a",
        "--dark": "#2d2d2d",
        "--semiDark": "#555555",
        "--semiLight": "#888888",
        "--light": "#bbbbbb",
        "--lighter": "#eeeeee",
        "--hero-bg-start": "rgba(28, 28, 28, 0.98)",
        "--hero-bg-mid": "rgba(45, 45, 45, 0.98)",
        "--hero-bg-end": "rgba(28, 28, 28, 0.98)",
        "--hero-border": "rgba(136, 136, 136, 0.25)",
        "--hero-pattern": "rgba(136, 136, 136, 0.04)",
        "--hero-overlay": "rgba(136, 136, 136, 0.08)",
        "--hero-greeting": "#888888",
    },
};


(function () {
    populatePaletteSelctor();
    window.addEventListener("load", () => {
        const themeSwitch = document.getElementById("themeSwitch");

        const theme = localStorage.getItem("theme");
        if (theme == "blue") {
            setDefaultTheme(themes.blueTheme);
            if (themeSwitch) {
                themeSwitch.checked = true;
            };
        }

        else if (theme == "dark") {

            setDefaultTheme(themes.darkTheme);
        }
        else {
            setDefaultTheme(themes.darkTheme);
        }

        if (themeSwitch) {
            themeSwitch.onchange = () => {
                if (themeSwitch.checked) {
                    setDefaultTheme(themes.blueTheme);
                    localStorage.setItem("theme", "blue");
                }
                else {
                    setDefaultTheme(themes.darkTheme);
                    localStorage.setItem("theme", "dark");
                }
            };
        }
    });

}
)();