"use strict";

const STORAGE_KEY = "mahjong_history_v1";

let members = [];
let settings = {};

let game = {
  date: "", hanchanNo: 1, seats: [], scores: {},
  round: { wind: "東", num: 1 }, actions: {},
  kyotaku: 0, rotation: 0,
  log: [], snapshots: []
};

const DEFAULT_MEMBERS = [
  { id: 1, name: "坂井" }, { id: 2, name: "高木" },
  { id: 3, name: "中江" }, { id: 4, name: "福原" }
];
const DEFAULT_SETTINGS = { initialScore: 25000, returnScore: 30000, umaTop: 20, umaSecond: 10 };

async function init() {
  try {
    const res = await fetch("members.json");
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    members = data.members || DEFAULT_MEMBERS;
    settings = data.settings || DEFAULT_SETTINGS;
  } catch (e) {
    members = DEFAULT_MEMBERS;
    settings = DEFAULT_SETTINGS;
  }
  if (!Array.isArray(members) || members.length < 4) members = DEFAULT_MEMBERS;

  game.date = new Date().toISOString().slice(0, 10);
  bindGlobalEvents();
  buildSetupScreen();
  showScreen("setup");
}

function showScreen(name) {
  ["setup", "record", "result", "history"].forEach(s => {
    const el = document.getElementById("screen-" + s);
    if (el) el.hidden = (s !== name);
  });
}

function bindGlobalEvents() {
  document.getElementById("startBtn").addEventListener("click", onStartGame);
  document.getElementById("historyBtn").addEventListener("click", openHistory);
  document.getElementById("backFromHistoryBtn").addEventListener("click", () => showScreen("setup"));
  document.getElementById("copyHistoryBtn").addEventListener("click", copyAllHistory);
  document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);

  document.getElementById("calcBtn").addEventListener("click", onCalc);
  document.getElementById("ryukyokuBtn").addEventListener("click", onRyukyoku);
  document.getElementById("abortBtn").addEventListener("click", onAbort);
  document.getElementById("endGameBtn").addEventListener("click", onEndGame);
  document.getElementById("nextRoundBtn").addEventListener("click", onNextRound);
  document.getElementById("prevRoundBtn").addEventListener("click", onPrevRound);
  document.getElementById("roundWind").addEventListener("change", onRoundChange);
  document.getElementById("roundNum").addEventListener("change", onRoundChange);
  document.getElementById("nextHanchanBtn").addEventListener("click", onNextHanchan);
  document.getElementById("rotateBtn").addEventListener("click", onRotate);
}

function buildSetupScreen() {
  document.getElementById("gameDate").value = game.date;
  document.getElementById("hanchanNo").value = game.hanchanNo;
  const winds = ["東", "南", "西", "北"];
  const wrap = document.getElementById("seatSetup");
  wrap.innerHTML = "";
  winds.forEach((w, i) => {
    const options = members.map(m =>
      `<option value="${m.id}" ${m.id === members[i].id ? "selected" : ""}>${m.name}</option>`
    ).join("");
    wrap.insertAdjacentHTML("beforeend", `
      <div class="seat-pick">
        <div class="wind">${w}</div>
        <select class="seat-select" data-seat="${i}">${options}</select>
      </div>
    `);
  });
}

function onStartGame() {
  game.date = document.getElementById("gameDate").value;
  game.hanchanNo = Number(document.getElementById("hanchanNo").value) || 1;
  const selects = document.querySelectorAll(".seat-select");
  const chosen = Array.from(selects).map(s => Number(s.value));
  if (new Set(chosen).size !== chosen.length) {
    alert("同じメンバーが重複しています。東南西北それぞれ別の人を選んでください。");
    return;
  }
  game.seats = chosen.map(id => members.find(m => m.id === id));
  game.scores = {};
  game.seats.forEach(m => { game.scores[m.id] = settings.initialScore; });
  game.round = { wind: "東", num: 1 };
  game.kyotaku = 0; game.rotation = 0;
  game.log = []; game.snapshots = [];
  buildRecordScreen();
  showScreen("record");
}

