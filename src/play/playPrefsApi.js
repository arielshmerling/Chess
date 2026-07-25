/**
 * Play launch context and last-game-options for the web Play page.
 */

const catchAsync = require("../utils/catchAsync");
const { User } = require("../modules/user/model");

exports.getLaunchContext = catchAsync(async (req, res) => {
    const user = await User.findById(req.session.user_id)
        .select("username lastGameOptions")
        .lean();
    let lastGameOptions = user && user.lastGameOptions ? { ...user.lastGameOptions } : null;
    if (
        lastGameOptions
        && (lastGameOptions.engine === "brain41" || lastGameOptions.engine === "brain4")
    ) {
        lastGameOptions.engine = "brain43";
    }
    res.json({
        ok: true,
        username: user && user.username ? user.username : req.session.user_name || "Player",
        lastGameOptions,
    });
});

const ALLOWED_ENGINES = ["brain2", "brain3", "brain4", "brain41", "brain42", "brain43"];

function normalizeLastGameOptions(body) {
    const input = body && typeof body === "object" ? body : {};
    const engineRaw = typeof input.engine === "string" ? input.engine.trim() : "";
    const engine = ALLOWED_ENGINES.includes(engineRaw) ? engineRaw : "brain43";
    const difficulty = Number(input.difficulty != null ? input.difficulty : input.thinkingTimeSeconds);
    const timeMinutes = Number(input.timeMinutes);
    return {
        color: input.color === "black" ? "black" : "white",
        engine,
        difficulty:
            Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 6
                ? difficulty
                : 3,
        mouse: input.mouse === "double" ? "double" : "drag",
        showAvailableMoves: input.showAvailableMoves !== false,
        timeMinutes:
            Number.isFinite(timeMinutes) && timeMinutes >= 1 && timeMinutes <= 180
                ? Math.round(timeMinutes)
                : 90,
        isPrivate: input.isPrivate === true,
    };
}

exports.setLastGameOptions = catchAsync(async (req, res) => {
    const lastGameOptions = normalizeLastGameOptions(req.body);
    await User.findByIdAndUpdate(req.session.user_id, { lastGameOptions });
    res.json({
        ok: true,
        lastGameOptions,
    });
});
