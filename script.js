// Bump this whenever the file changes so the console tells you which build is live.
const APP_VERSION = 'v2026-10-04-2';
console.log('%c[RL1000] ' + APP_VERSION, 'font-weight:bold;color:#00b4ff');

const TARGET = 1000;
const CIRCUMFERENCE = 2 * Math.PI * 70; // ~439.82

// ---- DOM refs ----
const counter1 = document.getElementById('counter1');
const counter2 = document.getElementById('counter2');
const circle1 = document.getElementById('circle1');
const circle2 = document.getElementById('circle2');
const pct1 = document.getElementById('pct1');
const pct2 = document.getElementById('pct2');
const sub1 = document.getElementById('sub1');
const sub2 = document.getElementById('sub2');
const toGo1 = document.getElementById('toGo1');
const toGo2 = document.getElementById('toGo2');
const tier1 = document.getElementById('tier1');
const tier2 = document.getElementById('tier2');
const card1 = document.getElementById('card1');
const card2 = document.getElementById('card2');
const addBtn = document.getElementById('addBtn');
const plusOne = document.getElementById('plusOne');
const container = document.getElementById('container');
const matchToast = document.getElementById('matchToast');
const rankUp = document.getElementById('rankUp');
const rankUpName = document.getElementById('rankUpName');
const rankUpPlayer = document.getElementById('rankUpPlayer');
const rankUpIcon = document.getElementById('rankUpIcon');
const congrats = document.getElementById('congrats');
const congratsText = document.getElementById('congratsText');
const confetti = document.getElementById('confetti');
const screenFlash = document.getElementById('screenFlash');
const energyFill = document.getElementById('energyFill');
const energyThumb = document.getElementById('energyThumb');
const streak1 = document.getElementById('streak1');
const streak2 = document.getElementById('streak2');
const timerEl = document.getElementById('timer');
const crest1 = document.getElementById('crest1');
const crest2 = document.getElementById('crest2');

// ---- lock / side refs ----
const lock = document.getElementById('lock');
const lockTeamStep = document.getElementById('lockTeamStep');
const lockPwStep = document.getElementById('lockPwStep');
const pickP1 = document.getElementById('pickP1');
const pickP2 = document.getElementById('pickP2');
const lockBack = document.getElementById('lockBack');
const lockBadge = document.getElementById('lockBadge');
const lockPwTitle = document.getElementById('lockPwTitle');
const lockPwSub = document.getElementById('lockPwSub');
const lockInput = document.getElementById('lockInput');
const lockConfirm = document.getElementById('lockConfirm');
const lockError = document.getElementById('lockError');
const lockSubmit = document.getElementById('lockSubmit');
const cloudNoteTeam = document.getElementById('cloudNoteTeam');
const cloudNotePw = document.getElementById('cloudNotePw');
const sideChip = document.getElementById('sideChip');
const switchBtn = document.getElementById('switchBtn');

// ============ FIREBASE (Firestore) + LOCAL STORAGE ============
// Fill in the config below to sync wins + passcodes to the cloud. Until you
// paste a real apiKey/projectId, the app keeps working and saves to this
// browser only (offline mode).
//
// One-time setup:
//   1. console.firebase.google.com  ->  add a Web app  ->  copy its config.
//   2. Firestore Database -> Create database (start in TEST mode).
//   3. The app reads/writes one document:  matches/1
//        p1_wins, p2_wins (number)  and  p1_hash, p2_hash (string).
//   Passcodes are stored as SHA-256 hashes, never plaintext.
//
// The Firebase compat SDK is loaded by the two <script> tags at the bottom of
// index.html, so this whole project still has no build step.
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDrNdxxAGts_KB-BXOwDNMrmIXXNOjNVFY',
    authDomain: 'rocketleague1000winchallange.firebaseapp.com',
    projectId: 'rocketleague1000winchallange',
    storageBucket: 'rocketleague1000winchallange.firebasestorage.app',
    messagingSenderId: '855704621795',
    appId: '1:855704621795:web:d046c9eb5702f0f6fa2bd6',
    measurementId: 'G-DPWT1VPXCQ',
};

const CLOUD = {
    configured: (() => {
        const c = FIREBASE_CONFIG;
        return !!c &&
            !!c.apiKey && c.apiKey.indexOf('YOUR_') === -1 &&
            !!c.projectId && c.projectId.indexOf('YOUR_') === -1;
    })(),
    doc: null, // lazily filled in initFirebase()
};