function buildRecordScreen() {
  document.getElementById("roundWind").value = game.round.wind;
  document.getElementById("roundNum").value = game.round.num;
  document.getElementById("honba").value = 0;
  resetActions();
  buildPlayerRows();
  renderScores();
  updatePrevButton();
}

function resetActions() {
  game.actions = {};
  game.seats.forEach(m => {
    game.actions[m.id] = {
      action: "none", actionJunme: "",
      agari: "none", agariJunme: "",
      point: "", pointKo: "", pointOya: ""
    };
  });
}

function currentOyaSeatIndex() { return ((game.round.num - 1) % 4); }
function getOyaId() { return game.seats[currentOyaSeatIndex()].id; }
function getHonba() { return Number(document.getElementById("honba").value) || 0; }
function seatIndexOf(id) { return game.seats.findIndex(m => m.id === id); }

function buildPlayerRows() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  const oyaIdx = currentOyaSeatIndex();

  game.seats.forEach((m, i) => {
    const isOya = (i === oyaIdx);
    const a = game.actions[m.id];
    const ronOptions = game.seats
      .filter(o => o.id !== m.id)
      .map(o => `<option value="${o.id}" ${String(o.id) === a.agari ? "selected" : ""}>${o.name}</option>`)
      .join("");

    const card = document.createElement("div");
    card.className = "player-card";
    card.dataset.id = m.id;
    card.innerHTML = `
      <div class="pc-row1">
        <div class="oya-mark ${isOya ? "is-oya" : ""}">${isOya ? "親" : "子"}</div>
        <div class="pc-name">${m.name}</div>
        <div class="seg" data-role="action">
          <button type="button" data-val="none" class="${a.action === "none" ? "active" : ""}">未</button>
          <button type="button" data-val="fuuro" class="${a.action === "fuuro" ? "active" : ""}">副露</button>
          <button type="button" data-val="riichi" class="${a.action === "riichi" ? "active" : ""}">立直</button>
        </div>
        <input type="number" class="pc-input junme in-action-junme" placeholder="巡目" min="1" value="${a.actionJunme}">
      </div>
      <div class="pc-row2">
        <span class="pc-label">和了</span>
        <select class="pc-input agari in-agari">
          <option value="none" ${a.agari === "none" ? "selected" : ""}>なし</option>
          <option value="tenpai" ${a.agari === "tenpai" ? "selected" : ""}>聴牌</option>
          <option value="tsumo" ${a.agari === "tsumo" ? "selected" : ""}>ツモ</option>
          ${ronOptions}
        </select>
        <input type="number" class="pc-input junme in-agari-junme" placeholder="巡目" min="1" value="${a.agariJunme}">
      </div>
      <div class="pc-row2 point-row"></div>
    `;
    list.appendChild(card);

    card.querySelectorAll('.seg[data-role="action"] button').forEach(btn => {
      btn.addEventListener("click", () => {
        card.querySelectorAll('.seg[data-role="action"] button').forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        syncActionFromCard(card, m.id);
        updateJunmeEnabled(card, m.id);
        renderPointInputs(card, m.id, isOya);
      });
    });
    card.querySelector(".in-agari").addEventListener("change", () => {
      syncActionFromCard(card, m.id);
      updateJunmeEnabled(card, m.id);
      renderPointInputs(card, m.id, isOya);
    });
    card.querySelectorAll(".in-action-junme, .in-agari-junme").forEach(el => {
      el.addEventListener("change", () => syncActionFromCard(card, m.id));
    });

    updateJunmeEnabled(card, m.id);
    renderPointInputs(card, m.id, isOya);
  });
}

