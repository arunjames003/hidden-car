/*
 * Hidden Car – worldwide leaderboard (Google Apps Script, bound to a Google Sheet).
 * Setup steps: see SETUP_LEADERBOARD.md
 *
 * GET  <web app url>?top=10   -> {"ok":true,"top":[{name,score,cleared,total,won}, ...]}
 * POST <web app url>          -> body {"name","score","cleared","total","won"} as text/plain JSON
 *                                answers {"ok":true,"rank":N} or {"ok":false,"error":"..."}
 *
 * Every submitted game is one row in the "Scores" sheet. The board shows each name's best score once.
 * To remove a score, delete its row in the sheet (the board refreshes within a minute).
 */
var SHEET_NAME = "Scores";
var MAX_LEVELS = 7;          // keep in step with MAX_LEVELS in js/game.js
var LEVEL_UNIT = 100;
var WIN_BONUS = 500;
var TOP_N = 10;
var CACHE_SECONDS = 60;      // the top list is cached this long, so busy days don't slow the sheet
var MAX_POSTS_PER_NAME = 10; // per 10 minutes
var MAX_POSTS_ALL = 120;     // per minute, whole game
var BLOCKED_WORDS = ["fuck", "shit", "bitch", "asshole", "cunt", "nazi", "porn"];   // add more if needed

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["Time", "Name", "Score", "Cleared", "Total", "Won"]);
    sh.setFrozenRows(1);
    sh.getRange("B:B").setNumberFormat("@");     // names are stored as plain text, never as formulas
  }
  return sh;
}

/** Best row per name (case-insensitive), sorted by score. */
function best_() {
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, 6).getValues();
  var byName = {};
  rows.forEach(function (r) {
    var name = String(r[1]).trim(), score = Number(r[2]);
    if (!name || !isFinite(score)) return;
    var key = name.toLowerCase(), cur = byName[key];
    if (!cur || score > cur.score) {
      byName[key] = { name: name, score: score, cleared: Number(r[3]), total: Number(r[4]), won: r[5] === true || r[5] === "TRUE" };
    }
  });
  return Object.keys(byName).map(function (k) { return byName[k]; })
    .sort(function (a, b) { return b.score - a.score; });
}

function doGet(e) {
  var n = Math.min(Math.max(parseInt(e && e.parameter && e.parameter.top, 10) || TOP_N, 1), 50);
  var cache = CacheService.getScriptCache(), hit = cache.get("top" + n);
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  var out = JSON.stringify({ ok: true, top: best_().slice(0, n) });
  cache.put("top" + n, out, CACHE_SECONDS);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function cleanName_(raw) {
  var s = String(raw == null ? "" : raw)
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ").trim()
    .replace(/^[=+\-@]+/, "")
    .slice(0, 15).trim();
  return s;
}

/** Returns an error code or "" when the submission looks like a real game. */
function check_(d, name) {
  if (name.length < 2) return "name";
  var flat = name.toLowerCase().replace(/[^a-z]/g, "");
  for (var i = 0; i < BLOCKED_WORDS.length; i++) if (flat.indexOf(BLOCKED_WORDS[i]) !== -1) return "name";
  var ints = ["score", "cleared", "total"];
  for (var j = 0; j < ints.length; j++) if (typeof d[ints[j]] !== "number" || d[ints[j]] % 1 !== 0 || d[ints[j]] < 0) return "data";
  if (d.total < 1 || d.total > MAX_LEVELS || d.cleared > d.total) return "data";
  var won = d.won === true;
  if (won && d.cleared !== d.total) return "data";
  var max = won ? WIN_BONUS : 0;                      // best case: the hardest levels answered with one tile open
  for (var k = 0; k < d.cleared; k++) max += LEVEL_UNIT * (d.total - k);
  if (d.score > max) return "data";
  if (d.score === 0) return "data";
  return "";
}

function throttled_(name) {
  var cache = CacheService.getScriptCache();
  var kn = "n:" + name.toLowerCase(), ka = "all";
  var cn = Number(cache.get(kn) || 0), ca = Number(cache.get(ka) || 0);
  if (cn >= MAX_POSTS_PER_NAME || ca >= MAX_POSTS_ALL) return true;
  cache.put(kn, String(cn + 1), 600);
  cache.put(ka, String(ca + 1), 60);
  return false;
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "data" }); }
  if (!d || typeof d !== "object") return json_({ ok: false, error: "data" });
  var name = cleanName_(d.name), bad = check_(d, name);
  if (bad) return json_({ ok: false, error: bad });
  if (throttled_(name)) return json_({ ok: false, error: "busy" });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    sh.appendRow([new Date(), name, d.score, d.cleared, d.total, d.won === true]);
    CacheService.getScriptCache().removeAll(["top10", "top5", "top50"]);
    var list = best_(), rank = 1;
    for (var i = 0; i < list.length; i++) if (list[i].score > d.score) rank++;
    return json_({ ok: true, rank: rank });
  } finally {
    lock.releaseLock();
  }
}