// Lazy-init the Firestore document so we only talk to Firebase when configured.
function initFirebase() {
    if (!window.firebase) return Promise.reject(new Error('firebase sdk not loaded'));
    if (window.__rlFirebaseReady) return Promise.resolve();
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.firestore();
    db.settings({ timestampsInSnapshots: true });
    CLOUD.doc = db.collection('matches').doc('1');
    window.__rlFirebaseReady = true;
    return Promise.resolve();
}

async function cloudFetchRow() {
    await initFirebase();
    console.log('[FIRESTORE] READ matches/1');
    const snap = await CLOUD.doc.get({ source: 'server' });
    console.log('[FIRESTORE] READ result ->', snap.exists ? snap.data() : '(no doc)');
    return snap.exists ? snap.data() : null;
}

// Write ONLY the fields passed in (merge), so a win-save can never clobber a
// hash and a hash-save can never clobber a win. Every call touches just its own keys.
async function cloudSetFields(fields) {
    await initFirebase();
    console.log('[FIRESTORE] WRITE matches/1 (merge) ->', JSON.stringify(fields));
    await CLOUD.doc.set(fields, { merge: true });
}

// Unified store: Firebase when configured, otherwise this browser's storage.
const store = {
    get mode() { return CLOUD.configured ? 'cloud' : 'local'; },
    async load() {
        if (this.mode === 'cloud') {
            const row = await cloudFetchRow();
            return {
                v1: row ? (row.p1_wins || 0) : 0,
                v2: row ? (row.p2_wins || 0) : 0,
                p1Hash: row ? (row.p1_hash || null) : null,
                p2Hash: row ? (row.p2_hash || null) : null,
            };
        }
        const raw = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        return { v1: raw.p1 || 0, v2: raw.p2 || 0, p1Hash: raw.p1Hash || null, p2Hash: raw.p2Hash || null };
    },
    // Write ONLY win fields (p1/p2 are optional) — never touches hashes.
    async saveWins(fields) {
        if (this.mode === 'cloud') {
            const f = {};
            if (fields.p1 != null) f.p1_wins = fields.p1;
            if (fields.p2 != null) f.p2_wins = fields.p2;
            await cloudSetFields(f);
            return;
        }
        const raw = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        if (fields.p1 != null) raw.p1 = fields.p1;
        if (fields.p2 != null) raw.p2 = fields.p2;
        localStorage.setItem('rl1000', JSON.stringify(raw));
    },
    // Write ONLY one side's passcode hash — never touches wins.
    async saveHash(side, hash) {
        if (this.mode === 'cloud') {
            await cloudSetFields(side === 'p1' ? { p1_hash: hash } : { p2_hash: hash });
            return;
        }
        const raw = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        if (side === 'p1') raw.p1Hash = hash; else raw.p2Hash = hash;
        localStorage.setItem('rl1000', JSON.stringify(raw));
    },
};

// SHA-256 for passcodes (browser WebCrypto; falls back if unavailable)
async function sha256(text) {
    if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return 'fb_' + (h >>> 0).toString(16);
}

// Per-side session + pending selection for the two-step gate.
let activeSide = null;   // null | 'p1' | 'p2' — which side you're logged in as
let pendingSide = null;   // side picked in step 1, awaiting its passcode
let pwMode = null;        // 'create' (first time) | 'verify' (already set)

// Display names for each side (internal keys stay 'p1'/'p2' so the
// Firestore / local storage fields are unchanged).
const SIDE_NAME = { p1: 'KOFTAWI', p2: 'OMAAAAAAAR' };

function sideLabel(side) {
    return side === 'p1' ? 'KOFTAWI · ORANGE' : 'OMAAAAAAAR · BLUE';
}

function setCloudNote(el, online) {
    el.classList.remove('online', 'local');
    if (CLOUD.configured && online !== false) {
        el.textContent = '● Cloud sync on — saving to Firebase';
        el.classList.add('online');
    } else {
        el.textContent = CLOUD.configured
            ? '… waiting on cloud'
            : '○ Offline mode — saved to this browser';
        el.classList.add('local');
    }
}

