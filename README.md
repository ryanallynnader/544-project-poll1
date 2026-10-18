# Labeling website

A static page where each group member labels their 200 screens (from
`data/data_human_1`), with answers sent to a Google Sheet you own.
No server, no build step: host it on GitHub Pages.

```
label_site/
  index.html        the page (styles inline)
  app.js            page logic
  config.js         <- the only file you edit (Sheet URL + token)
  apps_script.gs    paste into Google Apps Script (not served by the site)
  data/raters.js    list of rater ids
  data/memberN.js   each rater's 200 screens (no condition labels)
```

**What raters see:** pick their id (or use their personal link) → short
instructions → one screen at a time: the conversation with the FINAL comment
highlighted, four rows of answer buttons, Next. Progress bar, "Session 2 of 4
· 37 / 50", a break screen between sessions, and a thank-you at the end.

**What gets saved, per screen:** `rater, screen_id, session, order, toxicity,
sarcasm, stance, emotion, seconds_on_screen, answered_at` (plus `received_at`
on the sheet).

**Safety nets:**
- Answers are kept in the browser too, so closing the tab or losing wifi loses nothing. Unsent answers retry every 15 s.
- Reopening the link resumes at the first unanswered screen. On a different device, it asks the Sheet what's done.
- "Download my answers (backup)" on every page saves a CSV.
- No back button, on purpose: the design says don't revise earlier screens.

---

## Setup (about 15 minutes)

### 1. Make the Google Sheet + script
1. Create an empty Google Sheet (e.g. "Group 44 labels"), using your USC Google account.
2. **Extensions → Apps Script.** Delete the sample code and paste all of `apps_script.gs`.
3. Change `SHARED_TOKEN` at the top to a made-up phrase (e.g. `group44-k9x2`). Save.
4. **Deploy → New deployment →** gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (needed so the page can send answers without a Google login; the token keeps out random posts)
5. Click Deploy, approve the permissions, and **copy the Web app URL** (ends in `/exec`).

If you edit the script later: **Deploy → Manage deployments → edit → Version: New version.** Otherwise the old code keeps running.

### 2. Point the page at it
Edit `config.js`:
```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXX/exec",
SHARED_TOKEN: "group44-k9x2",   // same phrase as in apps_script.gs
```

### 3. Test locally first
Open `index.html?rater=member1` by double-clicking `index.html` and adding
`?rater=member1` to the address, or just pick member1 from the list. Answer
2–3 screens and check rows appear in the Sheet's `responses` tab. Then
**delete those test rows** and clear the test progress: open the browser
console on the page and run `localStorage.clear()`.

(With `APPS_SCRIPT_URL` empty, the page runs in offline mode: answers stay in
the browser and can be downloaded as CSV.)

### 4. Put it on GitHub Pages
1. Create a **private** repo (e.g. `group44-labeling`) and add the contents of `label_site/` at the top level.
2. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)` → Save.
3. After a minute the site is at `https://<your-username>.github.io/group44-labeling/`.

Pages from a private repo needs GitHub Pro, which is free with the
[GitHub Student Developer Pack](https://education.github.com/pack).
**Note:** on Pro, the *repo* is private but the *Pages site* is publicly
reachable by anyone with the URL (access control needs GitHub Enterprise).
Treat the URL as unlisted: share it only with the group.

### 5. Send each member their link
```
https://<you>.github.io/group44-labeling/?rater=member1
https://<you>.github.io/group44-labeling/?rater=member2
...
```
Plus `PROFILE_FORM.txt` (or a Google Form version), filled out **before** labeling.

---

## Getting the answers back

1. In the Sheet: **File → Download → Comma-separated values (.csv)** (on the `responses` tab).
2. Save it as `data/data_human_1/responses/responses.csv` on the cluster.
3. Join to `data/data_human_1/key.csv` on `screen_id` to get the comment and condition for each answer.

If a screen got submitted twice (e.g. a retry after a dropped connection),
keep the **earliest** `answered_at` per `(rater, screen_id)`.

---

## Never put these in the repo

- `data/data_human_1/key.csv`: it reveals which condition each screen is.
- Profiles / filled-in `PROFILE_FORM.txt` files: race, religion and politics stay private.
- Anything else from `data/` beyond what's in `label_site/data/`.

## Regenerating the data files

After renaming raters or rebuilding the sample:
```bash
cd /project2/xiangren_1987/44/test1
python3 build_human_sample.py --raters <names...>   # only if renaming
python3 build_label_site.py                          # rewrites label_site/data/
```
Delete stale `label_site/data/memberN.js` files if the names changed.
Don't change anything once people have started labeling.