// 巡目欄の有効/無効を制御
function updateJunmeEnabled(card, id) {
  const a = game.actions[id];
  // アクション巡目：副露 or 立直のとき有効
  const actEnabled = (a.action === "fuuro" || a.action === "riichi");
  const actJunme = card.querySelector(".in-action-junme");
  actJunme.disabled = !actEnabled;
  if (!actEnabled) { actJunme.value = ""; a.actionJunme = ""; }

  // 和了巡目：あがり（ツモ or ロン）のとき有効
  const isWin = (a.agari === "tsumo" || /^\d+$/.test(a.agari));
  const agJunme = card.querySelector(".in-agari-junme");
  agJunme.disabled = !isWin;
  if (!isWin) { agJunme.value = ""; a.agariJunme = ""; }
}

function renderPointInputs(card, id, isOya) {
  const a = game.actions[id];
  const row = card.querySelector(".point-row");
  const ag = a.agari;

  if (ag === "tsumo") {
    if (isOya) {
      row.innerHTML = `
        <span class="pc-sublabel">all</span>
        <input type="number" class="pc-input point in-point" placeholder="各子の支払い" step="100" value="${a.point}">
      `;
    } else {
      row.innerHTML = `
        <span class="pc-sublabel">子</span>
        <input type="number" class="pc-input point in-point-ko" placeholder="子の支払い" step="100" value="${a.pointKo}">
        <span class="pc-sublabel">親</span>
        <input type="number" class="pc-input point in-point-oya" placeholder="親の支払い" step="100" value="${a.pointOya}">
      `;
    }
  } else if (/^\d+$/.test(ag)) {
    row.innerHTML = `
      <span class="pc-sublabel">点数</span>
      <input type="number" class="pc-input point in-point" placeholder="放銃額" step="100" value="${a.point}">
    `;
  } else {
    row.innerHTML = "";
  }

  row.querySelectorAll("input").forEach(el => {
    el.addEventListener("change", () => syncActionFromCard(card, id));
  });
}

function syncActionFromCard(card, id) {
  const a = game.actions[id];
  const activeBtn = card.querySelector('.seg[data-role="action"] button.active');
  a.action      = activeBtn ? activeBtn.dataset.val : "none";
  const actJ = card.querySelector(".in-action-junme");
  a.actionJunme = actJ.disabled ? "" : actJ.value;
  a.agari       = card.querySelector(".in-agari").value;
  const agJ = card.querySelector(".in-agari-junme");
  a.agariJunme  = agJ.disabled ? "" : agJ.value;

  const pEl = card.querySelector(".in-point");
  const koEl = card.querySelector(".in-point-ko");
  const oyaEl = card.querySelector(".in-point-oya");
  if (pEl) a.point = pEl.value;
  if (koEl) a.pointKo = koEl.value;
  if (oyaEl) a.pointOya = oyaEl.value;

  const winning = (a.agari === "tsumo" || /^\d+$/.test(a.agari));
  card.classList.toggle("has-agari", winning);
}

const SEAT_DOM_IDS = ["seatBottom", "seatRight", "seatTop", "seatLeft"];

function renderScores() {
  SEAT_DOM_IDS.forEach((domId, pos) => {
    const seatIdx = (pos + game.rotation) % 4;
    const m = game.seats[seatIdx];
    const seat = document.getElementById(domId);
    seat.innerHTML = `
      <div class="seat-name">${m.name}</div>
      <div class="seat-score">${game.scores[m.id].toLocaleString()}</div>
    `;
  });
  const total = Object.values(game.scores).reduce((a, b) => a + b, 0) + game.kyotaku;
  document.getElementById("tableCenter").innerHTML = `合計<br>${total.toLocaleString()}`;
  document.getElementById("kyotakuView").textContent = game.kyotaku.toLocaleString();
}

function onRotate() {
  game.rotation = (game.rotation + 1) % 4;
  renderScores();
}

function pushSnapshot() {
  game.snapshots.push({
    scores: JSON.parse(JSON.stringify(game.scores)),
    round: JSON.parse(JSON.stringify(game.round)),
    honba: getHonba(),
    kyotaku: game.kyotaku,
    logLen: game.log.length
  });
}

