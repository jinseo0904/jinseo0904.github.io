// PAGE paper demo: word-wheel puzzles, clue unlocks via micro-surveys, and page effects.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ------------------------------------------------------------------
     Theme toggle (shares the "theme" key with the main site)
     ------------------------------------------------------------------ */
  var root = document.documentElement;
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  $('#theme-btn').addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  /* ------------------------------------------------------------------
     Micro-survey sheet (the in-game "answer to unlock" dialog)
     ------------------------------------------------------------------ */
  var sheet = $('#sheet'), sheetResolve = null, sheetAnswer = null;
  var submitBtn = $('#sheet-submit');

  function closeSheet(value) {
    sheet.classList.remove('open');
    var r = sheetResolve; sheetResolve = null;
    if (r) r(value);
  }

  function openSheet(q) {
    $('#sheet-cat').textContent = q.cat || '';
    $('#sheet-cat').hidden = !q.cat;
    $('#sheet-q').textContent = q.q;
    var body = $('#sheet-body');
    body.innerHTML = '';
    sheetAnswer = null;
    submitBtn.disabled = true;

    if (q.text) {
      var input = el('input');
      input.type = 'text';
      input.placeholder = 'Type what you were doing…';
      input.addEventListener('input', function () {
        sheetAnswer = input.value.trim() || null;
        submitBtn.disabled = !sheetAnswer;
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && sheetAnswer) closeSheet(sheetAnswer); });
      body.appendChild(input);
      var chips = el('div', 'chips');
      (q.chips || []).forEach(function (c) {
        var b = el('button', null, c);
        b.type = 'button';
        b.addEventListener('click', function () { input.value = c; input.dispatchEvent(new Event('input')); });
        chips.appendChild(b);
      });
      body.appendChild(chips);
      setTimeout(function () { input.focus(); }, 50);
    } else {
      var opts = el('div', 'opts');
      q.opts.forEach(function (o) {
        var b = el('button', 'opt', o);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          $$('.opt', opts).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          sheetAnswer = o;
          submitBtn.disabled = false;
        });
        b.addEventListener('dblclick', function () { closeSheet(o); });
        opts.appendChild(b);
      });
      body.appendChild(opts);
      setTimeout(function () { var f = $('.opt', opts); if (f) f.focus(); }, 50);
    }

    sheet.classList.add('open');
    return new Promise(function (resolve) { sheetResolve = resolve; });
  }

  submitBtn.addEventListener('click', function () { if (sheetAnswer) closeSheet(sheetAnswer); });
  $('#sheet-cancel').addEventListener('click', function () { closeSheet(null); });
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(null); });

  /* ------------------------------------------------------------------
     Word-wheel puzzle
     ------------------------------------------------------------------ */
  var puzzles = [], activePuzzle = null;

  function Puzzle(node, words, opts) {
    this.node = node;
    this.letters = node.getAttribute('data-letters').toUpperCase().split('');
    this.center = node.getAttribute('data-center').toUpperCase();
    this.outer = this.letters.filter(function (l) { return l !== this.center; }, this);
    this.words = words.map(function (w) { return w.toUpperCase(); });
    this.found = [];
    this.cur = '';
    this.opts = opts || {};
    this.entryEl = $('.entry', node);
    this.msgEl = $('.msg', node);
    this.hiveEl = $('.hive', node);
    this.countEl = $('.found .count', node);
    this.wordsEl = $('.found .words', node);
    this.renderHive();
    this.renderEntry();
    if (this.countEl) this.renderFound();

    var self = this;
    $$('[data-act]', node).forEach(function (b) {
      b.addEventListener('click', function () {
        activePuzzle = self;
        var a = b.getAttribute('data-act');
        if (a === 'del') self.del();
        else if (a === 'shuffle') self.shuffle();
        else self.enter();
      });
    });
    node.addEventListener('pointerdown', function () { activePuzzle = self; });
    puzzles.push(this);
  }

  Puzzle.prototype.isPangram = function (w) {
    return this.letters.every(function (l) { return w.indexOf(l) !== -1; });
  };

  Puzzle.prototype.renderHive = function () {
    var self = this;
    this.hiveEl.innerHTML = '';
    var all = [this.center].concat(this.outer);
    all.forEach(function (l, i) {
      var b = el('button', 'hex p' + i + (i === 0 ? ' center' : ''), l);
      b.type = 'button';
      b.setAttribute('aria-label', 'Letter ' + l + (i === 0 ? ' (center)' : ''));
      b.addEventListener('click', function () { activePuzzle = self; self.type(l); });
      self.hiveEl.appendChild(b);
    });
  };

  Puzzle.prototype.renderEntry = function () {
    var e = this.entryEl, self = this;
    e.innerHTML = '';
    this.cur.split('').forEach(function (l) {
      var cls = l === self.center ? 'c' : (self.letters.indexOf(l) === -1 ? 'x' : '');
      e.appendChild(el('span', cls, l));
    });
    e.appendChild(el('span', 'caret'));
    // Optional mirror of the current entry (e.g. the blank in the gate title)
    if (this.opts.mirror && !this.locked) {
      var m = this.opts.mirror;
      m.innerHTML = '';
      this.cur.split('').forEach(function (l) {
        var cls = l === self.center ? 'c' : (self.letters.indexOf(l) === -1 ? 'x' : '');
        m.appendChild(el('span', cls, l));
      });
    }
  };

  Puzzle.prototype.renderFound = function () {
    var n = this.found.length, total = this.opts.showTotal ? ' of ' + this.words.length : '';
    this.countEl.textContent = n === 0 ? 'You haven’t found any words yet.' :
      'You have found ' + n + total + ' word' + (n === 1 ? '' : 's');
    this.wordsEl.innerHTML = '';
    var self = this;
    this.found.slice().sort().forEach(function (w) {
      self.wordsEl.appendChild(el('span', self.isPangram(w) ? 'pangram' : '', w.toLowerCase()));
    });
  };

  Puzzle.prototype.flash = function (text, good) {
    var m = this.msgEl;
    m.innerHTML = '';
    var s = el('span', good ? 'good' : '', text);
    m.appendChild(s);
    clearTimeout(this._mt);
    this._mt = setTimeout(function () { m.innerHTML = ''; }, 1600);
  };

  Puzzle.prototype.shake = function () {
    var e = this.entryEl;
    e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake');
  };

  Puzzle.prototype.type = function (l) {
    if (this.locked) return;
    if (this.cur.length >= 19) { this.flash('Too long'); return; }
    this.cur += l.toUpperCase();
    this.renderEntry();
  };

  Puzzle.prototype.del = function () {
    if (this.locked) return;
    this.cur = this.cur.slice(0, -1);
    this.renderEntry();
  };

  Puzzle.prototype.shuffle = function () {
    var self = this, hexes = $$('.hex:not(.center)', this.hiveEl);
    hexes.forEach(function (h) { h.classList.add('fade'); });
    setTimeout(function () {
      shuffle(self.outer);
      self.renderHive();
    }, reduceMotion ? 0 : 180);
  };

  Puzzle.prototype.reject = function (text) {
    var self = this;
    this.flash(text);
    this.shake();
    setTimeout(function () { self.cur = ''; self.renderEntry(); }, 450);
  };

  Puzzle.prototype.enter = function () {
    if (this.locked) return;
    var w = this.cur, self = this;
    if (!w) return;
    if (w.length < 4) return this.reject('Too short');
    if (w.indexOf(this.center) === -1) return this.reject('Missing center letter');
    if (w.split('').some(function (l) { return self.letters.indexOf(l) === -1; })) return this.reject('Bad letters');
    if (this.found.indexOf(w) !== -1) return this.reject('Already found');
    if (this.words.indexOf(w) === -1) return this.reject('Not in word list');

    this.found.push(w);
    if (this.countEl) this.renderFound();
    var pangram = this.isPangram(w);
    var praise = pangram ? 'Pangram! 🐝' : (w.length >= 7 ? 'Awesome!' : w.length >= 5 ? 'Nice!' : 'Good!');
    var custom = this.opts.onFound ? this.opts.onFound(w, pangram) : null;
    this.flash(custom || praise, true);
    this.cur = '';
    this.renderEntry();
  };

  // Keyboard: route to the puzzle you last touched, or whichever is on screen
  function visible(p) {
    var r = p.node.getBoundingClientRect();
    return r.bottom > 60 && r.top < window.innerHeight;
  }
  document.addEventListener('keydown', function (e) {
    if (sheet.classList.contains('open')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var p = activePuzzle && visible(activePuzzle) ? activePuzzle : puzzles.filter(visible)[0];
    if (!p) return;
    if (/^[a-z]$/i.test(e.key)) { p.type(e.key); activePuzzle = p; e.preventDefault(); }
    else if (e.key === 'Backspace') { p.del(); e.preventDefault(); }
    else if (e.key === 'Enter' && (!t || t === document || t === document.body || (t.closest && t.closest('.puzzle')))) { p.enter(); e.preventDefault(); }
  });

  /* ------------------------------------------------------------------
     Entry gate: spell PAGE to enter
     ------------------------------------------------------------------ */
  var gate = $('.gate');
  var gateWords = ['PAGE', 'GAME', 'GAMEPLAY', 'PLAY', 'MAPLE', 'AMPLE', 'GLEAM', 'LEAP', 'PALE', 'PEAL', 'PLEA',
    'MEAL', 'MALE', 'LAME', 'GALE', 'PALM', 'LAMP', 'GALA', 'AGAPE', 'GAPE', 'ALLEY', 'MEALY', 'AMPLY', 'GAMY',
    'LLAMA', 'MAMMAL', 'APPLE', 'APPLY', 'GAGA', 'PAPA', 'MAMA', 'MAGMA', 'GAMELY', 'GALLEY', 'LEGAL', 'PAYEE'];

  var gateBlank = $('.gate h1 .blank');
  gateBlank.textContent = '';
  var gatePuzzle = new Puzzle($('#gate-puzzle'), gateWords, {
    mirror: gateBlank,
    onFound: function (w, pangram) {
      if (w === 'PAGE') { solveGate(); return 'You’re in! 🐝'; }
      if (pangram) return 'Pangram! But not the hidden word';
      if (w === 'GAME' || w === 'PLAY') return 'So close! Keep guessing';
      return 'Real word, but not the hidden one';
    }
  });
  activePuzzle = gatePuzzle;

  function solveGate() {
    gatePuzzle.locked = true;
    gateBlank.textContent = 'PAGE';
    gate.classList.add('solved');
    var c = $('#gate-clue');
    c.classList.add('solved');
    celebrate();
    setTimeout(function () {
      var target = $('#paper');
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 56, behavior: reduceMotion ? 'auto' : 'smooth' });
      activePuzzle = null;
    }, reduceMotion ? 2500 : 4800);
  }

  // Confetti burst (honey + teal hexagons and strips) and a big "You got it" banner
  function celebrate() {
    var banner = el('div', 'win-banner');
    banner.innerHTML = '<span class="big">🎉 PAGE!</span><span class="small">You got it. Opening the paper…</span>';
    document.body.appendChild(banner);
    setTimeout(function () { banner.classList.add('out'); }, 4000);
    setTimeout(function () { banner.remove(); }, 4600);
    if (reduceMotion) return;

    var cv = el('canvas', 'confetti');
    document.body.appendChild(cv);
    var dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    var colors = ['#f6c629', '#e0a800', '#1f8fae', '#5cc3de', '#ffffff', '#1f1b12'];
    var parts = [];
    function burst(x, y, dir, n) {
      for (var i = 0; i < n; i++) {
        var ang = (dir + (Math.random() - .5) * 1.1), sp = 9 + Math.random() * 11;
        parts.push({
          x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          r: 5 + Math.random() * 7, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
          c: colors[(Math.random() * colors.length) | 0], hex: Math.random() < .55, life: 0
        });
      }
    }
    burst(0, H, -Math.PI / 3, 90);
    burst(W, H, -Math.PI * 2 / 3, 90);
    var hive = $('#gate-puzzle .hive').getBoundingClientRect();
    burst(hive.left + hive.width / 2, hive.top + hive.height / 2, -Math.PI / 2, 70);

    function hexPath(r) {
      ctx.beginPath();
      for (var k = 0; k < 6; k++) { var a = Math.PI / 3 * k; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
    }
    var t0 = performance.now();
    (function frame(now) {
      var dt = now - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += .32; p.vx *= .985; p.vy *= .985;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - dt / 4200);
        ctx.fillStyle = p.c;
        if (p.hex) { hexPath(p.r); ctx.fill(); }
        else { ctx.scale(1, Math.cos(p.rot * 3)); ctx.fillRect(-p.r, -p.r / 3, p.r * 2, p.r / 1.5); }
        ctx.restore();
      });
      if (dt < 4200) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  var gateClueBtn = $('#gate-clue'), gateStage = 0;
  var gateClues = {
    '😍 I love them!': 'You love word puzzles, so imagine one built from your own day: a Personalized Adaptive Game for Engagement, or {} for short.',
    '🙂 They’re fun': 'Puzzles are even more fun when they’re about your own day. That’s the idea behind {}: Personalized Adaptive Games for Engagement.',
    '🤔 Sometimes': 'Only sometimes? Maybe you’d play more if the puzzle were about you. That’s {}: Personalized Adaptive Games for Engagement.',
    '😅 Not really': 'Not a puzzle person? Fair! This paper makes puzzles personal. It’s called {}: Personalized Adaptive Games for Engagement.'
  };

  function renderClueText(target, tmpl, word) {
    target.innerHTML = '';
    var parts = tmpl.split('{}');
    parts.forEach(function (p, i) {
      target.appendChild(document.createTextNode(p));
      if (i < parts.length - 1) target.appendChild(el('span', 'blank', word));
    });
  }

  // Bold + yellow the first letter of each word in "Personalized Adaptive Game(s) for Engagement"
  function highlightAcronym(node) {
    var re = /(Personalized) (Adaptive) (Games?) for (Engagement)/;
    Array.prototype.slice.call(node.childNodes).forEach(function (t) {
      if (t.nodeType !== 3) return;
      var m = t.nodeValue.match(re);
      if (!m) return;
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(t.nodeValue.slice(0, m.index)));
      [m[1], m[2], m[3], 'for', m[4]].forEach(function (w, i) {
        if (i) frag.appendChild(document.createTextNode(' '));
        if (w === 'for') { frag.appendChild(document.createTextNode(w)); return; }
        frag.appendChild(el('b', 'acr', w[0]));
        frag.appendChild(document.createTextNode(w.slice(1)));
      });
      frag.appendChild(document.createTextNode(t.nodeValue.slice(m.index + m[0].length)));
      node.replaceChild(frag, t);
    });
  }

  // Plain-language note about what just happened (static strings only)
  function showNote(html) {
    var box = $('#gate-datapoint');
    box.innerHTML = html;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  }

  gateClueBtn.addEventListener('click', function () {
    if (gate.classList.contains('solved')) return;
    if (gateStage === 0) {
      openSheet({ q: 'Do you like word puzzles?', opts: Object.keys(gateClues) }).then(function (a) {
        if (!a) return;
        gateStage = 1;
        gateClueBtn.classList.remove('locked');
        gateClueBtn.classList.add('unlocked');
        var text = $('.text', gateClueBtn);
        renderClueText(text, gateClues[a], 'PAGE');
        highlightAcronym(text);
        var more = el('span', 'more', 'Stronger hint? Answer one more →');
        gateClueBtn.appendChild(more);
        showNote('📊 To unlock that hint, you just answered a question. In PAGE, it can be <b>any question</b> researchers want to ask, so every hint adds to the study data!');
      });
    } else if (gateStage === 1) {
      openSheet({ q: 'How’s the puzzle so far?', opts: ['😎 Too easy', '👌 Just right', '🥵 Too hard'] }).then(function (a) {
        if (!a) return;
        gateStage = 2;
        $('.tag', gateClueBtn).textContent = 'P4';
        var more = $('.more', gateClueBtn);
        if (more) more.textContent = 'P4: starts with P, 4 letters.';
        showNote('📊 That’s another answer for the researchers! In our study, participants answered <b>1,188</b> of these questions just to get hints.');
      });
    }
  });

  /* ------------------------------------------------------------------
     Demo puzzle (CAREFUL / center C) with clue cards
     ------------------------------------------------------------------ */
  var demoWords = ['CALL', 'FACE', 'CAFE', 'CEREAL', 'CELLULAR', 'CARE', 'RACE', 'CLEAR', 'LACE', 'CURL', 'CAREFUL',
    'CLUE', 'CALF', 'CURE', 'ACRE', 'CRUEL', 'ULCER', 'FARCE', 'CELLAR', 'RECALL', 'CULL', 'ACCRUE', 'FLEECE',
    'RECUR', 'CAREER', 'CLEF'];

  var cardData = [
    { w: 'FACE', type: 'ctx', src: '🎙 self-report', clue: 'Your morning routine involves carefully washing your {}.' },
    { w: 'CALL', type: 'ctx', src: '🎙 self-report', clue: 'You were {}ing your friend on your way home from campus.' },
    { w: 'CELLULAR', type: 'ctx', src: '🎙 self-report + logic', clue: 'To call your friend on the train, your phone needed an active {} service.' },
    { w: 'CEREAL', type: 'ctx', src: '🎙 self-report', clue: 'You kicked off the day at 7 AM with a bowl of {} in the kitchen.' },
    { w: 'CAFE', type: 'ctx', src: '📍 location + POI', clue: 'Around noon you settled into a {} near campus with a latte.' },
    { w: 'RACE', type: 'ctx', src: '❤️ heart rate + steps', clue: 'Your heart rate spiked in the afternoon as you had to {} to your 3 PM lecture.' },
    { w: 'CARE', type: 'prime', src: '🧠 your answer',
      q: { cat: 'Priming question', q: 'Do you look after a pet or a plant at home?', opts: ['Yes', 'No'], key: 'has_pet_or_plant' },
      clues: {
        'Yes': 'You look after a pet or plant at home, so you know what it takes to {} for something living.',
        'No': 'No pets or plants at home? That’s one less thing to take {} of.'
      } },
    { w: 'CLEAR', type: 'gen', src: 'fallback', clue: 'Transparent, like a freshly washed window: {}.' },
    { w: 'CURL', type: 'gen', src: 'fallback', clue: 'A bicep {} at the gym.' },
    { w: 'CAREFUL', type: 'gen', src: 'fallback · pangram', clue: 'Cautious, watching every step: {}.' }
  ];

  var questionPool = [
    { cat: 'Cluster labeling', q: 'You spent about 3 hours at a place near campus yesterday (12–3 PM). What is this place to you?', opts: ['Home', 'Work', 'School', 'Café / restaurant', 'Other'], key: 'cluster_label' },
    { cat: 'Data gap', q: 'Your watch was off between 3 and 5 PM yesterday. What were you doing?', text: true, chips: ['In a lecture', 'Charging the watch', 'At the gym', 'Commuting'], key: 'gap_3pm_5pm' },
    { cat: 'Priming question', q: 'Are you a morning person?', opts: ['Yes', 'No', 'Depends on the coffee'], key: 'morning_person' },
    { cat: 'Priming question', q: 'Do you usually cook your own dinner?', opts: ['Yes', 'No', 'Sometimes'], key: 'cooks_dinner' },
    { cat: 'UX survey', q: 'How difficult is today’s puzzle so far?', opts: ['Too easy', 'Just right', 'Too hard'], key: 'puzzle_difficulty' },
    { cat: 'Validated survey item (PHQ-9 placeholder)', q: 'Over the last 2 weeks, how often have you been bothered by feeling tired or having little energy?', opts: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'], key: 'phq9_item4' }
  ];
  var queue = [], lastCat = null;
  function nextQuestion() {
    if (!queue.length) queue = shuffle(questionPool.slice());
    // never ask the same category twice in a row (as in the study)
    var i = queue.findIndex(function (q) { return q.cat !== lastCat; });
    var q = queue.splice(i < 0 ? 0 : i, 1)[0];
    lastCat = q.cat;
    return q;
  }

  var rlog = $('#rlog'), rcount = $('#rcount'), nData = 0;
  function logData(cat, key, answer, note) {
    if (!nData) rlog.innerHTML = '';
    nData++;
    rcount.textContent = nData;
    var row = el('div', 'row');
    row.appendChild(el('span', 'k', cat));
    row.appendChild(el('span', null, key + ' = "' + answer + '"' + (note ? '  · ' + note : '')));
    rlog.insertBefore(row, rlog.firstChild);
  }

  var typeLabel = { ctx: 'contextual', prime: 'priming', gen: 'generic' };
  var typeBadge = { ctx: 'badge ctx', prime: 'badge prime', gen: 'badge' };
  var cards = {};

  function buildCard(d, idx) {
    var b = el('button', 'clue locked');
    b.type = 'button';
    var tag = el('span', 'tag', 'C' + (idx + 1));
    var text = el('span', 'text', 'Locked clue · ' + d.w.length + ' letters. Tap to answer a question and unlock it.');
    var meta = el('span', 'meta');
    meta.appendChild(el('span', typeBadge[d.type], typeLabel[d.type]));
    meta.appendChild(el('span', 'badge', d.src));
    b.appendChild(tag); b.appendChild(text); b.appendChild(meta);
    var state = { stage: 0, node: b, tag: tag, text: text, data: d, tmpl: d.clue };

    function reveal(tmpl) {
      state.tmpl = tmpl;
      renderClueText(text, tmpl, d.w);
      b.classList.remove('locked');
      b.classList.add('unlocked');
    }
    state.reveal = reveal;

    b.addEventListener('click', function () {
      if (b.classList.contains('solved') || state.stage >= 2) return;
      if (state.stage === 0) {
        var q = d.q || nextQuestion();
        openSheet(q).then(function (a) {
          if (!a) return;
          state.stage = 1;
          reveal(d.clues ? d.clues[a] : d.clue);
          if (!b.classList.contains('solved')) b.appendChild(el('span', 'more', 'Stronger hint? Answer one more →'));
          logData(q.cat, q.key, a, d.q ? 'seeds tomorrow’s clue' : 'unlocked ' + tag.textContent);
        });
      } else {
        var q2 = nextQuestion();
        openSheet(q2).then(function (a) {
          if (!a) return;
          state.stage = 2;
          tag.textContent = d.w[0] + d.w.length;
          var m = $('.more', b);
          if (m) m.textContent = d.w[0] + d.w.length + ': starts with ' + d.w[0] + ', ' + d.w.length + ' letters.';
          logData(q2.cat, q2.key, a, 'unlocked ' + d.w[0] + d.w.length);
        });
      }
    });
    cards[d.w] = state;
    return b;
  }

  var cardsEl = $('#cards');
  cardData.forEach(function (d, i) { cardsEl.appendChild(buildCard(d, i)); });

  new Puzzle($('#demo-puzzle'), demoWords, {
    showTotal: true,
    onFound: function (w) {
      var c = cards[w];
      if (!c) return null;
      if (c.node.classList.contains('locked')) c.reveal(c.data.clues ? c.data.clues.Yes : c.tmpl);
      c.node.classList.add('solved');
      var m = $('.more', c.node); if (m) m.remove();
      c.tag.textContent = '✓';
      return 'Clue solved!';
    }
  });

  /* ------------------------------------------------------------------
     Scroll effects: pipeline stages, diary typewriter, stats, bars
     ------------------------------------------------------------------ */
  var diaryEl = $('#diary'), diaryDone = false;
  function typeDiary() {
    if (diaryDone) return;
    diaryDone = true;
    var tokens = diaryEl.getAttribute('data-text').split(/(\[[^\]]+\])/).filter(Boolean);
    diaryEl.innerHTML = '';
    var cursor = el('span', 'cursor');
    diaryEl.appendChild(cursor);
    if (reduceMotion) {
      tokens.forEach(function (t) {
        diaryEl.insertBefore(t[0] === '[' ? el('mark', null, t.slice(1, -1)) : document.createTextNode(t), cursor);
      });
      cursor.remove();
      return;
    }
    var ti = 0, ci = 0, node = null;
    (function step() {
      if (ti >= tokens.length) { setTimeout(function () { cursor.remove(); }, 1200); return; }
      var t = tokens[ti], isMark = t[0] === '[', s = isMark ? t.slice(1, -1) : t;
      if (ci === 0) { node = isMark ? el('mark') : document.createTextNode(''); diaryEl.insertBefore(node, cursor); }
      ci++;
      if (isMark) node.textContent = s.slice(0, ci); else node.nodeValue = s.slice(0, ci);
      if (ci >= s.length) { ti++; ci = 0; }
      setTimeout(step, isMark ? 40 : 12);
    })();
  }

  function countUp(n) {
    var target = +n.getAttribute('data-count'), prefix = n.getAttribute('data-prefix') || '';
    var small = $('small', n), suffix = small ? small.outerHTML : '';
    var start = null, dur = reduceMotion ? 0 : 1200;
    function fmt(v) { return prefix + Math.round(v).toLocaleString('en-US') + suffix; }
    if (!dur) { n.innerHTML = fmt(target); return; }
    requestAnimationFrame(function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - p, 3);
      n.innerHTML = fmt(target * e);
      if (p < 1) requestAnimationFrame(frame);
    });
  }

  // Unique semantic tags (Table 4 in the paper)
  var tags = [
    ['Activity', 285, 267], ['Location', 198, 179], ['Objects', 119, 109], ['Purpose', 57, 51],
    ['Specificity', 33, 33], ['Social', 28, 14], ['Time', 24, 14], ['Posture', 15, 16], ['State', 2, 6]
  ];
  var barsEl = $('#bars'), maxTag = 285;
  tags.forEach(function (t) {
    var row = el('div', 'bar');
    row.appendChild(el('span', 'name', t[0]));
    var tracks = el('div', 'tracks');
    [['p', t[1]], ['n', t[2]]].forEach(function (x) {
      var tr = el('div', 'track'), f = el('div', 'fill ' + x[0]);
      f.setAttribute('data-w', (x[1] / maxTag * 88).toFixed(1));
      tr.style.display = 'flex'; tr.style.alignItems = 'center';
      tr.appendChild(f);
      var v = el('span', 'val', String(x[1]));
      v.style.position = 'static';
      tr.appendChild(v);
      tracks.appendChild(tr);
    });
    row.appendChild(tracks);
    barsEl.appendChild(row);
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target;
        if (t.classList.contains('kf')) {
          t.classList.add('in');
        } else if (t.classList.contains('stage')) {
          t.classList.add('in');
          if ($('#diary', t)) setTimeout(typeDiary, 400);
        } else if (t.hasAttribute('data-count')) {
          countUp(t);
        } else if (t.id === 'bars') {
          $$('.fill', t).forEach(function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
        }
        io.unobserve(t);
      });
    }, { threshold: 0.25 });
    $$('.stage').forEach(function (s) { io.observe(s); });
    $$('.kf').forEach(function (s) { io.observe(s); });
    $$('[data-count]').forEach(function (s) { io.observe(s); });
    io.observe(barsEl);
  } else {
    $$('.stage, .kf').forEach(function (s) { s.classList.add('in'); });
    typeDiary();
    $$('[data-count]').forEach(countUp);
    $$('.fill').forEach(function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
  }

  /* ------------------------------------------------------------------
     Loop diagram: self-report bubble and sensing cloud, then yesterday's
     data turns into clues on the middle card, then the clue is typed out
     on the phone with its goal word. The active card stays in focus and a
     three-part progress bar tracks the phase. Replays while on screen.
     ------------------------------------------------------------------ */
  var loop = $('.lp'), say = $('#lp-say'), think = $('#lp-think'), clue = $('#lp-clue'), pz = $('#lp-pz'), phone = $('#lp-phone');
  if (loop && say && think && clue && pz && phone) {
    var clueT = $('.clue-t', clue), goal = $('.goal', clue), clueText = clueT.getAttribute('data-text');
    var bars = $$('.lp-progress li'), cards = $$('.lp-card');
    var PHASES = [['data', 9000], ['llm', 9000], ['game', 15600]];
    var timers = [];
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var setBar = function (li, full, ms) {
      var fill = $('i', li);
      fill.style.transition = full ? 'width ' + ms + 'ms linear' : 'none';
      fill.style.width = full ? '100%' : '0';
    };
    var resetLoop = function () {
      timers.forEach(clearTimeout); timers = [];
      [say, think, clue, goal].forEach(function (n) { n.classList.remove('show'); });
      pz.classList.remove('run');
      phone.classList.remove('hit');
      phone.classList.add('wait');
      cards.forEach(function (c) { c.classList.remove('on'); });
      bars.forEach(function (li) { li.classList.remove('on'); setBar(li, false); });
      loop.removeAttribute('data-phase');
    };
    var phase = function (i) {
      loop.setAttribute('data-phase', PHASES[i][0]);
      bars.forEach(function (li, j) { li.classList.toggle('on', j === i); });
      cards.forEach(function (c, j) { c.classList.toggle('on', j === i); });
      phone.classList.toggle('wait', i !== 2);
      bars[i].offsetWidth; // flush so the fill animates from 0
      setBar(bars[i], true, PHASES[i][1]);
    };
    var typeClue = function () {
      clue.classList.add('show');
      clueT.textContent = '';
      var node = document.createTextNode(''), cursor = el('span', 'cursor'), rest = el('span', 'rest'), i = 0;
      clueT.appendChild(node); clueT.appendChild(cursor); clueT.appendChild(rest);
      (function step() {
        node.nodeValue = clueText.slice(0, ++i);
        rest.textContent = clueText.slice(i);
        if (i < clueText.length) return later(step, 38);
        later(function () { cursor.remove(); goal.classList.add('show'); phone.classList.add('hit'); }, 900);
      })();
    };
    var playLoop = function () {
      resetLoop();
      var t1 = PHASES[0][1], t2 = t1 + PHASES[1][1], t3 = t2 + PHASES[2][1];
      later(function () { phase(0); }, 50);
      later(function () { say.classList.add('show'); }, 900);
      later(function () { think.classList.add('show'); }, 3600);
      later(function () { phase(1); pz.classList.add('run'); }, t1);
      later(function () { phase(2); typeClue(); }, t2);
      later(function () { [say, think, clue].forEach(function (n) { n.classList.remove('show'); }); pz.classList.remove('run'); phone.classList.remove('hit'); }, t3);
      later(playLoop, t3 + 2100);
    };
    if (reduceMotion || !('IntersectionObserver' in window)) {
      clueT.textContent = clueText;
      [say, think, clue, goal].forEach(function (n) { n.classList.add('show'); });
      pz.classList.add('run');
      phone.classList.add('hit');
    } else {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) playLoop(); else resetLoop();
      }, { threshold: 0.2 }).observe(loop);
    }
  }

  /* ------------------------------------------------------------------
     Feedback loop: over three days the self-report gets richer, the next
     day's clue gets more personal, and each new detail lands in the
     researcher's dataset. Replays while on screen.
     ------------------------------------------------------------------ */
  var fl = $('.fl');
  if (fl) {
    var DAYS = [
      { say: '[Working] on my [laptop]', clue: 'You spent part of yesterday working on your ______.', word: 'LAPTOP', react: '🙂',
        tags: ['works on a laptop'] },
      { say: '[Sitting] in my [room], [working] on my [laptop]', clue: 'You set up your laptop and worked from your ____.', word: 'ROOM', react: '😄',
        tags: ['works in their room', 'sits while working'] },
      { say: '[Sitting] in my [room] and [working] on my [laptop] for my [coding homework]', clue: 'Your laptop kept you busy with ______ homework.', word: 'CODING', react: '🤩',
        tags: ['takes a coding class', 'does homework at home'] }
    ];
    var flSayB = $('.fl-say', fl), flSay = $('.fl-t', flSayB), flClueB = $('.fl-clue', fl), flClue = $('.fl-t', flClueB);
    var flGoal = $('.goal', flClueB), flReact = $('.fl-react', fl), flDay = $('.fl-day', fl), flChips = $('.fl-chips', fl);
    var flCards = $$('.lp-card', fl), flTimers = [];
    var flLater = function (fn, ms) { flTimers.push(setTimeout(fn, ms)); };
    var flPhase = function (name, card) {
      fl.setAttribute('data-phase', name);
      flCards.forEach(function (c, j) { c.classList.toggle('on', j === card); });
    };
    // Types text into node; [bracketed] words become highlighted marks. Calls done when finished.
    var flType = function (node, text, done) {
      var tokens = text.split(/(\[[^\]]+\])/).filter(Boolean), ti = 0, ci = 0, cur = null;
      var cursor = el('span', 'cursor');
      node.textContent = '';
      node.appendChild(cursor);
      (function step() {
        if (ti >= tokens.length) { cursor.remove(); return done(); }
        var t = tokens[ti], isMark = t[0] === '[', str = isMark ? t.slice(1, -1) : t;
        if (ci === 0) { cur = isMark ? el('mark') : document.createTextNode(''); node.insertBefore(cur, cursor); }
        ci++;
        if (isMark) cur.textContent = str.slice(0, ci); else cur.nodeValue = str.slice(0, ci);
        if (ci >= str.length) { ti++; ci = 0; }
        flLater(step, 34);
      })();
    };
    var flReset = function () {
      flTimers.forEach(clearTimeout); flTimers = [];
      [flSayB, flClueB, flGoal, flReact].forEach(function (n) { n.classList.remove('show'); });
      flChips.textContent = '';
      flCards.forEach(function (c) { c.classList.remove('on'); });
      fl.removeAttribute('data-phase');
    };
    var flDayRun = function (i) {
      var d = DAYS[i];
      flDay.textContent = 'Day ' + (i + 1);
      flDay.classList.remove('bump'); flDay.offsetWidth; flDay.classList.add('bump');
      flPhase('report', 0);
      [flClueB, flGoal, flReact].forEach(function (n) { n.classList.remove('show'); });
      flSayB.classList.add('show');
      flType(flSay, '“' + d.say + '”', function () {
        flLater(function () {
          flPhase('game', 1);
          flClueB.classList.add('show');
          flType(flClue, d.clue, function () {
            flGoal.textContent = '(' + d.word + ')';
            flGoal.classList.add('show');
            flLater(function () { flReact.textContent = d.react; flReact.classList.add('show'); }, 500);
            flLater(function () {
              flPhase('res', 2);
              d.tags.forEach(function (t, k) {
                var chip = el('span', 'fl-chip', t);
                flChips.appendChild(chip);
                flLater(function () { chip.classList.add('show'); }, 250 + k * 350);
              });
              flLater(function () {
                if (i < DAYS.length - 1) {
                  flPhase('back', 0);
                  flSayB.classList.remove('show');
                  flLater(function () { flDayRun(i + 1); }, 1400);
                } else {
                  flLater(function () { flReset(); flLater(function () { flDayRun(0); }, 600); }, 3200);
                }
              }, 2200);
            }, 1800);
          });
        }, 900);
      });
    };
    if (!reduceMotion && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        flReset();
        if (entries[0].isIntersecting) flDayRun(0);
        else flDay.textContent = 'Day 1';
      }, { threshold: 0.2 }).observe(fl);
    }
  }

  /* ------------------------------------------------------------------
     Copy BibTeX
     ------------------------------------------------------------------ */
  $$('[data-copy]').forEach(function (b) {
    var original = b.innerHTML;
    b.addEventListener('click', function () {
      var text = $(b.getAttribute('data-copy')).textContent;
      var done = function () {
        b.textContent = '✓ Copied';
        setTimeout(function () { b.innerHTML = original; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { b.textContent = 'Copy failed'; });
      } else {
        var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { b.textContent = 'Copy failed'; }
        ta.remove();
      }
    });
  });
})();
