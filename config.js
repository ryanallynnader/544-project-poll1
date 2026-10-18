// The only file you need to edit. See README.md, step 2.
window.CONFIG = {
  // Web app URL from Google Apps Script (Deploy > New deployment > Web app).
  // Leave empty to run offline: answers stay in the browser and can be
  // downloaded as a CSV from the page.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbybptkpGQln7HXzLfdNzDCTShc16ZEX5y_n2YE1qcLO7QcAaiN8CuDob8mcZHTKkbqYMA/exec",

  // Must match SHARED_TOKEN in apps_script.gs. Keeps random visitors from
  // writing to your sheet. Not real security; keep the repo private.
  SHARED_TOKEN: "change-me-group44",

  STUDY_TITLE: "Reddit comment labeling",
  SCREENS_PER_SESSION: 50,
};