function onPrevRound() {
  if (game.snapshots.length === 0) return;
  if (!confirm("前の局に戻ります。直近の記録を取り消して入力し直せます。よろしいですか？")) return;
  const snap = game.snapshots.pop();
  game.scores = snap.scores;
  game.round = snap.round;
  game.kyotaku = snap.kyotaku;

  const prevEntry = game.log[snap.logLen];
  game.log = game.log.slice(0, snap.logLen);

  document.getElementById("roundWind").value = game.round.wind;
  document.getElementById("roundNum").value = game.round.num;
  document.getElementById("honba").value = snap.honba;

  restoreActions(prevEntry);
  buildPlayerRows();
  renderScores();
  updatePrevButton();
}

function restoreActions(entry) {
  resetActions();
  if (!entry) return;
  entry.players.forEach(p => {
    if (!game.actions[p.id]) return;
    game.actions[p.id] = {
      action: p.action, actionJunme: p.actionJunme,
      agari: p.agari, agariJunme: p.agariJunme,
      point: p.point || "", pointKo: p.pointKo || "", pointOya: p.pointOya || ""
    };
  });
}

function updatePrevButton() {
  document.getElementById("prevRoundBtn").disabled = (game.snapshots.length === 0);
}

function recordLog() {
  const entry = {
    wind: game.round.wind, num: game.round.num, honba: getHonba(),
    players: game.seats.map(m => {
      const a = game.actions[m.id];
      return {
        name: m.name, id: m.id,
        action: a.action, actionJunme: a.actionJunme,
        agari: a.agari, agariJunme: a.agariJunme,
        point: a.point, pointKo: a.pointKo, pointOya: a.pointOya
      };
    })
  };
  game.log.push(entry);
}

function distributePoints({ kind, winnerId, loserId, isOya, point, pointKo, pointOya, oyaId }) {
  const delta = {};
  game.seats.forEach(m => { delta[m.id] = 0; });

  if (kind === "ron") {
    if (!point) return { ok: false, msg: "放銃額が入力されていません。" };
    delta[winnerId] += point;
    delta[loserId]  -= point;
    return { ok: true, delta };
  }

  if (kind === "tsumo" && isOya) {
    if (!point) return { ok: false, msg: "親ツモの支払額(all)が入力されていません。" };
    let gained = 0;
    game.seats.forEach(m => {
      if (m.id === winnerId) return;
      delta[m.id] -= point; gained += point;
    });
    delta[winnerId] += gained;
    return { ok: true, delta };
  }

  if (kind === "tsumo" && !isOya) {
    if (!pointKo || !pointOya) return { ok: false, msg: "子ツモの子払い・親払いが入力されていません。" };
    let gained = 0;
    game.seats.forEach(m => {
      if (m.id === winnerId) return;
      const pay = (m.id === oyaId) ? pointOya : pointKo;
      delta[m.id] -= pay; gained += pay;
    });
    delta[winnerId] += gained;
    return { ok: true, delta };
  }

  return { ok: false, msg: "不明な和了種別です。" };
}

function headBumpWinner(winners, loserId) {
  const li = seatIndexOf(loserId);
  for (let step = 1; step <= 3; step++) {
    const idx = (li + step) % 4;
    const cand = game.seats[idx];
    if (winners.some(w => w.id === cand.id)) return cand;
  }
  return winners[0];
}

