/**
 * Progressive PGN library search: page shell paints first, then rows load via API.
 */
(function () {
    "use strict";

    var boot = window.__SEARCH_BOOT__ || {};
    var strings = boot.strings || {};
    var HIDDEN_KEYS = {
        Id: true,
        whiteelo: true,
        blackelo: true,
        eco: true,
        moves: true,
        sourceFile: true,
        gameIndex: true,
    };

    var countEl = document.getElementById("searchResultsCount");
    var statusEl = document.getElementById("searchResultsStatus");
    var tableWrap = document.getElementById("searchResultsTableWrap");
    var headRow = document.getElementById("searchResultsHead");
    var tbody = document.getElementById("searchResultsBody");
    var pagesNav = document.getElementById("searchPagesNav");
    var table = document.getElementById("searchResultsTable");

    var sortState = {
        key: boot.sortKey || null,
        asc: boot.sortOrder !== "desc",
    };
    var columnKeys = [];
    var currentMeta = {
        q: boot.q || "",
        page: boot.page || 1,
        pgnTotal: 0,
        totalPages: 1,
        recordsPerPage: 20,
    };

    function tTemplate(template, params) {
        var out = String(template || "");
        if (!params) {
            return out;
        }
        Object.keys(params).forEach(function (key) {
            out = out.split("{{" + key + "}}").join(String(params[key]));
        });
        return out;
    }

    function gameColLabel(key) {
        var k = String(key || "").trim();
        var map = {
            Date: strings.colDate,
            date: strings.colDate,
            Time: strings.colTime,
            time: strings.colTime,
            White: strings.colWhite,
            white: strings.colWhite,
            Black: strings.colBlack,
            black: strings.colBlack,
            Result: strings.colResult,
            result: strings.colResult,
            Moves: strings.colMoves,
            moves: strings.colMoves,
            Reason: strings.colReason,
            Type: strings.colType,
            Status: strings.colStatus,
            Event: strings.colEvent,
            event: strings.colEvent,
            Site: strings.colSite,
            site: strings.colSite,
            Round: strings.colRound,
            round: strings.colRound,
        };
        return map[k] || k;
    }

    function setStatus(message, isError) {
        if (!statusEl) {
            return;
        }
        statusEl.hidden = !message;
        statusEl.classList.toggle("search-results-status--error", !!isError);
        statusEl.innerHTML = message ? "<p>" + escapeHtml(message) + "</p>" : "";
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function visibleKeysFromRow(row) {
        return Object.keys(row || {}).filter(function (key) {
            return !HIDDEN_KEYS[key];
        });
    }

    function buildHead(keys) {
        if (!headRow) {
            return;
        }
        var html =
            '<th class="sortable-th col-num" data-sort-key="rowIndex" title="' +
            escapeHtml(strings.sortByRowNumber || "") +
            '"><span class="th-label">#</span><span class="sort-icon" aria-hidden="true"></span></th>';
        keys.forEach(function (key) {
            var label = gameColLabel(key);
            var title = tTemplate(strings.sortBy || "", { key: label });
            html +=
                '<th class="sortable-th col-' +
                escapeHtml(String(key).toLowerCase().replace(/\s+/g, "-")) +
                '" data-sort-key="' +
                escapeHtml(key) +
                '" title="' +
                escapeHtml(title) +
                '"><span class="th-label">' +
                escapeHtml(label) +
                '</span><span class="sort-icon" aria-hidden="true"></span></th>';
        });
        headRow.innerHTML = html;
    }

    function buildRow(obj, index, page, recordsPerPage) {
        var rowNum = (page - 1) * recordsPerPage + index + 1;
        var tr = document.createElement("tr");
        tr.setAttribute(
            "data-nav-href",
            "/review?type=pgn&id=" + encodeURIComponent(obj.Id),
        );
        var cells =
            '<td class="row-number sortable-td col-num" data-sort-key="rowIndex" data-sort-value="' +
            rowNum +
            '">' +
            rowNum +
            "</td>";
        columnKeys.forEach(function (key) {
            var raw = obj[key];
            var sortVal =
                key === "date" || key === "Date"
                    ? raw || ""
                    : raw != null
                      ? String(raw)
                      : "";
            cells +=
                '<td class="sortable-td col-' +
                escapeHtml(String(key).toLowerCase().replace(/\s+/g, "-")) +
                '" data-sort-key="' +
                escapeHtml(String(key).trim()) +
                '" data-sort-value="' +
                escapeHtml(sortVal) +
                '">' +
                escapeHtml(raw != null ? raw : "") +
                "</td>";
        });
        tr.innerHTML = cells;
        return tr;
    }

    function yieldToBrowser() {
        return new Promise(function (resolve) {
            window.requestAnimationFrame(function () {
                resolve();
            });
        });
    }

    async function fillBody(rows, page, recordsPerPage) {
        if (!tbody) {
            return;
        }
        tbody.innerHTML = "";
        for (var i = 0; i < rows.length; i++) {
            tbody.appendChild(buildRow(rows[i], i, page, recordsPerPage));
            if (i % 4 === 3) {
                await yieldToBrowser();
            }
        }
    }

    function buildPagination(meta) {
        if (!pagesNav) {
            return;
        }
        var page = meta.page;
        var totalPages = meta.totalPages;
        var q = meta.q || "";
        if (!(meta.pgnTotal > 0)) {
            pagesNav.hidden = true;
            pagesNav.innerHTML = "";
            return;
        }
        var sortParams =
            sortState.key
                ? "&sort=" +
                  encodeURIComponent(sortState.key) +
                  "&order=" +
                  encodeURIComponent(sortState.asc ? "asc" : "desc")
                : "";
        function href(p) {
            return (
                "search?q=" +
                encodeURIComponent(q) +
                "&page=" +
                p +
                sortParams
            );
        }
        var windowSize = 10;
        var startPage = Math.floor((page - 1) / windowSize) * windowSize + 1;
        var endPage = Math.min(startPage + windowSize - 1, totalPages);
        var prev10Page = Math.max(1, startPage - windowSize);
        var next10Page = Math.min(totalPages, startPage + windowSize);
        var smallWindowSize = 5;
        var startPage5 = Math.floor((page - 1) / smallWindowSize) * smallWindowSize + 1;
        var endPage5 = Math.min(startPage5 + smallWindowSize - 1, totalPages);
        var prev5Page = Math.max(1, startPage5 - smallWindowSize);
        var next5Page = Math.min(totalPages, startPage5 + smallWindowSize);
        var html = '<a href="' + href(1) + '">' + escapeHtml(strings.first) + "</a>";
        if (startPage > 1) {
            html +=
                '<a href="' +
                href(prev10Page) +
                '" title="' +
                escapeHtml(strings.previous10Pages) +
                '" class="pageNavIcon pageNavStep10"><img src="/images/prev.png" alt="' +
                escapeHtml(strings.previous) +
                '"></a>';
        }
        if (startPage5 > 1) {
            html +=
                '<a href="' +
                href(prev5Page) +
                '" title="' +
                escapeHtml(strings.previous5Pages) +
                '" class="pageNavIcon pageNavStep5"><img src="/images/prev.png" alt="' +
                escapeHtml(strings.previous) +
                '"></a>';
        }
        var i;
        for (i = startPage5; i <= endPage5; i++) {
            html +=
                '<a class="pageNavItem pageNavWindow5' +
                (i === page ? " selectedPage" : "") +
                '" href="' +
                href(i) +
                '">' +
                i +
                "</a>";
        }
        for (i = startPage; i <= endPage; i++) {
            html +=
                '<a class="pageNavItem pageNavWindow10' +
                (i === page ? " selectedPage" : "") +
                '" href="' +
                href(i) +
                '">' +
                i +
                "</a>";
        }
        if (endPage5 < totalPages) {
            html +=
                '<a href="' +
                href(next5Page) +
                '" title="' +
                escapeHtml(strings.next5Pages) +
                '" class="pageNavIcon pageNavStep5"><img src="/images/next.png" alt="' +
                escapeHtml(strings.next) +
                '"></a>';
        }
        if (endPage < totalPages) {
            html +=
                '<a href="' +
                href(next10Page) +
                '" title="' +
                escapeHtml(strings.next10Pages) +
                '" class="pageNavIcon pageNavStep10"><img src="/images/next.png" alt="' +
                escapeHtml(strings.next) +
                '"></a>';
        }
        html +=
            '<a href="' +
            href(totalPages) +
            '">' +
            escapeHtml(strings.last) +
            "</a>";
        pagesNav.innerHTML = html;
        pagesNav.hidden = false;
    }

    function getSortValue(cell) {
        var key = cell.getAttribute("data-sort-key");
        var raw = cell.getAttribute("data-sort-value");
        if (key === "rowIndex") {
            return Number(raw) || 0;
        }
        if (key === "date" || key === "Date") {
            return raw || "";
        }
        return raw;
    }

    function compare(a, b) {
        var na = typeof a === "number";
        var nb = typeof b === "number";
        if (na && nb) {
            return a - b;
        }
        if (na) {
            return -1;
        }
        if (nb) {
            return 1;
        }
        return String(a).localeCompare(String(b));
    }

    function updateUrlSort() {
        if (!sortState.key) {
            return;
        }
        var params = new URLSearchParams(window.location.search);
        params.set("sort", sortState.key);
        params.set("order", sortState.asc ? "asc" : "desc");
        history.replaceState(null, "", window.location.pathname + "?" + params.toString());
        buildPagination(currentMeta);
    }

    function applySort(key) {
        if (!key || !tbody || !headRow) {
            return;
        }
        var th = headRow.querySelector('th.sortable-th[data-sort-key="' + key + '"]');
        if (!th) {
            return;
        }
        var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
        rows.sort(function (ra, rb) {
            var ca = ra.querySelector('td[data-sort-key="' + key + '"]');
            var cb = rb.querySelector('td[data-sort-key="' + key + '"]');
            if (!ca || !cb) {
                return 0;
            }
            var cmp = compare(getSortValue(ca), getSortValue(cb));
            return sortState.asc ? cmp : -cmp;
        });
        rows.forEach(function (r) {
            tbody.appendChild(r);
        });
        rows.forEach(function (r, i) {
            var numCell = r.querySelector('td[data-sort-key="rowIndex"]');
            if (numCell) {
                numCell.setAttribute("data-sort-value", String(i + 1));
                numCell.textContent = String(i + 1);
            }
        });
        headRow.querySelectorAll(".sort-icon").forEach(function (icon) {
            icon.textContent = "";
            icon.classList.remove("asc", "desc");
        });
        var activeIcon = th.querySelector(".sort-icon");
        if (activeIcon) {
            activeIcon.textContent = sortState.asc ? "\u25B2" : "\u25BC";
            activeIcon.classList.add(sortState.asc ? "asc" : "desc");
        }
        updateUrlSort();
    }

    function bindSort() {
        if (!headRow || headRow._sortBound) {
            return;
        }
        headRow._sortBound = true;
        headRow.addEventListener("click", function (ev) {
            var th = ev.target.closest("th.sortable-th");
            if (!th) {
                return;
            }
            ev.preventDefault();
            var key = th.getAttribute("data-sort-key");
            if (sortState.key === key) {
                sortState.asc = !sortState.asc;
            } else {
                sortState.key = key;
                sortState.asc = true;
            }
            applySort(key);
        });
    }

    async function loadResults() {
        if (countEl) {
            countEl.textContent = strings.loading || "Loading…";
        }
        setStatus(strings.loadingLibrary || "Loading…", false);
        if (tableWrap) {
            tableWrap.hidden = true;
        }
        if (pagesNav) {
            pagesNav.hidden = true;
        }

        var params = new URLSearchParams();
        params.set("q", currentMeta.q || "");
        params.set("page", String(currentMeta.page || 1));
        try {
            var res = await fetch("/api/search/pgn?" + params.toString(), {
                credentials: "same-origin",
                headers: { Accept: "application/json" },
            });
            var body = await res.json().catch(function () {
                return null;
            });
            if (!res.ok || !body || !body.ok) {
                throw new Error((body && body.message) || strings.loadError);
            }
            currentMeta = {
                q: body.q || "",
                page: body.page || 1,
                pgnTotal: body.pgnTotal || 0,
                totalPages: body.totalPages || 1,
                recordsPerPage: body.recordsPerPage || 20,
            };
            if (countEl) {
                countEl.textContent = tTemplate(strings.resultsCount || "{{count}} results", {
                    count: currentMeta.pgnTotal,
                });
            }
            var rows = Array.isArray(body.pgn) ? body.pgn : [];
            if (!rows.length) {
                setStatus(strings.noResults || "No games match your search", false);
                if (tableWrap) {
                    tableWrap.hidden = true;
                }
                buildPagination(currentMeta);
                return;
            }
            columnKeys = visibleKeysFromRow(rows[0]);
            buildHead(columnKeys);
            bindSort();
            setStatus("", false);
            if (tableWrap) {
                tableWrap.hidden = false;
            }
            await fillBody(rows, currentMeta.page, currentMeta.recordsPerPage);
            buildPagination(currentMeta);
            if (sortState.key) {
                applySort(sortState.key);
            }
        } catch (err) {
            console.warn("[search] load failed:", err);
            if (countEl) {
                countEl.textContent = "";
            }
            setStatus(strings.loadError || "Could not load search results.", true);
        }
    }

    if (table) {
        loadResults();
    }
})();
