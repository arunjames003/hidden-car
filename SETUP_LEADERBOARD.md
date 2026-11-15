# Worldwide leaderboard setup (about 10 minutes, free)

The leaderboard lives in a Google Sheet. A small script (`apps-script/Code.gs`) saves scores into it and sends the top 10 back to the game. You need a Google account. No card, no server.

Until you finish this, the game keeps working with the scores on each player's own device.

## 1. Make the sheet and paste the script
1. Go to https://sheets.new and name the sheet **Hidden Car Scores**.
2. Click **Extensions → Apps Script**.
3. Delete the code in the editor. Open `apps-script/Code.gs` from this folder, copy everything, and paste it in.
4. Click the disk icon (**Save**).

## 2. Publish it as a web app
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. Click **Deploy**. Google asks you to authorize: click **Authorize access**, choose your account, then **Advanced → Go to (project) (unsafe) → Allow**. The "unsafe" warning appears because you wrote the script yourself and Google has not reviewed it.
5. Copy the **Web app URL**. It ends in `/exec`.

## 3. Put the URL in the game
Open `js/config.js` and set:

    leaderboardUrl: "PASTE_THE_WEB_APP_URL_HERE"

Keep the quote marks. Upload `js/config.js` to GitHub (**Add file → Upload files** in the `js` folder).

## 4. Check it
1. Test the script alone: open the Web app URL in your browser with `?top=10` added at the end. You should see `{"ok":true,"top":[]}`.
2. Reload the game (Ctrl+F5). The leaderboard shows **Worldwide** and **This device** tabs, and a line under the name box says names are shown publicly.
3. Play one game. Your row appears in the **Scores** tab of the sheet, and your rank shows on the result screen.

## If you change the script later
Apps Script serves the version you deployed, not the one you saved. After any change use **Deploy → Manage deployments → pencil → Version: New version → Deploy**. The URL stays the same.

## Looking after it
- **Remove a score or a bad name:** delete its row in the **Scores** sheet. The board updates within a minute.
- **Block more words:** edit `BLOCKED_WORDS` in the script, then deploy a new version.
- **Reset the board:** delete all rows under the header row.

## Limits you should know about
- **It is not cheat-proof.** The game runs in the player's browser, so a determined person can send a made-up score. The script rejects impossible scores (above what the player's cleared levels allow, wrong format, scores of 0) and slows down repeated submissions. A believable fake, such as 3300, still gets through. Treat the board as friendly competition, and delete cheaters' rows.
- **Names are public.** Anyone who plays can put any 2-15 character name on the board. The word list catches only obvious cases.
- **First load can be slow.** After a quiet period, Google takes a few seconds to wake the script. The game waits up to 12 seconds, then shows "Worldwide scores aren't available right now". A score that can't be sent is kept on the device and sent on the next visit.
- **Free-tier quotas.** Apps Script limits daily runs and runtime. Normal use by friends is far below them. If the game spreads widely, check the quota page in the Apps Script dashboard.
