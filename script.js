"use strict";

let members = [];
let settings = {};
let scores = {}; // { memberId: 点数 }

// ===== 初期化 =====
async function init() {
  try {
    const res = await fetch("members.json");
    const data = await res.json();
    members = data.members;
    settings = data.settings;
  } catch (e) {
    // fetchが使えない環境（file://直開き）向けのフォールバック
    members = [
      { id: 1, name: "坂井" },
      { id: 2, name: "高木" },
      { id: 3, name: "中江" },
      { id: 4, name: "福原" }
    ];
    settings = { initialScore: 25000, returnScore: 30000, umaTop: 20, umaSecond: 10 };
  }

  // 点数初期化
  members.forEach(m => { scores[m.id] = settings.initialScore; });

  buildPlayerRows();
  buildSelects();
  renderScores();
  bindEvents();
}

// ===== プレイヤー行生成 =====
function buildPlayerRows() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  members.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <input type="radio" name="oya" class="oya-radio" value="${m.id}" ${i === 0 ? "checked" : ""}>
      <div class="cell name-cell">${m.name}</div>
      <div class="cell wind-cell" data-id="${m.id}">${["東","南","西","北"][i]}</div>
      <div class="cell score-cell" data-id="${m.id}">${scores[m.id].toLocaleString()}</div>
    `;
    list.appendChild(row);
  });
}

// ===== 和了者/放銃者セレクト =====
function buildSelects() {
  const winner = document.getElementById("winner");
  const loser = document.getElementById("loser");
  winner.innerHTML = "";
  loser.innerHTML = "";
  members.forEach(m => {
    winner.insertAdjacentHTML("beforeend", `<option value="${m.id}">${m.name}</option>`);
    loser.insertAdjacentHTML("beforeend", `<option value="${m.id}">${m.name}</option>`);
  });
}

// ===== 点数表示（下半分・卓レイアウト） =====
function renderScores() {
  // 上の名前欄も更新
  document.querySelectorAll(".score-cell").forEach(el => {
    const id = Number(el.dataset.id);
    el.textContent = scores[id].toLocaleString();
  });

  // 卓レイアウト（4人想定：上=3人目, 下=1人目, 左=2人目, 右=4人目）
  const seatIds = ["seatBottom", "seatRight", "seatTop", "seatLeft"];
  members.forEach((m, i) => {
    const seat = document.getElementById(seatIds[i]);
    if (!seat) return;
    seat.innerHTML = `
      <div class="seat-name">${m.name}</div>
      <div class="seat-score">${scores[m.id].toLocaleString()}</div>
    `;
  });

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  document.getElementById("tableCenter").innerHTML = `合計<br>${total.toLocaleString()}`;
}

// ===== 点数計算（簡易ルール） =====
function calcPoints(han, fu, isTsumo, isOya) {
  // 基本点 = 符 × 2^(2+飜)。満貫以上は固定。
  let base = fu * Math.pow(2, 2 + han);
  if (han >= 13) base = 8000;        // 役満
  else if (han >= 11) base = 6000;   // 三倍満
  else if (han >= 8) base = 4000;    // 倍満
  else if (han >= 6) base = 3000;    // 跳満
  else if (han >= 5 || base > 2000) base = 2000; // 満貫

  const ceil100 = n => Math.ceil(n / 100) * 100;

  if (isTsumo) {
    if (isOya) {
      const each = ceil100(base * 2);
      return { type: "tsumo-oya", each, total: each * 3 };
    } else {
      const ko = ceil100(base);
      const oya = ceil100(base * 2);
      return { type: "tsumo-ko", ko, oya, total: ko * 2 + oya };
    }
  } else {
    const point = ceil100(base * (isOya ? 6 : 4));
    return { type: "ron", point, total: point };
  }
}

// ===== 記録ボタン処理 =====
function onCalc() {
  const oyaId = Number(document.querySelector('input[name="oya"]:checked').value);
  const resultType = document.getElementById("resultType").value;
  const honba = Number(document.getElementById("honba").value) || 0;
  const honbaBonus = honba * 300; // 本場ボーナス（ロン時総額。ツモは100点×3）

  if (resultType === "ryukyoku") {
    alert("流局を記録しました（点数移動なし・テンパイ料は未実装）");
    return;
  }

  const winnerId = Number(document.getElementById("winner").value);
  const han = Number(document.getElementById("han").value);
  const fu = Number(document.getElementById("fu").value);
  const isOya = (winnerId === oyaId);
  const isTsumo = (resultType === "tsumo");

  const r = calcPoints(han, fu, isTsumo, isOya);

  if (isTsumo) {
    let gained = 0;
    members.forEach(m => {
      if (m.id === winnerId) return;
      const isPayerOya = (m.id === oyaId);
      let pay;
      if (r.type === "tsumo-oya") pay = r.each + honba * 100;
      else pay = (isPayerOya ? r.oya : r.ko) + honba * 100;
      scores[m.id] -= pay;
      gained += pay;
    });
    scores[winnerId] += gained;
  } else {
    const loserId = Number(document.getElementById("loser").value);
    if (loserId === winnerId) {
      alert("和了者と放銃者が同じです");
      return;
    }
    const pay = r.point + honbaBonus;
    scores[loserId] -= pay;
    scores[winnerId] += pay;
  }

  renderScores();
}

// ===== 結果タイプによる表示切替 =====
function toggleResultRows() {
  const type = document.getElementById("resultType").value;
  document.getElementById("loserRow").style.display = (type === "ron") ? "flex" : "none";
  document.getElementById("winnerRow").style.display = (type === "ryukyoku") ? "none" : "flex";
}

// ===== リセット =====
function onReset() {
  members.forEach(m => { scores[m.id] = settings.initialScore; });
  renderScores();
}

// ===== イベント登録 =====
function bindEvents() {
  document.getElementById("calcBtn").addEventListener("click", onCalc);
  document.getElementById("resetBtn").addEventListener("click", onReset);
  document.getElementById("resultType").addEventListener("change", toggleResultRows);
  toggleResultRows();
}

window.addEventListener("DOMContentLoaded", init);
