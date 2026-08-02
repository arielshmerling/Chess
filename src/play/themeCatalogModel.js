/**
 * Site-wide Play theme catalog (shared across all web users).
 * Singleton Mongo document; optional sync to data/desktop-custom-themes.json for local git.
 */

const mongoose = require("mongoose");

const themeCatalogSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: "site",
        },
        themes: {
            type: mongoose.Schema.Types.Mixed,
            default: [],
        },
        hiddenThemeIds: {
            type: [String],
            default: [],
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
        updatedByUserId: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    { collection: "themeCatalog" },
);

const ThemeCatalog =
    mongoose.models.ThemeCatalog || mongoose.model("ThemeCatalog", themeCatalogSchema);

const SITE_CATALOG_ID = "site";

module.exports = {
    ThemeCatalog,
    SITE_CATALOG_ID,
};