// STEP 1 — choose a side. Figures out whether that side still needs a
// passcode created or already has one to verify against.
function enterTeamStep() {
    lockTeamStep.classList.remove('lock-hidden');
    lockPwStep.classList.add('lock-hidden');
    pendingSide = null;
    setCloudNote(cloudNoteTeam, true);
}

async function chooseSide(side) {
    pendingSide = side;
    lockPwStep.classList.remove('lock-hidden');
    lockTeamStep.classList.add('lock-hidden');

    const badgeCls = side === 'p1' ? 'b-p1' : 'b-p2';
    lockBadge.textContent = SIDE_NAME[side];
    lockBadge.className = 'lock-badge ' + badgeCls;
    lockPwTitle.textContent = SIDE_NAME[side] + ' PASSCODE';
    lockPwTitle.className = 'lock-title ' + badgeCls;

    lockInput.value = '';
    lockConfirm.value = '';
    lockConfirm.classList.remove('show');
    lockError.classList.remove('show');
    setCloudNote(cloudNotePw, true);

    // While the cloud read settles, lock the submit button so the step can't
    // be submitted into the wrong mode.
    pwMode = null;
    lockSubmit.disabled = true;
    lockSubmit.textContent = 'LOADING…';

    // Decide create vs verify from what's already stored.
    let data;
    try { data = await store.load(); }
    catch (e) {
        data = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        setCloudNote(cloudNotePw, false);
    }
    const storedHash = side === 'p1' ? (data.p1Hash || null) : (data.p2Hash || null);

    if (storedHash) {
        pwMode = 'verify';
        lockPwSub.textContent = 'Unlock ' + sideLabel(side).toLowerCase() + '. Enter this side\u2019s passcode.';
        lockSubmit.textContent = 'UNLOCK';
    } else {
        pwMode = 'create';
        lockPwSub.textContent = 'Set the passcode for ' + sideLabel(side).toLowerCase() + '. This is a one-time setup \u2014 it cannot be changed later.';
        lockConfirm.classList.add('show');
        lockSubmit.textContent = 'SET PASSCODE';
    }
    lockSubmit.disabled = false;
    lockInput.focus();
}

// STEP 2 — submit the passcode (create once, verify forever after).
async function submitPasscode() {
    if (!pwMode) return; // still loading from the cloud — button is disabled meanwhile
    const value = lockInput.value.trim();
    const minLen = 4;

    if (pwMode === 'create') {
        const confirm = lockConfirm.value.trim();
        if (value.length < minLen) { lockFail('Use at least ' + minLen + ' characters.'); return; }
        if (value !== confirm) { lockFail('Passcodes do not match.'); return; }
        const hash = await sha256(value + '::' + pendingSide);
        // Persist ONLY this side's hash — never the wins, so creating a
        // passcode can never zero out a player's saved win count.
        await safeSaveHash(pendingSide, hash);
        unlock(pendingSide);
    } else {
        const hash = await sha256(value + '::' + pendingSide);
        const data = await safeLoad();
        const stored = pendingSide === 'p1' ? data.p1Hash : data.p2Hash;
        if (stored && hash === stored) unlock(pendingSide);
        else lockFail('Wrong passcode. Try again.');
    }
}

function lockFail(msg) {
    lockError.textContent = msg;
    lockError.classList.add('show');
    restart(lock, 'shake');
}

function unlock(side) {
    activeSide = side;
    lock.style.display = 'none';
    sideChip.textContent = sideLabel(side);
    sideChip.className = 'side-chip ' + side;
    // Only the logged-in side's counter is editable; the other stays locked.
    counter1.readOnly = side !== 'p1';
    counter2.readOnly = side !== 'p2';
    (side === 'p1' ? counter1 : counter2).focus();
}

function relock() {
    activeSide = null;
    sideChip.textContent = 'NO SIDE';
    sideChip.className = 'side-chip';
    counter1.readOnly = true;
    counter2.readOnly = true;
    lockError.classList.remove('show');
    lock.style.display = 'flex';
    enterTeamStep();
}

// Safe wrappers that fall back to local if the cloud is unreachable.
async function safeLoad() {
    try { return await store.load(); }
    catch (e) {
        const raw = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        return { v1: raw.p1 || 0, v2: raw.p2 || 0, p1Hash: raw.p1Hash || null, p2Hash: raw.p2Hash || null };
    }
}
// Persist the win counts only (hashes untouched). `fields` may carry either or both sides.
async function safeSaveWins(fields) {
    try { await store.saveWins(fields); }
    catch (e) {
        const raw = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        if (fields.p1 != null) raw.p1 = fields.p1;
        if (fields.p2 != null) raw.p2 = fields.p2;
        localStorage.setItem('rl1000', JSON.stringify(raw));
    }
}