function onCalc() {
  const oyaId = getOyaId();

  const winners = game.seats.filter(m => {
    const ag = game.actions[m.id].agari;
    return ag === "tsumo" || /^\d+$/.test(ag);
  });

  if (winners.length === 0) {
    alert("和了者がいません。流局の場合は「流局」ボタンを押してください。");
    return;
  }

  const totalDelta = {};
  game.seats.forEach(m => { totalDelta[m.id] = 0; });
  game.seats.forEach(m => {
    if (game.actions[m.id].action === "riichi") totalDelta[m.id] -= 1000;
  });
  const pendingKyotaku = game.kyotaku + game.seats.filter(m => game.actions[m.id].action === "riichi").length * 1000;

  for (const w of winners) {
    const a = game.actions[w.id];
    const isOya = (w.id === oyaId);
    let res;
    if (a.agari === "tsumo") {
      res = distributePoints({
        kind: "tsumo", winnerId: w.id, isOya, oyaId,
        point: Number(a.point) || 0,
        pointKo: Number(a.pointKo) || 0,
        pointOya: Number(a.pointOya) || 0
      });
    } else {
      const loserId = Number(a.agari);
      res = distributePoints({ kind: "ron", winnerId: w.id, loserId, oyaId, point: Number(a.point) || 0 });
    }
    if (!res.ok) { alert(`${w.name}：${res.msg}`); return; }
    game.seats.forEach(m => { totalDelta[m.id] += res.delta[m.id]; });
  }

  let kyotakuWinnerId;
  if (winners.length === 1) {
    kyotakuWinnerId = winners[0].id;
  } else {
    const firstRon = winners.find(w => /^\d+$/.test(game.actions[w.id].agari));
    const loserId = firstRon ? Number(game.actions[firstRon.id].agari) : winners[0].id;
    kyotakuWinnerId = headBumpWinner(winners, loserId).id;
  }
  totalDelta[kyotakuWinnerId] += pendingKyotaku;

  pushSnapshot();
  recordLog();

  game.seats.forEach(m => { game.scores[m.id] += totalDelta[m.id]; });
  game.kyotaku = 0;
  renderScores();

  const oyaWon = winners.some(w => w.id === oyaId);
  const oyaTenpai = (game.actions[oyaId].agari === "tenpai");
  if (oyaWon || oyaTenpai) {
    incrementHonba();
    refreshActions();
    alert("記録しました（連荘・本場+1）");
  } else {
    advanceRound(false);
    alert("記録しました（局進行・本場リセット）");
  }
  updatePrevButton();
}

function onRyukyoku() {
  const oyaId = getOyaId();
  pushSnapshot();
  recordLog();

  const riichiPlayers = game.seats.filter(m => game.actions[m.id].action === "riichi");
  riichiPlayers.forEach(m => { game.scores[m.id] -= 1000; });
  game.kyotaku += riichiPlayers.length * 1000;

  applyTenpaiPayments();
  renderScores();

  const oyaTenpai = isTenpai(oyaId);
  if (oyaTenpai) {
    incrementHonba();
    refreshActions();
    alert("流局を記録しました（親聴牌・連荘・本場+1。供託は持ち越し）");
  } else {
    advanceRound(true);
    alert("流局を記録しました（局進行・本場+1。供託は持ち越し）");
  }
  updatePrevButton();
}

function onAbort() {
  pushSnapshot();
  recordLog();
  incrementHonba();
  refreshActions();
  alert("途中流局を記録しました（局据え置き・本場+1。供託は持ち越し）");
  updatePrevButton();
}

function isTenpai(id) {
  const a = game.actions[id];
  if (a.action === "riichi") return true;
  const ag = a.agari;
  return ag === "tenpai" || ag === "tsumo" || /^\d+$/.test(ag);
}

function applyTenpaiPayments() {
  const tenpaiIds = game.seats.filter(m => isTenpai(m.id)).map(m => m.id);
  const notenIds  = game.seats.filter(m => !isTenpai(m.id)).map(m => m.id);
  const t = tenpaiIds.length, n = notenIds.length;
  if (t === 0 || n === 0) return;
  const recvEach = Math.round(3000 / t);
  const payEach  = Math.round(3000 / n);
  tenpaiIds.forEach(id => { game.scores[id] += recvEach; });
  notenIds.forEach(id => { game.scores[id] -= payEach; });
}

function incrementHonba() {
  const el = document.getElementById("honba");
  el.value = (Number(el.value) || 0) + 1;
}

