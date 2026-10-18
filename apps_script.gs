/**
 * Receives answers from the labeling page and writes them to this Google Sheet.
 * Setup: see label_site/README.md, step 1. Paste this whole file into
 * Extensions > Apps Script of an empty Google Sheet, then deploy as a web app.
 *
 * POST (one answer)   -> appends a row to the "responses" tab
 * GET  ?rater=member3 -> lists that rater's finished screen_ids, so the page
 *                        can resume on another device
 */

// Must match SHARED_TOKEN in config.js.
var SHARED_TOKEN = "change-me-group44";

var COLUMNS = ["received_at", "rater", "screen_id", "session", "order",
               "toxicity", "sarcasm", "stance", "emotion",
               "seconds_on_screen", "answered_at"];

function sheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var tab = book.getSheetByName("responses") || book.insertSheet("responses");
  if (tab.getLastRow() === 0) tab.appendRow(COLUMNS);
  return tab;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.token !== SHARED_TOKEN) return json_({ ok: false, error: "bad token" });
    lock.waitLock(20000);  // several raters can submit at once
    var row = COLUMNS.map(function (c) {
      return c === "received_at" ? new Date().toISOString() : (data[c] == null ? "" : data[c]);
    });
    sheet_().appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.token !== SHARED_TOKEN) return json_({ ok: false, error: "bad token" });
  var values = sheet_().getDataRange().getValues();
  var head = values[0], rater = head.indexOf("rater"), screen = head.indexOf("screen_id");
  var done = {};
  for (var i = 1; i < values.length; i++) {
    if (values[i][rater] === p.rater) done[values[i][screen]] = true;
  }
  return json_({ ok: true, done: Object.keys(done) });
}
