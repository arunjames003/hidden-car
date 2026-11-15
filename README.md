# Hidden Car – Picture Reveal Game

A car photo is hidden behind a grid of tiles. Open tiles for clues and pick the right car from 4 options. You have 2 lives.

Created by **Arun James**. Feedback or bugs? Use the LinkedIn icon in the page footer.

## Run it
Double-click `index.html`. No install or server needed.

## How to play
- Each game has up to 7 levels. Level 1 is a 2×2 grid, level 2 is 3×3, and so on. Each level shows a different random car.
- One random tile is open at the start. Click tiles to open more.
- Pick the car from 4 options. From level 3, wrong options prefer the same make, so look-alikes appear.
- Keys `1`–`4` pick an answer.

## Scoring
- Correct answer = `100 × level × (tiles still hidden + 1) ÷ total tiles`, counted at the moment you answer.
  - Only the starting tile open = full level value (100 on level 1, 200 on level 2, and so on).
  - Each extra tile you open lowers the points.
- Answering all 7 levels correctly adds a **+500** bonus (maximum score 3,300).

## Lives and 50/50
- **2 lives.** The first wrong answer costs a life and 100 points (the score never goes below 0), then the game moves on. A second wrong answer ends the game.
- **50/50**, once per game: removes two wrong options. That round's points are multiplied by 0.75.

## Badges
Shown on the result screen and on the shared score card (up to 3 on the card).
- **Perfect run**: all levels answered correctly.
- **Sharp eye**: named a car on level 3 or higher with only one tile open.
- **Speed demon**: average of 7 seconds or less per correct answer (at least 3 correct).
- **No lifelines**: never used 50/50 (at least 3 correct).
- **Survivor**: finished all levels after losing a life.

## Sound, vibration and confetti
Sounds are generated in the browser (no audio files). Phones vibrate on a wrong answer. The speaker button at the bottom right mutes sound and vibration, and remembers the choice. Confetti plays on a perfect run.

## Sharing the score
After the game, the player can share a score picture:
- **Phone:** the WhatsApp button opens the share sheet and sends the picture.
- **Computer:** the picture is copied, WhatsApp opens, and the player pastes it with Ctrl+V. "Save picture" downloads it instead.
- "Copy text" copies the message only.

## Leaderboard
- **This device:** the best 10 scores are always saved in the player's browser.
- **Worldwide (optional):** scores go to a Google Sheet through a small script. Setup takes about 10 minutes: see `SETUP_LEADERBOARD.md`. It shows one best score per name, and a score that cannot be sent is kept and retried on the next visit. Until `leaderboardUrl` is set, only the device board is shown.

## Settings (`js/config.js`)
- `shareUrl`: your public link (for example the GitHub Pages address). It is added to the share message and the score picture.
- `linkedinUrl`: your LinkedIn profile address (starting with `https://`). The footer LinkedIn icon opens it. Leave it empty to hide the icon.
- `leaderboardUrl`: the Web app URL of the worldwide leaderboard (starting with `https://`). Leave it empty for device-only scores.

## Add or change cars
1. Save a 4:3 photo (JPG) in `images/cars/` (the bigger copy) and a smaller copy of the same photo, about 720×540 px, with the same file name in `images/cars-low/`. The game loads the small one and falls back to the big one if the small one is missing. The file name should be the car name.
2. Add one entry in `js/cars.js`: `img`, `name`, `make`, a one-line `fact`, and `specs` (`year`, `engine`, `power`, `origin`). The specs strip is shown after each answer.

At least 4 cars are needed. The list has 54 cars now.

## Publish on GitHub Pages
Push this folder to a repository, then Settings → Pages → deploy from the `main` branch, root folder. Then set `shareUrl` in `js/config.js` to the page address.

## Photos
All photos are from Unsplash, so no credit is shown in the game.

## Known limits
- Answers are in the page source, so a determined player can cheat. Fine for a casual game.
- Scores on a device can be edited by anyone using that browser, and are not verified. The worldwide board rejects impossible scores but cannot stop a believable fake one: delete such rows in the sheet.
- Car specs were collected from general sources and may not match the exact version in a photo. Please check them before publishing.
