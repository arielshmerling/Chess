/**
 * Desktop brain config HTTP handlers (userData dir; no shared service path hooks).
 */

const fs = require("fs");
const path = require("path");
const catchAsync = require("../utils/catchAsync");
const brainConfigService = require("../modules/game/brainConfigService");
const runtime = require("./runtime");

function safeEngine(raw) {
    return runtime.normalizeEngine(typeof raw === "string" ? raw.trim() : "");
}

function configPath(engine) {
    return path.join(runtime.getBrainConfigDir(), `${engine}.json`);
}

function loadFromUserData(engine) {
    const filePath = configPath(engine);
    if (!fs.existsSync(filePath)) {
        const defaults = brainConfigService.getDefaultConfig(engine);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), "utf8");
        return defaults;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return brainConfigService.sanitizeBrainConfig(engine, JSON.parse(raw));
}

function saveToUserData(engine, rawConfig) {
    const sanitized = brainConfigService.sanitizeBrainConfig(engine, rawConfig);
    fs.mkdirSync(runtime.getBrainConfigDir(), { recursive: true });
    const filePath = configPath(engine);
    fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), "utf8");
    const repoCopy = path.join(__dirname, "..", "config", "brains", `${engine}.json`);
    fs.mkdirSync(path.dirname(repoCopy), { recursive: true });
    fs.copyFileSync(filePath, repoCopy);
    return sanitized;
}

exports.get = catchAsync(async (req, res) => {
    const engine = safeEngine(req.query.engine);
    const config = loadFromUserData(engine);
    res.send({ engine, config });
});

exports.save = catchAsync(async (req, res) => {
    const engine = safeEngine(req.body.engine);
    const config = saveToUserData(engine, req.body.config || {});
    res.send({ status: "OK", engine, config });
});