// Persist ONLY one side's passcode hash (wins untouched).
async function safeSaveHash(side, hash) {
    try { await store.saveHash(side, hash); }
    catch (e) {
        const raw = JSON.parse(localStorage.getItem('rl1000') || 'null') || {};
        if (side === 'p1') raw.p1Hash = hash; else raw.p2Hash = hash;
        localStorage.setItem('rl1000', JSON.stringify(raw));
    }
}

// Wire the gate.
pickP1.addEventListener('click', () => chooseSide('p1'));
pickP2.addEventListener('click', () => chooseSide('p2'));
lockBack.addEventListener('click', enterTeamStep);
switchBtn.addEventListener('click', relock);
lockSubmit.addEventListener('click', submitPasscode);
[lockInput, lockConfirm].forEach(el => el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPasscode();
}));

// ============ CORRECT ROCKET LEAGUE RANK LADDER ============
// 3 divisions per rank (1/2/3): Bronze -> Silver -> Gold -> Platinum ->
// Diamond -> Champion -> Grand Champion -> Supersonic Legend (SSL).
// SSL is the top rank (no divisions). It sits at 950, i.e. 50 wins from
// the 1000 win goal. Ranks compress toward the top, like real RL MMR.
//
// tier = escalation level for effects (0 lowest .. 7 SSL). Higher tier
// rank-ups shake harder, throw more sparks, and fire bigger confetti.
const RANKS = [
    { name: 'BRONZE 1', min: 0, color: '#cd7f32', tier: 0, icon: 'image_ranks/Bronze1_rank_icon.webp' },
    { name: 'BRONZE 2', min: 50, color: '#cd7f32', tier: 0, icon: 'image_ranks/Bronze2_rank_icon_.webp' },
    { name: 'BRONZE 3', min: 100, color: '#cd7f32', tier: 0, icon: 'image_ranks/Bronze3_rank_icon.webp' },
    { name: 'SILVER 1', min: 150, color: '#c0c0c0', tier: 1, icon: 'image_ranks/Silver1_rank_icon.webp' },
    { name: 'SILVER 2', min: 200, color: '#c0c0c0', tier: 1, icon: 'image_ranks/Silver2_rank_icon.webp' },
    { name: 'SILVER 3', min: 250, color: '#c0c0c0', tier: 1, icon: 'image_ranks/Silver3_rank_icon.webp' },
    { name: 'GOLD 1', min: 300, color: '#ffd700', tier: 2, icon: 'image_ranks/Gold1_rank_icon.webp' },
    { name: 'GOLD 2', min: 350, color: '#ffd700', tier: 2, icon: 'image_ranks/Gold2_rank_icon.webp' },
    { name: 'GOLD 3', min: 400, color: '#ffd700', tier: 2, icon: 'image_ranks/Gold3_rank_icon.webp' },
    { name: 'PLATINUM 1', min: 450, color: '#4fd6c0', tier: 3, icon: 'image_ranks/Platinum1_rank_icon.webp' },
    { name: 'PLATINUM 2', min: 500, color: '#4fd6c0', tier: 3, icon: 'image_ranks/Platinum2_rank_icon.webp' },
    { name: 'PLATINUM 3', min: 550, color: '#4fd6c0', tier: 3, icon: 'image_ranks/Platinum3_rank_icon.webp' },
    { name: 'DIAMOND 1', min: 600, color: '#00b4ff', tier: 4, icon: 'image_ranks/Diamond1_rank_icon.webp' },
    { name: 'DIAMOND 2', min: 650, color: '#00b4ff', tier: 4, icon: 'image_ranks/Diamond2_rank_icon.webp' },
    { name: 'DIAMOND 3', min: 700, color: '#00b4ff', tier: 4, icon: 'image_ranks/Diamond3_rank_icon.webp' },
    { name: 'CHAMPION 1', min: 750, color: '#b45fff', tier: 5, icon: 'image_ranks/Champion1_rank_icon.webp' },
    { name: 'CHAMPION 2', min: 800, color: '#b45fff', tier: 5, icon: 'image_ranks/Champion2_rank_icon.webp' },
    { name: 'CHAMPION 3', min: 850, color: '#b45fff', tier: 5, icon: 'image_ranks/Champion3_rank_icon.webp' },
    { name: 'GRAND CHAMPION 1', min: 880, color: '#ff5a00', tier: 6, icon: 'image_ranks/Grand_champion1_rank_icon.webp' },
    { name: 'GRAND CHAMPION 2', min: 910, color: '#ff5a00', tier: 6, icon: 'image_ranks/Grand_champion2_rank_icon.webp' },
    { name: 'GRAND CHAMPION 3', min: 940, color: '#ff5a00', tier: 6, icon: 'image_ranks/Grand_champion3_rank_icon.webp' },
    { name: 'SUPERSONIC LEGEND', min: 950, color: '#ffffff', tier: 7, icon: 'image_ranks/Supersonic_Legend_rank_icon.webp' }
];

