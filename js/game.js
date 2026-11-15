/*
 * Hidden Car – Picture Reveal Game
 * Plain JavaScript, no build step. Works by double-clicking index.html
 * and on GitHub Pages.
 */
(function () {
  "use strict";

  // ---------- settings ----------
  var MAX_LEVELS = 7;        // 2x2 up to 8x8 (limited by how many cars are in cars.js)
  var LEVEL_UNIT = 100;      // level value = 100 x level number
  var WIN_BONUS = 500;       // bonus for clearing every level
  var STORE_KEY = "hiddenCar.leaderboard.v1";
  var NAME_KEY = "hiddenCar.lastName";
  var SOUND_KEY = "hiddenCar.sound";
  var PHOTO_DIR = "images/cars-low/";   // small photos (720 px) used in the game; images/cars/ keeps the bigger ones
  var LIVES = 2;             // wrong answers allowed before the game ends = LIVES - 1
  var WRONG_PENALTY = 100;   // points lost on the first wrong answer (score never goes below 0)
  var FIFTY_KEEP = 0.75;     // using 50/50 keeps 75% of that round's points (-25%)
  var SPEED_LIMIT = 7000;    // "Speed demon": average ms per correct answer

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Points for a correct answer: level value x share of the picture still hidden. */
  function calcPoints(level, totalTiles, revealedTiles) {
    var r = Math.min(Math.max(revealedTiles, 1), totalTiles);
    return Math.round(LEVEL_UNIT * level * (totalTiles - r + 1) / totalTiles);
  }

  function pop(el) {
    el.classList.remove("pop");
    void el.offsetWidth; // restart animation
    el.classList.add("pop");
  }

  // ---------- sound, vibration, confetti ----------
  var fx = (function () {
    var ctx = null, on = true;
    try { on = localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { /* ignore */ }

    function ac() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) { try { ctx = new C(); } catch (e) { ctx = null; } }
      }
      if (ctx && ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, start, dur, type, vol) {
      if (!on) return;
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function buzz(pattern) {
      if (on && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
    }
    return {
      isOn: function () { return on; },
      toggle: function () {
        on = !on;
        try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch (e) { /* ignore */ }
        return on;
      },
      tile: function () { tone(520, 0, 0.06, "triangle", 0.08); },
      correct: function () { tone(660, 0, 0.12, "sine"); tone(880, 0.1, 0.2, "sine"); },
      wrong: function () { tone(200, 0, 0.28, "sawtooth", 0.1); tone(150, 0.12, 0.3, "sawtooth", 0.1); buzz([120, 60, 120]); },
      over: function () { tone(220, 0, 0.25, "sawtooth", 0.1); tone(165, 0.2, 0.25, "sawtooth", 0.1); tone(110, 0.4, 0.5, "sawtooth", 0.12); buzz([200, 80, 200, 80, 300]); },
      lifeline: function () { tone(440, 0, 0.1, "square", 0.07); tone(660, 0.09, 0.14, "square", 0.07); },
      win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.3, "triangle", 0.14); }); tone(1047, 0.5, 0.6, "sine", 0.12); }
    };
  })();

  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = $("confetti"), x = cv.getContext("2d");
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    cv.classList.add("on");
    var colors = ["#ff5a36", "#ffb02e", "#2ecc71", "#4da3ff", "#f2f5ff", "#c77dff"], parts = [], i;
    for (i = 0; i < 160; i++) {
      parts.push({
        x: cv.width * (0.2 + Math.random() * 0.6), y: -20 - Math.random() * cv.height * 0.3,
        vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 4,
        w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
        c: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      x.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(function (q) {
        q.x += q.vx; q.y += q.vy; q.vy += 0.06; q.rot += q.vr;
        x.save(); x.translate(q.x, q.y); x.rotate(q.rot);
        x.fillStyle = q.c; x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        x.restore();
      });
      if (now - start < 3800) window.requestAnimationFrame(frame);
      else { x.clearRect(0, 0, cv.width, cv.height); cv.classList.remove("on"); }
    }
    window.requestAnimationFrame(frame);
  }

  // ---------- local storage (this device) ----------
  function loadLocalBoard() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }

  function saveLocalBoard(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  function loadName() {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; }
  }

  function saveName(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* ignore */ }
  }

  /** Adds an entry to this device's list, keeps the best 10, returns its 1-based rank (0 if not in the top 10). */
  function addLocalScore(entry) {
    var list = loadLocalBoard();
    list.push(entry);
    list.sort(function (a, b) { return b.score - a.score || a.ts - b.ts; });
    list = list.slice(0, 10);
    saveLocalBoard(list);
    for (var i = 0; i < list.length; i++) if (list[i].id === entry.id) return i + 1;
    return 0;
  }

  function renderList(listEl, list, isMine) {
    listEl.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No scores yet. Be the first!";
      listEl.appendChild(empty);
      return;
    }
    var marked = false;
    list.forEach(function (e) {
      var li = document.createElement("li");
      if (isMine && !marked && isMine(e)) { li.className = "me"; marked = true; }
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = e.name;
      var lv = document.createElement("span");
      lv.className = "lv";
      lv.textContent = e.cleared + "/" + e.total + (e.won ? " ★" : "");
      var sc = document.createElement("span");
      sc.className = "sc";
      sc.textContent = e.score;
      li.appendChild(nm); li.appendChild(lv); li.appendChild(sc);
      listEl.appendChild(li);
    });
  }

  /** Shows this device's best scores. entry: the score just played (highlighted), or null. */
  function showBoard(listEl, limit, entry) {
    renderList(listEl, loadLocalBoard().slice(0, limit),
      entry ? function (e) { return e.id === entry.id; } : null);
  }

  // ---------- state ----------
  var state = {
    name: "", deck: [], total: 0, index: 0,
    score: 0, cleared: 0, won: false, cardBlob: null,
    car: null, level: 1, grid: 2, tileCount: 4,
    revealed: [], revealedCount: 0, locked: false,
    lives: LIVES, missed: 0, fiftyUsed: false, fiftyRound: false,
    roundStart: 0, times: [], sharp: false, badges: [], cardUrl: ""
  };

  // ---------- screens ----------
  function showScreen(id) {
    ["screen-welcome", "screen-game", "screen-result"].forEach(function (s) {
      $(s).classList.toggle("active", s === id);
    });
    window.scrollTo(0, 0);
  }

  function goHome() {
    showBoard($("board-welcome"), 5, null);
    showScreen("screen-welcome");
    $("player-name").focus();
  }

  // ---------- game flow ----------
  function startGame(name) {
    state.name = name;
    state.deck = state.nextDeck || pickDeck();   // first game: deck chosen (and photos loading) since the page opened
    state.nextDeck = null;
    state.total = state.deck.length;
    state.index = 0;
    state.score = 0;
    state.cleared = 0;
    state.lives = LIVES;
    state.missed = 0;
    state.fiftyUsed = false;
    state.times = [];
    state.sharp = false;
    state.badges = [];
    renderLives(false);
    preloadDeck(state.deck, 0);
    $("hud-name").textContent = name;
    $("hud-score").textContent = "0";
    showScreen("screen-game");
    startRound();
  }

  function buildOptions(car, level) {
    var others = shuffle(window.CARS.filter(function (c) { return c.name !== car.name; }));
    if (level >= 3) {
      // harder levels: prefer look-alike wrong answers (same make first)
      others.sort(function (a, b) { return (b.make === car.make) - (a.make === car.make); });
    }
    var names = [car.name];
    others.forEach(function (c) {
      if (names.length < 4 && names.indexOf(c.name) === -1) names.push(c.name);
    });
    return shuffle(names);
  }

  // ---------- photo loading (one photo at a time, so the first round starts fast) ----------
  var imgCache = {};
  function photoSrc(car) { return car.img.replace(/^images\/cars\//, PHOTO_DIR); }
  function loadImg(src, done) {
    var rec = imgCache[src];
    if (!rec) {
      rec = imgCache[src] = { ok: false, cbs: [], src: src, retried: false };
      var im = new Image();
      var finish = function () {
        rec.ok = true;
        rec.cbs.splice(0).forEach(function (f) { f(rec.src); });
      };
      im.onload = finish;
      im.onerror = function () {
        // small photo missing: fall back to the bigger one in images/cars/
        if (!rec.retried && src.indexOf(PHOTO_DIR) === 0) {
          rec.retried = true;
          rec.src = src.replace(PHOTO_DIR, "images/cars/");
          im.src = rec.src;
        } else finish();
      };
      im.src = src;
    }
    if (rec.ok) done(rec.src); else rec.cbs.push(done);
  }

  /** Loads the photos of this game's cars in order, one after the other, in the background. */
  function preloadDeck(deck, from) {
    if (from >= deck.length) return;
    loadImg(photoSrc(deck[from]), function () { preloadDeck(deck, from + 1); });
  }

  function pickDeck() { return shuffle(window.CARS).slice(0, Math.min(MAX_LEVELS, window.CARS.length)); }

  function startRound() {
    var level = state.index + 1;
    var n = level + 1;                 // level 1 -> 2x2, level 2 -> 3x3, ...
    var count = n * n;

    state.car = state.deck[state.index];
    state.level = level;
    state.grid = n;
    state.tileCount = count;
    state.revealed = [];
    state.revealedCount = 0;
    state.locked = true;               // unlocked when the photo has loaded
    state.fiftyRound = false;
    $("btn-fifty").disabled = true;

    $("picture").style.backgroundImage = "none";
    $("feedback").classList.add("hidden");
    $("feedback").classList.remove("good", "bad");

    // tiles
    var tiles = $("tiles");
    tiles.innerHTML = "";
    tiles.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    tiles.style.gridTemplateRows = "repeat(" + n + ", 1fr)";
    for (var i = 0; i < count; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.textContent = i + 1;
      b.setAttribute("aria-label", "Reveal tile " + (i + 1) + " of " + count);
      b.dataset.index = i;
      b.addEventListener("click", onTileClick);
      tiles.appendChild(b);
    }

    // answer options
    var opts = $("options");
    opts.innerHTML = "";
    buildOptions(state.car, level).forEach(function (name, k) {
      var o = document.createElement("button");
      o.type = "button";
      o.className = "option";
      o.textContent = name;
      o.dataset.name = name;
      o.setAttribute("data-key", String(k + 1));
      o.addEventListener("click", function () { onAnswer(o); });
      opts.appendChild(o);
    });

    // wait for the photo, then open one random tile and start the round
    var car = state.car;
    updateHud();
    $("picture").classList.add("loading");
    $("hint").textContent = "Loading photo…";
    loadImg(photoSrc(car), function (src) {
      if (state.car !== car) return;   // the player already moved on
      $("picture").style.backgroundImage = "url('" + src + "')";
      $("picture").classList.remove("loading");
      state.locked = false;
      state.roundStart = Date.now();
      $("btn-fifty").disabled = state.fiftyUsed;
      revealTile(Math.floor(Math.random() * count), true);
      updateHud();
    });
  }

  function revealTile(i, instant) {
    if (state.revealed[i]) return;
    state.revealed[i] = true;
    state.revealedCount++;
    var tile = $("tiles").children[i];
    if (instant) tile.classList.add("instant");
    tile.classList.add("revealed");
    tile.tabIndex = -1;
  }

  function onTileClick(e) {
    if (state.locked) return;
    revealTile(Number(e.currentTarget.dataset.index), false);
    fx.tile();
    updateHud();
    pop($("hud-worth"));
  }

  /** Points the player would get right now (includes the 50/50 cost). */
  function worthNow() {
    var pts = calcPoints(state.level, state.tileCount, state.revealedCount);
    return state.fiftyRound ? Math.round(pts * FIFTY_KEEP) : pts;
  }

  function renderLives(shake) {
    var box = $("lives");
    box.innerHTML = "";
    for (var i = 0; i < LIVES; i++) {
      var h = document.createElement("span");
      var alive = i < state.lives;
      h.className = "heart" + (alive ? "" : " lost");
      h.textContent = "\u2665";
      box.appendChild(h);
    }
    box.setAttribute("aria-label", state.lives + (state.lives === 1 ? " life left" : " lives left"));
    if (shake) { box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); }
  }

  function updateHud() {
    $("hud-level").textContent = state.level + "/" + state.total + " · " + state.grid + "×" + state.grid;
    $("hud-worth").textContent = worthNow();
    var left = state.tileCount - state.revealedCount;
    $("hint").textContent = left > 0
      ? "Which car is it? Pick an answer, or open a tile for another clue (" + left + " still covered)."
      : "All tiles are open. Pick your answer.";
  }

  function onAnswer(btn) {
    if (state.locked) return;
    state.locked = true;

    var correct = btn.dataset.name === state.car.name;
    var earned = correct ? worthNow() : 0;
    $("btn-fifty").disabled = true;

    // open the whole picture
    for (var i = 0; i < state.tileCount; i++) {
      if (!state.revealed[i]) $("tiles").children[i].classList.add("revealed");
    }
    $("hint").textContent = "Full picture revealed.";

    Array.prototype.forEach.call($("options").children, function (o) {
      o.disabled = true;
      if (o.dataset.name === state.car.name) o.classList.add("correct");
      else if (o === btn) o.classList.add("wrong");
      else o.classList.add("dim");
    });

    var fb = $("feedback");
    var text = $("feedback-text");
    var next = $("btn-next");
    fb.classList.remove("hidden", "good", "bad");
    var factEl = $("car-fact");
    factEl.textContent = state.car.fact || "";
    factEl.classList.toggle("hidden", !state.car.fact);
    var specEl = $("car-specs"), sp = state.car.specs;
    specEl.innerHTML = "";
    if (sp) {
      [["Year", sp.year], ["Engine", sp.engine], ["Power", sp.power], ["Origin", sp.origin]].forEach(function (c) {
        var d = document.createElement("div"), k = document.createElement("span"), v = document.createElement("span");
        k.className = "k"; k.textContent = c[0]; v.className = "v"; v.textContent = c[1];
        d.appendChild(k); d.appendChild(v); specEl.appendChild(d);
      });
    }
    specEl.classList.toggle("hidden", !sp);

    var last = state.index + 1 >= state.total;
    function goNext(outcome) {
      return function () {
        if (last) finish(outcome());
        else { state.index++; startRound(); }
      };
    }

    if (correct) {
      state.score += earned;
      state.cleared++;
      state.times.push(Date.now() - state.roundStart);
      if (state.revealedCount === 1 && state.level >= 3) state.sharp = true;
      $("hud-score").textContent = state.score;
      pop($("hud-score"));
      fb.classList.add("good");
      text.textContent = "Correct! " + state.car.name + "  +" + earned + " points";
      next.textContent = last ? "Finish" : "Next level \u2192";
      next.onclick = goNext(function () { return state.missed === 0 ? "won" : "done"; });
      if (last && state.missed === 0) fx.win(); else fx.correct();
    } else {
      state.lives--;
      state.missed++;
      renderLives(true);
      fb.classList.add("bad");
      if (state.lives <= 0) {
        text.textContent = "Wrong answer. It was the " + state.car.name + ". No lives left.";
        next.textContent = "See result";
        next.onclick = function () { finish("over"); };
        fx.over();
      } else {
        var lost = Math.min(WRONG_PENALTY, state.score);
        state.score -= lost;
        $("hud-score").textContent = state.score;
        pop($("hud-score"));
        text.textContent = "Wrong! It was the " + state.car.name + "." + (lost ? "  \u2212" + lost + " points." : "") +
          "  " + state.lives + (state.lives === 1 ? " life" : " lives") + " left.";
        next.textContent = last ? "Finish" : "Next level \u2192";
        next.onclick = goNext(function () { return "done"; });
        fx.wrong();
      }
    }

    next.focus();
  }

  function computeBadges(outcome) {
    var list = [], n = state.times.length, sum = 0, i;
    for (i = 0; i < n; i++) sum += state.times[i];
    if (outcome === "won") list.push({ label: "Perfect run", color: "#ffb02e" });
    if (state.sharp) list.push({ label: "Sharp eye", color: "#4da3ff" });
    if (n >= 3 && sum / n <= SPEED_LIMIT) list.push({ label: "Speed demon", color: "#ff5a36" });
    if (!state.fiftyUsed && state.cleared >= 3) list.push({ label: "No lifelines", color: "#2ecc71" });
    if (outcome === "done") list.push({ label: "Survivor", color: "#c77dff" });
    return list;
  }

  function renderBadges() {
    var box = $("badges");
    box.innerHTML = "";
    state.badges.forEach(function (b) {
      var el = document.createElement("span");
      el.className = "badge";
      el.style.setProperty("--bc", b.color);
      el.textContent = b.label;
      box.appendChild(el);
    });
    box.classList.toggle("hidden", !state.badges.length);
  }

  function finish(outcome) {
    var won = outcome === "won";
    var bonus = won ? WIN_BONUS : 0;
    state.score += bonus;
    state.won = won;
    state.badges = computeBadges(outcome);

    var entry = {
      id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
      name: state.name, score: state.score,
      cleared: state.cleared, total: state.total,
      won: won, ts: Date.now()
    };
    addLocalScore(entry);

    $("result-eyebrow").textContent = won ? "Perfect run" : outcome === "done" ? "Finished" : "Game over";
    $("result-title").textContent = won ? "YOU WIN!" : outcome === "done" ? "WELL PLAYED" : "GAME OVER";
    $("result-sub").textContent = won
      ? "You named all " + state.total + " cars. Bonus +" + bonus + "."
      : outcome === "done"
        ? "You made it through all " + state.total + " levels with " + state.cleared + " correct, " + state.name + "."
        : "You cleared " + state.cleared + " of " + state.total + " levels, " + state.name + ".";
    $("result-score").textContent = state.score;
    $("result-rank").textContent = "Send your score to a friend. Can they beat it?";
    renderBadges();
    showBoard($("board-result"), 10, entry);
    resetShare();
    showScreen("screen-result");
    $("btn-again").focus();
    if (won) confetti();
  }

  // ---------- optional score sharing (after game over) ----------
  function shareLink() {
    var cfg = window.HC_CONFIG && window.HC_CONFIG.shareUrl;
    if (cfg) return cfg;
    return /^https?:/.test(location.href) ? location.href.split("#")[0] : "";
  }

  function shareText() {
    return "I scored " + state.score + " in Hidden Car (" + state.cleared + " of " + state.total +
      " levels cleared)! Can you beat me?";
  }

  function shareMessage() {
    var url = shareLink();
    return url ? shareText() + " " + url : shareText();
  }

  /** Draws the score picture (1080x1080) and resolves to a PNG blob. */
  function makeScoreCard() {
    var W = 1080, H = 1080;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var x = cv.getContext("2d");
    var FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    function font(weight, px) { x.font = weight + " " + px + "px " + FONT; }
    function spaced(v) { if ("letterSpacing" in x) x.letterSpacing = v; }
    function fitText(text, weight, px, maxW) {
      font(weight, px);
      while (x.measureText(text).width > maxW && px > 24) { px -= 2; font(weight, px); }
    }

    // background
    var bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#182036"); bg.addColorStop(1, "#080b12");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    var glow = x.createRadialGradient(W * 0.85, H * 0.12, 20, W * 0.85, H * 0.12, 520);
    glow.addColorStop(0, "rgba(255,90,54,0.35)"); glow.addColorStop(1, "rgba(255,90,54,0)");
    x.fillStyle = glow; x.fillRect(0, 0, W, H);

    // tile motif (a picture being revealed)
    var size = 62, gap = 10, cols = 3, gx = (W - (cols * size + (cols - 1) * gap)) / 2, gy = 70;
    var lit = { 0: "#ff5a36", 4: "#ffb02e", 8: "#2ecc71" };
    for (var n = 0; n < 9; n++) {
      var tx = gx + (n % cols) * (size + gap), ty = gy + Math.floor(n / cols) * (size + gap);
      x.fillStyle = lit[n] || "#1d2538";
      x.globalAlpha = lit[n] ? 1 : 0.9;
      x.beginPath(); x.roundRect ? x.roundRect(tx, ty, size, size, 12) : x.rect(tx, ty, size, size); x.fill();
    }
    x.globalAlpha = 1;

    x.textAlign = "center"; x.textBaseline = "alphabetic";

    // game name
    x.fillStyle = "#ffb02e"; font("800", 76); spaced("14px");
    x.fillText("HIDDEN CAR", W / 2 + 7, 400);
    spaced("0px");

    // player + score
    x.fillStyle = "#c3cbe0";
    fitText(state.name + " scored", "600", 56, W - 160);
    x.fillText(state.name + " scored", W / 2, 490);

    var scoreText = String(state.score);
    x.fillStyle = "#ffb02e"; font("900", scoreText.length > 4 ? 240 : 300);
    x.fillText(scoreText, W / 2, 740);

    x.fillStyle = "#8d97b3"; font("500", 42);
    x.fillText(state.won ? "Perfect run \u2605 all " + state.total + " cars named"
      : state.cleared + " of " + state.total + " levels cleared", W / 2, 810);

    // badges (up to 3)
    var bd = state.badges.slice(0, 3);
    if (bd.length) {
      font("700", 30);
      var padX = 24, ph = 54, gap2 = 16, dot = 9, i2, widths = [], total = 0;
      for (i2 = 0; i2 < bd.length; i2++) { widths[i2] = x.measureText(bd[i2].label).width + padX * 2 + dot * 2 + 12; total += widths[i2]; }
      total += gap2 * (bd.length - 1);
      var bx = (W - total) / 2, by = 845;
      x.textAlign = "left";
      for (i2 = 0; i2 < bd.length; i2++) {
        x.fillStyle = "rgba(255,255,255,0.08)";
        x.beginPath(); x.roundRect ? x.roundRect(bx, by, widths[i2], ph, 27) : x.rect(bx, by, widths[i2], ph); x.fill();
        x.fillStyle = bd[i2].color;
        x.beginPath(); x.arc(bx + padX + dot, by + ph / 2, dot, 0, 6.2832); x.fill();
        x.fillStyle = "#f2f5ff"; font("700", 30);
        x.fillText(bd[i2].label, bx + padX + dot * 2 + 12, by + ph / 2 + 11);
        bx += widths[i2] + gap2;
      }
      x.textAlign = "center";
    }

    // challenge line
    x.fillStyle = "#f2f5ff"; font("800", 84);
    x.fillText("Can you beat me?", W / 2, bd.length ? 985 : 940);

    var url = shareLink();
    if (url) {
      x.fillStyle = "#6e7894"; fitText(url.replace(/^https?:\/\//, ""), "500", 32, W - 160);
      x.fillText(url.replace(/^https?:\/\//, ""), W / 2, bd.length ? 1045 : 1010);
    }
    return new Promise(function (resolve) { cv.toBlob(resolve, "image/png"); });
  }

  function resetShare() {
    $("share-msg").textContent = "";
    $("share-whatsapp").href = "https://wa.me/?text=" + encodeURIComponent(shareMessage());
    state.cardBlob = makeScoreCard();     // ready before the player taps share
    $("card-preview").classList.add("hidden");
    state.cardBlob.then(function (blob) {
      if (state.cardUrl) URL.revokeObjectURL(state.cardUrl);
      state.cardUrl = URL.createObjectURL(blob);
      $("card-img").src = state.cardUrl;
      $("card-preview").classList.remove("hidden");
    });
  }

  function downloadBlob(blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hidden-car-score.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  var isTouch = function () { return window.matchMedia && window.matchMedia("(pointer: coarse)").matches; };

  $("share-whatsapp").addEventListener("click", function (e) {
    e.preventDefault();
    var msg = $("share-msg"), waUrl = this.href;
    state.cardBlob.then(function (blob) {
      var file = new File([blob], "hidden-car-score.png", { type: "image/png" });
      // phones: the share sheet lets the player pick WhatsApp and sends the picture directly
      if (isTouch() && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: shareMessage() }).catch(function () { /* cancelled */ });
      }
      // computers: copy the picture, open WhatsApp, the player pastes it into the chat
      var copied = (navigator.clipboard && window.ClipboardItem)
        ? navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(function () { return true; }, function () { return false; })
        : Promise.resolve(false);
      return copied.then(function (ok) {
        if (ok) {
          msg.textContent = "Picture copied. In the WhatsApp chat, click the message box and press Ctrl+V to paste it, then send.";
        } else {
          downloadBlob(blob);
          msg.textContent = "Score picture saved. In WhatsApp, attach it from your Downloads folder.";
        }
        window.open(waUrl, "_blank", "noopener");
      });
    });
  });

  $("share-save").addEventListener("click", function () {
    state.cardBlob.then(function (blob) {
      downloadBlob(blob);
      $("share-msg").textContent = "Picture saved as hidden-car-score.png. Attach it in WhatsApp.";
    });
  });

  $("share-copy").addEventListener("click", function () {
    var full = shareMessage();
    var done = function () { $("share-msg").textContent = "Copied. Paste it anywhere."; };
    var fail = function () { $("share-msg").textContent = "Couldn't copy. Select and copy the text manually."; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(done, fail);
    } else {
      var ta = document.createElement("textarea");
      ta.value = full; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? done() : fail(); } catch (e) { fail(); }
      document.body.removeChild(ta);
    }
  });

  // ---------- events ----------
  $("name-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("player-name").value.trim().replace(/\s+/g, " ");
    var err = $("name-error");
    if (name.length < 2) { err.textContent = "Please enter at least 2 characters."; return; }
    err.textContent = "";
    saveName(name);
    startGame(name);
  });

  $("btn-fifty").addEventListener("click", function () {
    if (state.locked || state.fiftyUsed) return;
    state.fiftyUsed = true;
    state.fiftyRound = true;
    this.disabled = true;
    var wrong = Array.prototype.filter.call($("options").children, function (o) {
      return o.dataset.name !== state.car.name;
    });
    shuffle(wrong).slice(0, 2).forEach(function (o) {
      o.disabled = true;
      o.classList.add("removed");
    });
    fx.lifeline();
    updateHud();
    pop($("hud-worth"));
  });

  function syncSoundButton() {
    var b = $("btn-sound"), on = fx.isOn();
    b.textContent = on ? "\uD83D\uDD0A" : "\uD83D\uDD07";
    b.setAttribute("aria-pressed", on ? "false" : "true");
    b.setAttribute("aria-label", on ? "Sound on. Click to mute" : "Sound off. Click to turn on");
  }
  $("btn-sound").addEventListener("click", function () { fx.toggle(); syncSoundButton(); fx.tile(); });
  syncSoundButton();

  $("btn-again").addEventListener("click", function () { startGame(state.name); });

  document.addEventListener("keydown", function (e) {
    if (!$("screen-game").classList.contains("active") || state.locked) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = Number(e.key);
    if (k >= 1 && k <= 4) {
      var opt = $("options").children[k - 1];
      if (opt) opt.click();
    }
  });

  // ---------- init ----------
  (function init() {
    var cars = window.CARS || [];
    if (cars.length < 4) {
      $("name-error").textContent = "Add at least 4 cars in js/cars.js to play.";
      $("name-form").querySelector("button").disabled = true;
    }
    $("player-name").value = loadName();
    showBoard($("board-welcome"), 5, null);
    var li = window.HC_CONFIG && window.HC_CONFIG.linkedinUrl;
    if (/^https:\/\//.test(li || "")) {
      $("linkedin-link").href = li;
      $("linkedin-link").classList.remove("hidden");
    }
    if (cars.length >= 4) { state.nextDeck = pickDeck(); preloadDeck(state.nextDeck, 0); }   // warm up while the player types a name
    window.HiddenCar = { calcPoints: calcPoints, state: state };
  })();
})();
