/**
 * Minimal Jira Cloud REST (API v3) client for developer tooling.
 *
 * Credentials come from the environment only:
 *   JIRA_BASE_URL     e.g. https://shmerlingchessclub.atlassian.net
 *   JIRA_EMAIL        Atlassian account email
 *   JIRA_API_TOKEN    API token from id.atlassian.com
 *   JIRA_PROJECT_KEY  default project for created issues (e.g. ON)
 */
"use strict";

require("dotenv").config();

const DEFAULT_BASE_URL = "https://shmerlingchessclub.atlassian.net";
const DEFAULT_PROJECT_KEY = "ON";

/**
 * Read and validate Jira configuration from the environment.
 *
 * @returns {{baseUrl: string, email: string, token: string, projectKey: string}}
 * @throws {Error} When credentials are missing or the base URL is unsafe.
 */
function readConfig() {
    const baseUrl = String(process.env.JIRA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const email = String(process.env.JIRA_EMAIL || "").trim();
    const token = String(process.env.JIRA_API_TOKEN || "").trim();
    const projectKey = String(process.env.JIRA_PROJECT_KEY || DEFAULT_PROJECT_KEY).trim();

    if (!email || !token) {
        throw new Error("Missing JIRA_EMAIL or JIRA_API_TOKEN. Add them to .env (see scripts/jira/README.md).");
    }

    // Only ever send the token to an Atlassian Cloud host over TLS.
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:") {
        throw new Error("JIRA_BASE_URL must use https.");
    }
    if (parsed.hostname !== "atlassian.net" && !parsed.hostname.endsWith(".atlassian.net")) {
        throw new Error("JIRA_BASE_URL must be an *.atlassian.net Cloud site.");
    }

    return { baseUrl: parsed.origin, email, token, projectKey };
}

/**
 * Perform an authenticated Jira REST request.
 *
 * @param {string} method HTTP method.
 * @param {string} apiPath Path beginning with /rest/api/3/.
 * @param {object} [body] JSON request body.
 * @param {object} [config] Result of readConfig(); read fresh when omitted.
 * @returns {Promise<object|null>} Parsed JSON body, or null for 204 responses.
 */