// previous values for rank-change detection
let prev1 = 0;
let prev2 = 0;

// winning streaks (consecutive adds won by each player without the other gaining)
let streakP1 = 0;
let streakP2 = 0;

function rankFor(v) {
    let r = RANKS[0];
    for (const rank of RANKS) if (v >= rank.min) r = rank;
    return r;
}

// card silhouette per rank family
function shapeFor(v) {
    const name = rankFor(v).name.toUpperCase();
    if (name.includes('SUPERSONIC')) return 'ssl';
    if (name.includes('GRAND')) return 'grand';
    if (name.includes('CHAMPION')) return 'champion';
    if (name.includes('DIAMOND')) return 'diamond';
    if (name.includes('PLATINUM')) return 'platinum';
    if (name.includes('GOLD')) return 'gold';
    if (name.includes('SILVER')) return 'silver';
    return 'bronze';
}

// count-up animation for a number text element
function countUp(el, to, prefix, suffix, ms = 500) {
    const from = parseInt((el.dataset.cur || '0').replace(/[^0-9]/g, '')) || 0;
    el.dataset.cur = to;
    const start = performance.now();
    function frame(now) {
        const t = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = Math.round(from + (to - from) * eased);
        el.textContent = prefix + val + suffix;
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function setPlayer(circle, pct, sub, toGo, tier, card, value, animateNum, crest, mark) {
    const v = Math.max(0, Math.min(parseInt(value) || 0, TARGET));
    const offset = CIRCUMFERENCE - (v / TARGET) * CIRCUMFERENCE;
    circle.style.strokeDashoffset = offset;
    pct.textContent = Math.round((v / TARGET) * 100) + '%';

    if (animateNum) countUp(sub, v, '', ' / ' + TARGET, 500);
    else sub.textContent = v + ' / ' + TARGET;

    const remain = TARGET - v;
    toGo.textContent = remain <= 0 ? 'WINNER' : remain + ' to go';
    toGo.style.color = remain <= 0 ? '#ffd700' : '';

    // Recolor the entire card (border, glow, badge, tag, streak) by rank,
    // and swap the card silhouette + rank crest/watermark to match the rank.
    const t = rankFor(v);
    card.style.setProperty('--rank-color', t.color);
    card.style.setProperty('--rank-glow', t.color + '66');
    card.dataset.rank = shapeFor(v);
    if (crest) crest.src = t.icon;
    if (mark) mark.src = t.icon;
    tier.querySelector('.rank-label').textContent = t.name;
    return v;
}

function updateEnergy(v1, v2) {
    const total = v1 + v2;
    const share = total === 0 ? 50 : (v1 / total) * 100;
    energyFill.style.width = share + '%';
    energyThumb.style.left = share + '%';
}

function updateStreaks() {
    const v1 = parseInt(counter1.value) || 0;
    const v2 = parseInt(counter2.value) || 0;
    // streak = how far ahead a player is leading the match
    streakP1 = v1 > v2 ? v1 - v2 : 0;
    streakP2 = v2 > v1 ? v2 - v1 : 0;
    const c1 = streak1.querySelector('.streak-count');
    const c2 = streak2.querySelector('.streak-count');
    c1.textContent = streakP1;
    c2.textContent = streakP2;
    streak1.classList.toggle('hot', streakP1 >= 2);
    streak2.classList.toggle('hot', streakP2 >= 2);
}

// ============ ANIMATIONS ============
function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}

function showMatchWon() {
    restart(matchToast, 'show');
    restart(plusOne, 'pop');
    restart(screenFlash, 'show');
}

function celebrate(card) {
    restart(card, 'celebrate');
    const badge = card.querySelector('.tier-badge');
    restart(badge, 'rankup-pop');
    const crest = card.querySelector('.ball-rank');
    if (crest) restart(crest, 'rank-swap');
}

function showRankUp(rankName, color, tier, icon, playerTag, card) {
    // tier 0..7 drives how "insane" the moment gets — harder ranks = more chaos
    rankUp.style.setProperty('--gold', color);
    rankUp.style.setProperty('--glow', color + '88');
    rankUpName.textContent = rankName;
    rankUpIcon.src = icon;
    rankUpPlayer.textContent = playerTag;
    rankUpPlayer.style.color = color;
    celebrate(card);
    restart(screenFlash, 'show');

    // shake intensity scales with rank tier (via CSS var on the container)
    const shakeMag = 4 + tier * 3; // bronze 4px -> ssl 25px
    container.style.setProperty('--shake-mag', shakeMag + 'px');
    restart(container, 'shake');

    // spark burst from the card — more sparks at higher tiers
    const rect = card.getBoundingClientRect();
    const sparkCount = 25 + tier * 18; // bronze ~25 -> ssl ~150
    burstSparksAt(rect.left + rect.width / 2, rect.top + rect.height / 2, sparkCount, color);

    // small rank-ups at the top of the ladder also throw confetti for drama
    if (tier >= 4) fireConfetti(40 + tier * 25, color);

    restart(rankUp, 'show');
}

function screenShake() {
    restart(container, 'shake');
    restart(container, 'win-flash');
}

function fireConfetti(count = 180, extraColor) {
    const colors = ['#ff5a00', '#00b4ff', '#ffd700', '#c0c0c0', '#4fd6c0', '#b45fff', '#ffffff'];
    if (extraColor) colors.unshift(extraColor); // lead with the new rank's color
    confetti.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const c = document.createElement('span');
        c.className = 'confetti-piece';
        const color = colors[i % colors.length];
        c.style.left = Math.random() * 100 + 'vw';
        c.style.background = color;
        c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        c.style.width = (Math.random() * 8 + 6) + 'px';
        c.style.height = (Math.random() * 8 + 6) + 'px';
        c.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
        c.style.animationDelay = Math.random() * 1.5 + 's';
        confetti.appendChild(c);
    }
    setTimeout(() => { confetti.innerHTML = ''; }, 5000);
}