function advanceRound(addHonba) {
  const order = ["東", "南", "西", "北"];
  let { wind, num } = game.round;
  const carriedHonba = addHonba ? (getHonba() + 1) : 0;
  if (num < 4) { num++; }
  else {
    const wi = order.indexOf(wind);
    if (wi < order.length - 1) { wind = order[wi + 1]; num = 1; }
    else {
      alert("北4局です。これ以上進めません。対局終了してください。");
      refreshActions();
      return;
    }
  }
  game.round = { wind, num };
  document.getElementById("roundWind").value = wind;
  document.getElementById("roundNum").value = num;
  document.getElementById("honba").value = carriedHonba;
  resetActions();
  buildPlayerRows();
}

function refreshActions() {
  resetActions();
  buildPlayerRows();
}

function onNextRound() { advanceRound(false); }

function onRoundChange() {
  game.round.wind = document.getElementById("roundWind").value;
  game.round.num = Number(document.getElementById("roundNum").value);
  document.getElementById("honba").value = 0;
  resetActions();
  buildPlayerRows();
}

function computeResult() {
  const oka = (settings.returnScore - settings.initialScore) * 4 / 1000;
  const uma = [settings.umaTop, settings.umaSecond, -settings.umaSecond, -settings.umaTop];
  const ranked = game.seats
    .map((m, idx) => ({ m, idx, score: game.scores[m.id] }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  return ranked.map((row, rank) => {
    const raw = (row.score - settings.returnScore) / 1000;
    let umaOka = uma[rank];
    if (rank === 0) umaOka += oka;
    return {
      rank: rank + 1, name: row.m.name, score: row.score,
      raw: raw, umaOka: umaOka, total: raw + umaOka
    };
  });
}

function onEndGame() {
  if (!confirm("対局を終了します。よろしいですか？\n結果が確定し、履歴に保存されます。")) return;
  const results = computeResult();
  renderResultScreen(results);
  saveHistory(results);
  showScreen("result");
}

function renderResultScreen(results) {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";
  const sign = v => (v > 0 ? "+" : "") + v.toFixed(1);
  results.forEach(r => {
    const cls = r.total > 0 ? "plus" : (r.total < 0 ? "minus" : "");
    tbody.insertAdjacentHTML("beforeend", `
      <tr class="${r.rank === 1 ? "rank1" : ""}">
        <td>${r.rank}位</td><td>${r.name}</td>
        <td>${r.score.toLocaleString()}</td>
        <td>${sign(r.raw)}</td><td>${sign(r.umaOka)}</td>
        <td class="${cls}">${sign(r.total)}</td>
      </tr>
    `);
  });
  document.getElementById("resultMeta").textContent =
    `${game.date} ／ ${game.hanchanNo}半荘目（単位：千点 / 返し${settings.returnScore} ウマ${settings.umaTop}-${settings.umaSecond}）`;
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}
function saveHistory(results) {
  const history = loadHistory();
  history.push({
    date: game.date, hanchanNo: game.hanchanNo,
    savedAt: new Date().toISOString(),
    seats: game.seats.map(m => m.name),
    results: results, log: game.log
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
  catch (e) { alert("履歴の保存に失敗しました（ブラウザの設定をご確認ください）"); }
}
function clearHistory() {
  if (!confirm("全ての対局履歴を削除します。よろしいですか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistoryList();
}
function openHistory() {
  renderHistoryList();
  showScreen("history");
}

// ツモの増加総額を計算
function tsumoTotal(p) {
  // 親ツモ：all × 3、子ツモ：子払い×2 + 親払い
  if (p.point) return Number(p.point) * 3;
  const ko = Number(p.pointKo) || 0;
  const oya = Number(p.pointOya) || 0;
  return ko * 2 + oya;
}

function formatPlayerLog(p, nameById) {
  const parts = [p.name];
  const isWin = (p.agari === "tsumo" || /^\d+$/.test(p.agari));

  if (p.action === "riichi") parts.push("立直" + (p.actionJunme || ""));
  else if (p.action === "fuuro") parts.push("副露" + (p.actionJunme || ""));
  else if (isWin) parts.push("闇聴");

  if (p.agari === "tsumo") {
    parts.push("自摸" + (p.agariJunme || ""));
    const total = tsumoTotal(p);
    if (total) parts.push(String(total));
  } else if (/^\d+$/.test(p.agari)) {
    const loser = nameById[p.agari] || "";
    parts.push(loser + (p.agariJunme || ""));
    if (p.point) parts.push(p.point);
  } else if (p.agari === "tenpai") {
    parts.push("聴牌");
  }
  return parts.join(",");
}

function logToText(h) {
  const lines = [];
  const nameById = {};
  if (h.log && h.log.length) h.log[0].players.forEach(p => { nameById[p.id] = p.name; });

  lines.push(`${h.hanchanNo}半荘目`);
  if (h.seats) lines.push(h.seats.join(","));
  (h.log || []).forEach(entry => {
    lines.push(`${entry.wind}${entry.num}局${entry.honba}本場`);
    entry.players.forEach(p => {
      const hasContent = (p.action !== "none") || (p.agari !== "none");
      if (hasContent) lines.push(formatPlayerLog(p, nameById));
    });
  });
  return lines.join("\n");
}

function renderHistoryList() {
  const list = document.getElementById("historyList");
  const history = loadHistory();
  list.innerHTML = "";
  if (history.length === 0) {
    list.innerHTML = `<div class="history-empty">まだ対局履歴がありません</div>`;
    return;
  }
  const sign = v => (v > 0 ? "+" : "") + v.toFixed(1);
  history.slice().reverse().forEach((h, revIdx) => {
    const idx = history.length - 1 - revIdx;
    const rows = h.results.map(r => {
      const cls = r.total > 0 ? "plus" : (r.total < 0 ? "minus" : "");
      return `<tr>
        <td>${r.rank}位</td><td>${r.name}</td>
        <td class="r">${r.score.toLocaleString()}</td>
        <td class="r ${cls}">${sign(r.total)}</td>
      </tr>`;
    }).join("");
    const logText = logToText(h);

    list.insertAdjacentHTML("beforeend", `
      <div class="history-card">
        <div class="hc-head">
          <span>${h.date}　${h.hanchanNo}半荘目</span>
          <span>
            <button class="hc-log-toggle" data-idx="${idx}">明細</button>
            <button class="hc-copy" data-idx="${idx}">コピー</button>
          </span>
        </div>
        <table>${rows}</table>
        <div class="hc-log" data-log="${idx}" hidden>${escapeHtml(logText)}</div>
      </div>
    `);
  });

  list.querySelectorAll(".hc-copy").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      copyToClipboard(historyToText([loadHistory()[idx]]));
      btn.textContent = "コピー済✓";
      setTimeout(() => { btn.textContent = "コピー"; }, 1500);
    });
  });
  list.querySelectorAll(".hc-log-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.idx;
      const logEl = list.querySelector(`.hc-log[data-log="${idx}"]`);
      logEl.hidden = !logEl.hidden;
      btn.textContent = logEl.hidden ? "明細" : "閉じる";
    });
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function historyToText(history) {
  const lines = [];
  history.forEach(h => {
    lines.push(h.date);
    lines.push(logToText(h));
    lines.push("");
  });
  return lines.join("\n");
}

function copyAllHistory() {
  const history = loadHistory();
  if (history.length === 0) { alert("コピーする履歴がありません"); return; }
  copyToClipboard(historyToText(history));
  const btn = document.getElementById("copyHistoryBtn");
  btn.textContent = "コピーしました✓";
  setTimeout(() => { btn.textContent = "全履歴をコピー"; }, 1500);
}
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}
function onNextHanchan() {
  game.hanchanNo += 1;
  buildSetupScreen();
  showScreen("setup");
}

window.addEventListener("DOMContentLoaded", init);