async function request(method, apiPath, body, config) {
    const cfg = config || readConfig();
    const auth = Buffer.from(cfg.email + ":" + cfg.token).toString("base64");
    const response = await fetch(cfg.baseUrl + apiPath, {
        method: method,
        headers: {
            Authorization: "Basic " + auth,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
        // Surface the API message but never the request headers.
        throw new Error("Jira " + method + " " + apiPath + " failed: " + response.status + " " + summarizeError(text));
    }
    if (!text) {
        return null;
    }
    return JSON.parse(text);
}

/**
 * Extract a readable message from a Jira error payload.
 *
 * @param {string} text Raw response body.
 * @returns {string}
 */
function summarizeError(text) {
    try {
        const parsed = JSON.parse(text);
        const messages = []
            .concat(parsed.errorMessages || [])
            .concat(Object.values(parsed.errors || {}));
        return messages.length ? messages.join("; ") : text.slice(0, 300);
    } catch {
        return text.slice(0, 300);
    }
}

/**
 * Convert plain text into an Atlassian Document Format document.
 * Blank lines separate paragraphs; single newlines become hard breaks.
 *
 * @param {string} text
 * @returns {object} ADF document node.
 */
function toAdf(text) {
    const paragraphs = String(text || "")
        .split(/\n{2,}/)
        .map(function (block) {
            return block.trim();
        })
        .filter(Boolean);

    return {
        type: "doc",
        version: 1,
        content: (paragraphs.length ? paragraphs : [""]).map(function (block) {
            const content = [];
            block.split("\n").forEach(function (line, index) {
                if (index > 0) {
                    content.push({ type: "hardBreak" });
                }
                if (line) {
                    content.push({ type: "text", text: line });
                }
            });
            return { type: "paragraph", content: content };
        }),
    };
}

/**
 * Flatten an ADF document back to plain text for terminal output.
 *
 * @param {object} node ADF node.
 * @returns {string}
 */
function fromAdf(node) {
    if (!node || typeof node !== "object") {
        return "";
    }
    if (node.type === "text") {
        return node.text || "";
    }
    if (node.type === "hardBreak") {
        return "\n";
    }
    const children = (node.content || []).map(fromAdf).join("");
    return node.type === "paragraph" ? children + "\n" : children;
}

/**
 * Run a JQL search.
 *
 * @param {string} jql
 * @param {object} [options]
 * @param {number} [options.maxResults=50]
 * @param {string[]} [options.fields]
 * @returns {Promise<Array<object>>} Issues.
 */
async function searchIssues(jql, options) {
    const opts = options || {};
    const payload = {
        jql: jql,
        maxResults: opts.maxResults || 50,
        fields: opts.fields || ["summary", "status", "issuetype", "priority", "labels", "assignee", "updated"],
    };
    const data = await request("POST", "/rest/api/3/search/jql", payload);
    return (data && data.issues) || [];
}

/**
 * Fetch a single issue with its description and comments.
 *
 * @param {string} key Issue key, e.g. ON-12.
 * @returns {Promise<object>}
 */
function getIssue(key) {
    const fields = "summary,status,issuetype,priority,labels,assignee,reporter,created,updated,description,comment";
    return request("GET", "/rest/api/3/issue/" + encodeURIComponent(key) + "?fields=" + fields);
}

/**
 * Create an issue.
 *
 * @param {object} spec
 * @param {string} spec.summary
 * @param {string} [spec.description]
 * @param {string} [spec.issueType="Task"]
 * @param {string[]} [spec.labels]
 * @param {string} [spec.projectKey] Defaults to JIRA_PROJECT_KEY.
 * @returns {Promise<object>} Created issue stub with key.
 */
function createIssue(spec) {
    const cfg = readConfig();
    const fields = {
        project: { key: spec.projectKey || cfg.projectKey },
        summary: spec.summary,
        issuetype: { name: spec.issueType || "Task" },
    };
    if (spec.description) {
        fields.description = toAdf(spec.description);
    }
    if (spec.labels && spec.labels.length) {
        fields.labels = spec.labels;
    }
    return request("POST", "/rest/api/3/issue", { fields: fields }, cfg);
}

/**
 * Add a comment to an issue.
 *
 * @param {string} key
 * @param {string} text
 * @returns {Promise<object>}
 */
function addComment(key, text) {
    return request("POST", "/rest/api/3/issue/" + encodeURIComponent(key) + "/comment", { body: toAdf(text) });
}

/**
 * List the transitions currently available on an issue.
 *
 * @param {string} key
 * @returns {Promise<Array<object>>}
 */
async function listTransitions(key) {
    const data = await request("GET", "/rest/api/3/issue/" + encodeURIComponent(key) + "/transitions");
    return (data && data.transitions) || [];
}

/**
 * Move an issue through a named transition.
 *
 * @param {string} key
 * @param {string} nameOrId Transition name (case-insensitive) or id.
 * @returns {Promise<string>} The transition name that was applied.
 */
async function transitionIssue(key, nameOrId) {
    const transitions = await listTransitions(key);
    const wanted = String(nameOrId).toLowerCase();
    const match = transitions.find(function (item) {
        return item.id === nameOrId || String(item.name).toLowerCase() === wanted;
    });
    if (!match) {
        const available = transitions
            .map(function (item) {
                return item.name;
            })
            .join(", ");
        throw new Error("No transition '" + nameOrId + "' on " + key + ". Available: " + (available || "none"));
    }
    await request("POST", "/rest/api/3/issue/" + encodeURIComponent(key) + "/transitions", {
        transition: { id: match.id },
    });
    return match.name;
}

/**
 * Verify credentials and return the authenticated account.
 *
 * @returns {Promise<object>}
 */
function whoAmI() {
    return request("GET", "/rest/api/3/myself");
}

/**
 * List the issue types configured for a project.
 *
 * @param {string} [projectKey]
 * @returns {Promise<Array<object>>}
 */
async function projectIssueTypes(projectKey) {
    const cfg = readConfig();
    const key = projectKey || cfg.projectKey;
    const data = await request("GET", "/rest/api/3/project/" + encodeURIComponent(key), undefined, cfg);
    return (data && data.issueTypes) || [];
}

module.exports = {
    readConfig,
    request,
    toAdf,
    fromAdf,
    searchIssues,
    getIssue,
    createIssue,
    addComment,
    listTransitions,
    transitionIssue,
    whoAmI,
    projectIssueTypes,
};