function showWin(playerTag, v) {
    congratsText.textContent = playerTag + ' hit ' + v + ' wins and is a Supersonic Legend!';
    congrats.classList.add('show');
    screenShake();
    fireConfetti(240, '#ffffff');
    burstSparks(80);
}

function dismissWin() {
    congrats.classList.remove('show');
}

function resetMatch() {
    counter1.value = 0;
    counter2.value = 0;
    prev1 = 0;
    prev2 = 0;
    streakP1 = 0;
    streakP2 = 0;
    updateAll(false);
    updateStreaks();
    matchToast.style.opacity = 0;
    confetti.innerHTML = '';
    congrats.classList.remove('show');
    screenFlash.classList.remove('show');
    persistWins(); // keep the stored record in sync with the reset
}

congrats.addEventListener('click', dismissWin);

// run-it-back after a win — ONLY when not typing in a field and the lock is
// closed. (A bare global keydown here was hijacking the '1' you type in your
// passcode / win counter and zeroing the match mid-login.)
document.addEventListener('keydown', (e) => {
    if (e.key !== '1') return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return; // typing
    if (lock.style.display !== 'none') return; // login gate is open
    resetMatch();
});

// ============ UPDATE LOGIC ============
function updateAll(animateNum) {
    const v1 = setPlayer(circle1, pct1, sub1, toGo1, tier1, card1, counter1.value, animateNum, crest1, null);
    const v2 = setPlayer(circle2, pct2, sub2, toGo2, tier2, card2, counter2.value, animateNum, crest2, null);
    updateEnergy(v1, v2);
    return { v1, v2 };
}

function checkRankUp(prev, cur, tag, card) {
    const oldRank = rankFor(prev);
    const newRank = rankFor(cur);
    if (newRank.name !== oldRank.name && cur > prev) {
        showRankUp(newRank.name, newRank.color, newRank.tier, newRank.icon, tag, card);
    }
}

