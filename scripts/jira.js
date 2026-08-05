#!/usr/bin/env node
/**
 * Jira CLI for this repo. Usage:
 *
 *   npm run jira -- whoami
 *   npm run jira -- types
 *   npm run jira -- list                       # open issues in the default project
 *   npm run jira -- list "project = ON AND labels = a11y"
 *   npm run jira -- get ON-12
 *   npm run jira -- create "Summary" "Optional description" --type=Bug --labels=a11y,i18n
 *   npm run jira -- comment ON-12 "Fixed in the games panel context menu."
 *   npm run jira -- transitions ON-12
 *   npm run jira -- move ON-12 "In Progress"
 */
"use strict";

const jira = require("./jira/client");

/**
 * Split argv into positional args and --key=value flags.
 *
 * @param {string[]} argv
 * @returns {{positional: string[], flags: Record<string, string>}}
 */
function parseArgs(argv) {
    const positional = [];
    const flags = {};
    argv.forEach(function (arg) {
        const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
        if (match) {
            flags[match[1]] = match[2] === undefined ? "true" : match[2];
        } else {
            positional.push(arg);
        }
    });
    return { positional: positional, flags: flags };
}

/**
 * Format one issue as a single terminal line.
 *
 * @param {object} issue
 * @returns {string}
 */
function formatIssueLine(issue) {
    const f = issue.fields || {};
    const status = (f.status && f.status.name) || "?";
    const type = (f.issuetype && f.issuetype.name) || "?";
    const assignee = (f.assignee && f.assignee.displayName) || "unassigned";
    const labels = (f.labels || []).length ? " [" + f.labels.join(", ") + "]" : "";
    return [issue.key, "(" + type + "/" + status + ")", f.summary || "", "— " + assignee + labels].join(" ");
}

async function cmdWhoami() {
    const cfg = jira.readConfig();
    const me = await jira.whoAmI();
    console.log("Site:    " + cfg.baseUrl);
    console.log("Project: " + cfg.projectKey);
    console.log("User:    " + me.displayName + " <" + me.emailAddress + ">");
}

async function cmdTypes(positional, flags) {
    const types = await jira.projectIssueTypes(flags.project);
    types.forEach(function (type) {
        console.log("- " + type.name + (type.subtask ? " (subtask)" : ""));
    });
}

async function cmdList(positional) {
    const cfg = jira.readConfig();
    const defaultJql =
        "project = \"" + cfg.projectKey + "\" AND statusCategory != Done ORDER BY updated DESC";
    const jql = positional[0] || defaultJql;
    const issues = await jira.searchIssues(jql);
    if (!issues.length) {
        console.log("No issues matched: " + jql);
        return;
    }
    console.log(issues.length + " issue(s) for: " + jql + "\n");
    issues.forEach(function (issue) {
        console.log(formatIssueLine(issue));
    });
}

async function cmdGet(positional) {
    const key = requireArg(positional[0], "issue key");
    const issue = await jira.getIssue(key);
    const f = issue.fields || {};
    console.log(formatIssueLine(issue));
    console.log("Reporter: " + ((f.reporter && f.reporter.displayName) || "?"));
    console.log("Updated:  " + f.updated);
    console.log("\n" + (jira.fromAdf(f.description).trim() || "(no description)"));
    const comments = (f.comment && f.comment.comments) || [];
    if (comments.length) {
        console.log("\nComments (" + comments.length + "):");
        comments.forEach(function (comment) {
            const who = (comment.author && comment.author.displayName) || "?";
            console.log("\n— " + who + " " + comment.created + "\n" + jira.fromAdf(comment.body).trim());
        });
    }
}

async function cmdCreate(positional, flags) {
    const summary = requireArg(positional[0], "summary");
    const created = await jira.createIssue({
        summary: summary,
        description: positional[1],
        issueType: flags.type,
        labels: flags.labels ? flags.labels.split(",").map(trim).filter(Boolean) : undefined,
        projectKey: flags.project,
    });
    const cfg = jira.readConfig();
    console.log("Created " + created.key + " — " + cfg.baseUrl + "/browse/" + created.key);
}

async function cmdComment(positional) {
    const key = requireArg(positional[0], "issue key");
    const text = requireArg(positional[1], "comment text");
    await jira.addComment(key, text);
    console.log("Commented on " + key);
}

async function cmdTransitions(positional) {
    const key = requireArg(positional[0], "issue key");
    const transitions = await jira.listTransitions(key);
    if (!transitions.length) {
        console.log("No transitions available on " + key);
        return;
    }
    transitions.forEach(function (item) {
        console.log("- " + item.name + " -> " + ((item.to && item.to.name) || "?"));
    });
}

async function cmdMove(positional) {
    const key = requireArg(positional[0], "issue key");
    const target = requireArg(positional[1], "transition name");
    const applied = await jira.transitionIssue(key, target);
    console.log(key + " transitioned via '" + applied + "'");
}

function trim(value) {
    return value.trim();
}

/**
 * @param {string|undefined} value
 * @param {string} label
 * @returns {string}
 */
function requireArg(value, label) {
    if (!value) {
        throw new Error("Missing required argument: " + label);
    }
    return value;
}

const COMMANDS = {
    whoami: cmdWhoami,
    types: cmdTypes,
    list: cmdList,
    get: cmdGet,
    create: cmdCreate,
    comment: cmdComment,
    transitions: cmdTransitions,
    move: cmdMove,
};

async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    const name = parsed.positional.shift();
    const handler = COMMANDS[name];
    if (!handler) {
        console.error("Usage: npm run jira -- <" + Object.keys(COMMANDS).join("|") + "> [args]");
        process.exitCode = 1;
        return;
    }
    await handler(parsed.positional, parsed.flags);
}

main().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