// "+ Add" records a win for the side you are logged in as (the gate enforces
// that only the active side's counter is editable).
async function handleAdd() {
    if (!activeSide) return; // locked out until unlocked
    const tag = SIDE_NAME[activeSide];
    const input = activeSide === 'p1' ? counter1 : counter2;
    const card = activeSide === 'p1' ? card1 : card2;
    const prev = activeSide === 'p1' ? prev1 : prev2;
    const v = Math.min((parseInt(input.value) || 0) + 1, TARGET);
    input.value = v;
    updateAll(true);

    restart(addBtn, 'pressed');
    showMatchWon();
    updateStreaks();
    checkRankUp(prev, v, tag, card);
    if (tag === SIDE_NAME.p1) prev1 = v; else prev2 = v;
    if (v === TARGET) showWin(tag, v);

    // Write only THIS side's win (hashes and the other side are untouched).
    if (tag === SIDE_NAME.p1) await safeSaveWins({ p1: v });
    else await safeSaveWins({ p2: v });
}

// Live UI update on keystroke (no save — saves happen on 'change'/blur).
function onInput(input, circle, pct, sub, toGo, tier, card, tag, prev) {
    const v = Math.max(0, Math.min(parseInt(input.value) || 0, TARGET));
    const crest = card.querySelector('.ball-rank');
    setPlayer(circle, pct, sub, toGo, tier, card, input.value, true, crest, null);
    updateEnergy(parseInt(counter1.value) || 0, parseInt(counter2.value) || 0);
    updateStreaks();
    checkRankUp(prev, v, tag, card);
    if (v === TARGET) showWin(tag, v);
    return v;
}

// Persist the current on-screen win counts (hashes and other side untouched
// unless both are present on screen).
async function persistWins() {
    const fields = {
        p1: Math.max(0, Math.min(parseInt(counter1.value) || 0, TARGET)),
        p2: Math.max(0, Math.min(parseInt(counter2.value) || 0, TARGET)),
    };
    // When logged in as one side, only commit that side's number so the other
    // side's saved value is never clobbered by an unreviewed counter.
    if (activeSide === 'p1') await safeSaveWins({ p1: fields.p1 });
    else if (activeSide === 'p2') await safeSaveWins({ p2: fields.p2 });
    else await safeSaveWins(fields);
}

// Debounced auto-save: any win change (typing a number, any edit) hits the DB
// within a short pause, not just on blur/Enter. One shared timer so rapid
// keystrokes collapse into a single write.
let saveTimer = null;
function scheduleSave() {
    if (!activeSide) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistWins(), 600);
}

addBtn.addEventListener('click', handleAdd);
counter1.addEventListener('input', () => {
    prev1 = onInput(counter1, circle1, pct1, sub1, toGo1, tier1, card1, SIDE_NAME.p1, prev1);
    scheduleSave();
});
counter2.addEventListener('input', () => {
    prev2 = onInput(counter2, circle2, pct2, sub2, toGo2, tier2, card2, SIDE_NAME.p2, prev2);
    scheduleSave();
});
// also save immediately when the user leaves a field / presses Enter
[counter1, counter2].forEach((el, i) => {
    el.addEventListener('change', () => { if (activeSide) persistWins(); });
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && activeSide) persistWins();
    });
});

// ============ BOOT: load saved state, lock, gate behind login ============
(async function boot() {
    const data = await safeLoad();
    counter1.value = data.v1;
    counter2.value = data.v2;
    prev1 = data.v1;
    prev2 = data.v2;
    updateAll(false);
    updateStreaks();
    counter1.readOnly = true;
    counter2.readOnly = true;
    enterTeamStep(); // show the immovable login gate
})();

// ============ REAL-TIME CLOUD SYNC ============
// onSnapshot fires on every remote change to matches/1 — if the other person
// adds a win, this client updates within ~1s (or instantly over the wire).
// It never overwrites a counter the user is actively editing.
let lastRemoteV1 = null, lastRemoteV2 = null;
if (CLOUD.configured) {
    initFirebase().then(() => {
        CLOUD.doc.onSnapshot(snap => {
            if (!snap.exists) return;
            const d = snap.data();
            const rv1 = d.p1_wins || 0, rv2 = d.p2_wins || 0;
            const c1val = parseInt(counter1.value) || 0;
            const c2val = parseInt(counter2.value) || 0;

            // Skip if nothing changed since last sync
            if (rv1 === lastRemoteV1 && rv2 === lastRemoteV2) return;
            lastRemoteV1 = rv1; lastRemoteV2 = rv2;

            // Don't clobber a counter the user is actively editing
            if (document.activeElement !== counter1) {
                if (rv1 !== c1val) {
                    counter1.value = rv1;
                    prev1 = rv1;
                    onInput(counter1, circle1, pct1, sub1, toGo1, tier1, card1, SIDE_NAME.p1, rv1);
                }
            }
            if (document.activeElement !== counter2) {
                if (rv2 !== c2val) {
                    counter2.value = rv2;
                    prev2 = rv2;
                    onInput(counter2, circle2, pct2, sub2, toGo2, tier2, card2, SIDE_NAME.p2, rv2);
                }
            }
            updateEnergy(rv1, rv2);
            updateStreaks();
        }, err => {
            console.warn('[FIRESTORE] onSnapshot error:', err);
        });
    });
}

// ============ MATCH TIMER ============
const matchStart = Date.now();
setInterval(() => {
    const s = Math.floor((Date.now() - matchStart) / 1000);
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    timerEl.textContent = m + ':' + sec;
}, 1000);

// ============ FLOATING PARTICLES ============
const particlesEl = document.getElementById('particles');
const COLORS = ['#ff5a00', '#ffaa00', '#00b4ff', '#ffffff'];
for (let i = 0; i < 45; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = color;
    p.style.boxShadow = '0 0 ' + size * 2 + 'px ' + color;
    p.style.animationDuration = Math.random() * 10 + 8 + 's';
    p.style.animationDelay = -Math.random() * 18 + 's';
    particlesEl.appendChild(p);
}

// ============ MOUSE-TRAIL SPARKS + BURSTS (canvas) ============
const fxCanvas = document.getElementById('fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
let sparks = [];

function sizeCanvas() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

function spawnSpark(x, y, color, big) {
    sparks.push({
        x, y,
        vx: (Math.random() - 0.5) * (big ? 8 : 3),
        vy: -Math.random() * (big ? 7 : 3) - (big ? 1 : 0.5),
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        color,
        size: Math.random() * 3 + (big ? 2 : 1)
    });
}

// gentle mouse trail
let lastMove = 0;
window.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - lastMove < 40) return;
    lastMove = now;
    const color = Math.random() > 0.5 ? '#00b4ff' : '#ff5a00';
    spawnSpark(e.clientX, e.clientY, color, false);
});

function burstSparks(n) {
    burstSparksAt(window.innerWidth / 2, window.innerHeight / 2, n);
}

// burst at a specific point on screen (used for rank-ups from the card)
function burstSparksAt(cx, cy, n, leadColor) {
    const cols = leadColor ? [leadColor, '#ff5a00', '#00b4ff', '#ffffff'] : ['#ff5a00', '#00b4ff', '#ffd700', '#ffffff'];
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 8 + 2;
        sparks.push({
            x: cx, y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 2,
            life: 1,
            decay: 0.008 + Math.random() * 0.02,
            color: cols[i % cols.length],
            size: Math.random() * 4 + 2
        });
    }
}

(function animateSparks() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fxCtx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.15; // gravity
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        fxCtx.globalAlpha = s.life;
        fxCtx.fillStyle = s.color;
        fxCtx.beginPath();
        fxCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        fxCtx.fill();
    }
    fxCtx.globalAlpha = 1;
    fxCtx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(animateSparks);
})();

// ============ BACKGROUND VIDEO TOGGLE ============
const bgWrap = document.getElementById('bgVideoWrap');
const bgToggle = document.getElementById('bgToggle');
let bgOn = true;
bgToggle.textContent = 'BG ON';

bgToggle.addEventListener('click', () => {
    bgOn = !bgOn;
    const video = document.getElementById('bgVideo');
    if (bgOn) {
        bgWrap.style.display = 'block';
        video.play();
    } else {
        bgWrap.style.display = 'none';
        video.pause();
    }
    bgToggle.textContent = bgOn ? 'BG ON' : 'BG OFF';
    bgToggle.classList.toggle('off', !bgOn);
});
