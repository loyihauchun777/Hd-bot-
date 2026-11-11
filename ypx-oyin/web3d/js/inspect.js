// Inspection of a stopped car: dialogue, documents, breathalyser, vehicle check, bribe, verdict.
import { VIOLATIONS, INSPECTOR_LINES, DRIVER_LINES, VOICES, CAR_TYPES, CAR_COLORS, FIRST_NAMES, LAST_NAMES } from './data.js';
import { drawFace } from './models.js';
import { playVoice, stopVoice, sfx } from './audio.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];

// "dd.mm.yyyy" -> whole days from today (negative = in the past)
function daysFromToday(str) {
  const [d, m, y] = str.split('.').map(Number);
  const t = new Date(); t.setHours(12, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d, 12) - t) / 86400000);
}
function daysText(str) {
  const n = daysFromToday(str);
  if (n > 0) return `${n} kun qoldi`;
  if (n < 0) return `${-n} kun oldin tugagan`;
  return 'bugun tugaydi';
}

const ROAD_LINE = { tezlik: 'I3', kamar: 'I4', telefon: 'I5', qizil: 'I6', tonirovka: 'I7', raqamsiz: 'I16' };
const EXCUSE = { tezlik: ['D3', 'D4'], kamar: ['D5'], telefon: ['D6'], qizil: ['D7'], tonirovka: ['D15'], raqamsiz: ['D13'] };

const ACTIONS = [
  ['jarima', '📝 Jarima yozish'],
  ['ogoh', '⚠️ Ogohlantirish'],
  ['chetlatish', '🚫 Boshqarishdan chetlatish (evakuator)'],
  ['qoyib', '✅ Qo‘yib yuborish'],
];

export class Inspection {
  constructor(game) {
    this.game = game;
    this.active = false;
    document.querySelectorAll('#inspTabs button').forEach(b => b.addEventListener('click', () => { sfx.click(); this.tab(b.dataset.tab); }));
    $('btnBribeNo').onclick = () => this.bribeAnswer(false);
    $('btnBribeYes').onclick = () => this.bribeAnswer(true);
  }

  // ---------- dialogue ----------
  async say(who, id) {
    const p = this.car.prof;
    const text = who === 'i' ? INSPECTOR_LINES[id] : DRIVER_LINES[id];
    const name = who === 'i' ? 'Siz' : p.name.split(' ')[0];
    $('bubble').innerHTML = `<span class="who">${name}:</span>${text}`;
    const voice = who === 'i' ? VOICES.inspector : VOICES.drivers[p.voice];
    const token = ++this.sayToken;
    await playVoice(voice, id, text);
    return token === this.sayToken;
  }

  async script(lines) {
    const token = ++this.scriptToken;
    for (const [who, id] of lines) {
      if (!this.active || token !== this.scriptToken) return;
      await this.say(who, id);
      await sleep(150);
    }
  }

  // ---------- open / close ----------
  open(car) {
    this.car = car;
    this.active = true;
    this.flags = new Set();
    this.alco = null;
    this.bribe = null; // null = not offered yet, 'refused', 'taken'
    this.action = null;
    this.ownerLineSaid = false;
    this.tabletLoaded = false;
    this.otherCar = null;
    this.sayToken = 0; this.scriptToken = 0;
    const p = car.prof;
    drawFace($('driverFace'), p.face);
    $('driverName').textContent = p.name;
    $('driverCar').textContent = `${p.type.name}, ${p.colorName} · ${p.noPlate ? 'raqamsiz' : p.plate}`;
    $('inspect').classList.remove('hidden');
    this.tab('docs');
    const first = p.road[0];
    const lines = [['i', 'I1'], ['d', 'D1'], ['d', 'D2']];
    if (first) {
      lines.push(['i', ROAD_LINE[first]]);
      const ex = EXCUSE[first];
      lines.push(['d', ex[Math.floor(Math.random() * ex.length)]]);
    } else {
      lines.push(['i', 'I2']);
    }
    this.script(lines);
  }

  close() {
    this.active = false;
    stopVoice();
    $('inspect').classList.add('hidden');
    $('bribe').classList.add('hidden');
    this.game.setCamMode('follow');
  }

  tab(name) {
    if (!this.active) return;
    this.curTab = name;
    document.querySelectorAll('#inspTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    this.game.setCamMode(name === 'car' ? 'orbit' : 'talk', this.car);
    if (name === 'verdict' && this.car.prof.bribe && this.bribe === null) { this.offerBribe(); return; }
    this['render_' + name]();
  }

  flagRow(key, label, light = false) {
    return `<label class="flag"${light ? '' : ''}><input type="checkbox" data-flag="${key}" ${this.flags.has(key) ? 'checked' : ''}> ${label}</label>`;
  }

  bindFlags() {
    $('inspBody').querySelectorAll('input[data-flag]').forEach(inp => {
      inp.onchange = () => { sfx.click(); inp.checked ? this.flags.add(inp.dataset.flag) : this.flags.delete(inp.dataset.flag); };
    });
  }

  // ---------- documents ----------
  render_docs() {
    const p = this.car.prof, d = p.docs;
    const today = new Date();
    const t = String(today.getDate()).padStart(2, '0') + '.' + String(today.getMonth() + 1).padStart(2, '0') + '.' + today.getFullYear();
    // stable pseudo-numbers for this driver (document numbers, issue date)
    let h = 0; for (const ch of d.licenseName + p.plate) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const num = n => String(h % 10 ** n).padStart(n, '0');
    const [dd, mm, yy] = d.licenseUntil.split('.');
    const issued = `${dd}.${mm}.${+yy - 10}`;
    const [first, ...rest] = d.licenseName.split(' ');
    const last = rest.join(' ');
    const [model, colour] = d.techModel.replace(')', '').split(' (');
    const boxes = (str, n) => str.padEnd(n).slice(0, n).split('').map(c => `<i>${c}</i>`).join('');
    $('inspBody').innerHTML = `
      <div class="today">📅 Bugun: <b>${t}</b> · 🚗 Mashinadagi raqam: <b>${p.noPlate ? 'YO‘Q' : p.plate}</b></div>
      <div class="card lic">
        <div class="ttl">HAYDOVCHILIK GUVOHNOMASI<small>o‘yin hujjati</small></div>
        <canvas id="licPhoto" width="96" height="128"></canvas>
        <div class="flds">
          <div><span>1.</span><b>${last.toUpperCase()}</b></div>
          <div><span>2.</span><b>${first.toUpperCase()}</b></div>
          <div><span>4a.</span>${issued}</div>
          <div><span>4b.</span><b>${d.licenseUntil}</b></div>
          <div><span>5.</span>AF ${num(7)}</div>
          <div><span>9.</span><b class="cat">B</b></div>
        </div>
      </div>
      ${this.flagRow('guvohnoma', 'Guvohnoma muddati o‘tgan (4b)')}
      ${this.flagRow('rasm', 'Rasm haydovchiga o‘xshamaydi')}
      <div class="card tech">
        <div class="ttl">TRANSPORT VOSITASINI QAYD ETISH GUVOHNOMASI<small>o‘yin hujjati</small></div>
        <div class="flds">
          <div><span>Davlat raqami</span><b class="plate">${d.techPlate}</b></div>
          <div><span>Rusumi</span><b>${model}</b></div>
          <div><span>Rangi</span>${colour || ''}</div>
          <div><span>Egasi</span><b>${d.techOwner}</b></div>
          <div><span>Guvohnoma №</span>AAF ${num(7).split('').reverse().join('')}</div>
        </div>
      </div>
      ${this.flagRow('texraqam', 'Raqam mashinaga mos emas')}
      ${this.flagRow('egasi', 'Egasi boshqa odam')}
      <div class="card ins">
        <div class="ttl">SUG‘URTA POLISI<small>o‘yin hujjati</small></div>
        <div class="pno"><span>№</span><em>${boxes(num(9), 9)}</em></div>
        <div class="until">Amal qiladi: <b>${d.insuranceUntil}</b> gacha</div>
        <div class="l1"><span>Sug‘urtalanuvchi:</span> <b>${d.techOwner}</b></div>
        <div class="l2"><span>Transport vositasi:</span> <b>${model}</b></div>
        <div class="pl"><span>Davlat raqami</span><em>${boxes(d.techPlate.replace(/ /g, ''), 14)}</em></div>
        <div class="mp">M.O‘.</div><div class="sg">Imzo: <i>~~~~</i></div>
      </div>
      ${this.flagRow('sugurta', 'Sug‘urta muddati o‘tgan')}`;
    drawFace($('licPhoto'), { ...d.licensePhoto, bg: '#dde6f0', drunk: false });
    this.bindFlags();
    if (d.techOwner !== d.licenseName && !this.ownerLineSaid) { this.ownerLineSaid = true; this.script([['d', 'D14']]); }
  }

  // ---------- tablet: compare documents with the YPX database ----------
  async render_tablet() {
    const p = this.car.prof, d = p.docs;
    const clock = this.game.clockText ? this.game.clockText() : '';
    const shell = inner => `<div class="tablet"><div class="scr">
        <div class="sbar"><span>${clock}</span><span>📶 4G · 🔋 82%</span></div>
        <div class="app"><div class="lg">YPX</div><div><b>Yagona axborot bazasi</b><small>Yo‘l-patrul xizmati · inspektor rejimi</small></div></div>
        ${inner}</div></div>`;
    if (!this.tabletLoaded) {
      $('inspBody').innerHTML = shell(`<div class="srch"><span>🔎 ${p.noPlate ? d.licenseName : p.plate}</span><span class="muted">qidirilmoqda…</span></div>
        <div class="prog"><i></i></div><div class="loading">Bazaga so‘rov yuborildi</div>`);
      sfx.beep();
      await sleep(1100);
      if (!this.active || this.curTab !== 'tablet') return;
      this.tabletLoaded = true;
      sfx.beep();
    }
    const today = new Date();
    const t = String(today.getDate()).padStart(2, '0') + '.' + String(today.getMonth() + 1).padStart(2, '0') + '.' + today.getFullYear();
    // database answer for the plate actually mounted on the car
    let plateHit;
    if (p.noPlate) plateHit = '— (mashinada raqam yo‘q)';
    else if (p.plate === d.techPlate) plateHit = `${d.techModel}<small>egasi: ${d.techOwner}</small>`;
    else {
      if (!this.otherCar) {
        const [cn] = pick(CAR_COLORS);
        this.otherCar = `${pick(CAR_TYPES).name} (${cn})<small>egasi: ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}</small>`;
      }
      plateHit = this.otherCar;
    }
    const proxy = d.techOwner !== d.licenseName;
    const head = '<tr><th></th><th>Hujjatda</th><th>Bazada</th></tr>';
    $('inspBody').innerHTML = shell(`
        <div class="srch"><span>🔎 ${p.noPlate ? d.licenseName : p.plate} · ${d.licenseName}</span><em>✓ topildi</em></div>
        <div class="tcard"><h5>👤 HAYDOVCHI</h5>
          <div class="faces">
            <div><canvas id="tfDriver" width="96" height="112"></canvas>Oldingizdagi<br>haydovchi</div>
            <div><canvas id="tfLic" width="96" height="112"></canvas>Guvohnomadagi<br>rasm</div>
            <div><canvas id="tfBase" width="96" height="112"></canvas>Bazadagi<br>rasm</div>
          </div>
          <table class="cmp">${head}
            <tr><td>F.I.Sh.</td><td>${d.licenseName}</td><td>${d.licenseName}</td></tr>
            <tr><td>Guvohnoma muddati</td><td>${d.licenseUntil}<small>${daysText(d.licenseUntil)}</small></td><td>${d.licenseUntil}<small>${daysText(d.licenseUntil)}</small></td></tr>
          </table></div>
        <div class="tcard"><h5>🚗 TRANSPORT VOSITASI</h5>
          <table class="cmp">${head}
            <tr><td>Davlat raqami</td><td>Mashinada: <b>${p.noPlate ? 'yo‘q' : p.plate}</b><small>Texpasportda: ${d.techPlate}</small></td><td>${d.techPlate}<small>texpasport bo‘yicha</small></td></tr>
            <tr><td>Mashinadagi raqam bo‘yicha</td><td>${p.noPlate ? '—' : p.plate}</td><td>${plateHit}</td></tr>
            <tr><td>Egasi</td><td>${d.techOwner}</td><td>${d.techOwner}${proxy ? '<small>Ishonchnoma: rasmiylashtirilgan</small>' : ''}</td></tr>
          </table></div>
        <div class="tcard"><h5>🛡 SUG‘URTA POLISI</h5>
          <table class="cmp">${head}
            <tr><td>Amal qiladi</td><td>${d.insuranceUntil}<small>${daysText(d.insuranceUntil)}</small></td><td>${d.insuranceUntil}<small>${daysText(d.insuranceUntil)}</small></td></tr>
          </table>
          <div class="muted" style="font-size:11px;margin-top:4px">📅 Bugungi sana: <b style="color:#fff">${t}</b></div></div>`) + `
      ${this.flagRow('guvohnoma', 'Guvohnoma muddati o‘tgan')}
      ${this.flagRow('rasm', 'Haydovchi guvohnomadagi odam emas')}
      ${this.flagRow('texraqam', 'Raqam mashinaga mos emas')}
      ${this.flagRow('sugurta', 'Sug‘urta muddati o‘tgan')}`;
    drawFace($('tfDriver'), p.face);
    drawFace($('tfLic'), { ...d.licensePhoto, bg: '#dde6f0', drunk: false });
    drawFace($('tfBase'), { ...d.licensePhoto, bg: '#e8e2d0', drunk: false });
    this.bindFlags();
  }

  // ---------- breathalyser ----------
  render_alco() {
    const p = this.car.prof;
    const cue = p.drunk ? '🍺 Haydovchidan spirtli ichimlik hidi kelmoqda, gapi chalkash.' : (Math.random() < 0.3 ? '😟 Haydovchi biroz hayajonlangan.' : 'Haydovchi o‘zini odatdagidek tutmoqda.');
    $('inspBody').innerHTML = `
      <p>${this.alco ? '' : cue}</p>
      <div class="alco-val" id="alcoVal">${this.alco != null ? this.alco.toFixed(2) + ' ‰' : '—.— ‰'}</div>
      <div class="meter"><div id="alcoBar" style="width:${this.alco != null ? Math.min(100, this.alco * 70) : 0}%"></div></div>
      <p class="muted">Ruxsat etilgan chegara: 0.30 ‰ gacha</p>
      <button id="btnBlow" class="primary" style="width:100%" ${this.alco != null ? 'disabled' : ''}>Alkotesterga puflashni so‘rash</button>
      ${this.flagRow('mast', 'Mast holatda')}`;
    this.bindFlags();
    $('btnBlow').onclick = async () => {
      $('btnBlow').disabled = true;
      await this.script([['i', 'I8'], ['d', p.drunk ? 'D11' : 'D10']]);
      if (!this.active || this.curTab !== 'alco') return;
      const val = p.drunk ? 0.55 + Math.random() * 0.9 : Math.random() * 0.12;
      for (let i = 0; i <= 25; i++) {
        if (!this.active || this.curTab !== 'alco') return;
        const v = val * (i / 25);
        $('alcoVal').textContent = v.toFixed(2) + ' ‰';
        $('alcoBar').style.width = Math.min(100, v * 70) + '%';
        if (i % 5 === 0) sfx.beep();
        await sleep(90);
      }
      this.alco = val;
      $('alcoVal').style.color = val > 0.3 ? '#ff6b6b' : '#7CFFB2';
    };
  }

  // ---------- vehicle check ----------
  render_car() {
    this.game.setCamMode('orbit', this.car);
    $('inspBody').innerHTML = `
      <p>💡 Haydovchi barcha chiroqlarni yoqdi. Mashinani aylanib ko‘ring: <b>yonmayotgan fara</b> — nosoz.
      Chap tomonda kamerani surib burish mumkin.</p>
      ${this.flagRow('fara', 'Faralardan biri yonmayapti (nosoz)')}
      ${this.flagRow('shina', 'Shinalardan biri yeyilgan')}
      <button id="btnTrunk" class="primary" style="width:100%;margin-top:8px">🧳 Bagajni ochish</button>
      <p class="muted">Ko‘zga tashlanadigan qoidabuzarliklar (tonirovka, raqam yo‘qligi) radar orqali avtomatik qayd etilgan.</p>`;
    this.bindFlags();
    $('btnTrunk').onclick = () => { sfx.click(); this.render_trunk(); };
    if (!this.carLineSaid) { this.carLineSaid = true; this.script([['i', 'I9']]); }
  }

  // ---------- trunk: mandatory kit ----------
  render_trunk() {
    this.game.setCamMode('trunk', this.car);
    const k = this.car.prof.kit || { otochirgich: true, aptechka: true, belgi: true, zaxira: true };
    const slot = (have, icon, name) => `<div class="slot ${have ? '' : 'empty'}">${have ? `<span>${icon}</span>${name}` : `<span>▫️</span>bo‘sh joy`}</div>`;
    $('inspBody').innerHTML = `
      <p>🧳 Bagaj ochildi. Majburiy jihozlar: <b>o‘t o‘chirgich, aptechka, avariya to‘xtash belgisi</b>.</p>
      <div class="trunk">
        ${slot(k.otochirgich, '🧯', 'O‘t o‘chirgich')}
        ${slot(k.aptechka, '🩹', 'Aptechka')}
        ${slot(k.belgi, '⚠️', 'Avariya belgisi')}
        ${slot(k.zaxira, '🛞', 'Zaxira g‘ildirak')}
      </div>
      <p class="muted">Zaxira g‘ildirak majburiy emas.</p>
      ${this.flagRow('jihoz', 'Majburiy jihoz yetishmaydi')}
      <button id="btnBackCar" style="width:100%;margin-top:8px">⬅ Mashinaga qaytish</button>`;
    this.bindFlags();
    $('btnBackCar').onclick = () => { sfx.click(); this.render_car(); };
  }

  // ---------- bribe ----------
  offerBribe() {
    this.script([['d', 'D8']]);
    const sum = (Math.floor(Math.random() * 5) + 2) * 100;
    this.bribeSum = sum;
    $('bribeText').innerHTML = `Haydovchi hujjatlar orasiga <b>${sum} ming so‘m</b> qo‘yib uzatdi:<br><i>«Inspektor aka, balki o‘zimizcha kelishib olarmiz?»</i>`;
    $('bribe').classList.remove('hidden');
  }

  bribeAnswer(take) {
    $('bribe').classList.add('hidden');
    if (take) {
      this.bribe = 'taken';
      sfx.cash();
      this.finish('qoyib', true);
    } else {
      this.bribe = 'refused';
      sfx.good();
      this.game.toast('Pora rad etildi! Halollik +', 'good');
      this.script([['i', 'I10']]);
      this.render_verdict();
    }
  }

  // ---------- verdict ----------
  render_verdict() {
    const p = this.car.prof;
    let list = p.road.map(k => `<div class="road-v">${VIOLATIONS[k].icon || '•'} ${VIOLATIONS[k].name} <span class="muted">(radar)</span></div>`).join('');
    for (const k of this.flags) {
      if (k === 'egasi') list += `<div class="road-v">• Mashina egasi boshqa odam</div>`;
      else list += `<div class="road-v">• ${VIOLATIONS[k].name}</div>`;
    }
    if (this.bribe === 'refused') list += `<div class="road-v">💵 ${VIOLATIONS.pora.name}</div>`;
    if (!list) list = '<p class="muted">Qoidabuzarlik aniqlanmadi.</p>';
    $('inspBody').innerHTML = `<h4 style="margin:0 0 6px">Aniqlangan qoidabuzarliklar:</h4>${list}
      <h4 style="margin:12px 0 4px">Qaror:</h4>
      ${ACTIONS.map(([k, n]) => `<button class="choice ${this.action === k ? 'sel' : ''}" data-act="${k}">${n}</button>`).join('')}
      <button id="btnConfirm" class="primary" style="width:100%;margin-top:10px" ${this.action ? '' : 'disabled'}>Tasdiqlash</button>`;
    $('inspBody').querySelectorAll('[data-act]').forEach(b => b.onclick = () => { sfx.click(); this.action = b.dataset.act; this.render_verdict(); });
    $('btnConfirm').onclick = () => this.finish(this.action, false);
  }

  // ---------- scoring ----------
  evaluate(action) {
    const p = this.car.prof;
    const truth = new Set([...p.road, ...p.hidden]);
    if (this.bribe === 'refused') truth.add('pora');
    let points = 0, rep = 0;
    const notes = [];
    for (const k of this.flags) {
      if (truth.has(k)) { points += 40; }
      else { points -= 30; rep -= 3; notes.push('Noto‘g‘ri ayblov: ' + (k === 'egasi' ? 'egasi boshqa odam — bu qoidabuzarlik emas (ishonchnoma bor)' : VIOLATIONS[k].name)); }
    }
    for (const k of p.hidden) if (!this.flags.has(k)) { points -= 15; notes.push('E’tibordan chetda qoldi: ' + VIOLATIONS[k].name); }
    let ok;
    if (p.drunk) ok = ['chetlatish'];
    else if (!truth.size) ok = ['qoyib'];
    else {
      const allMinor = [...truth].every(k => VIOLATIONS[k].minor);
      ok = allMinor && truth.size === 1 ? ['ogoh', 'jarima'] : ['jarima'];
    }
    const correct = ok.includes(action);
    if (correct) { points += 60; rep += 2; } else { points -= 60; rep -= 5; notes.push('Qaror noto‘g‘ri. To‘g‘risi: ' + ok.map(a => ACTIONS.find(x => x[0] === a)[1]).join(' yoki ')); }
    if (this.bribe === 'refused') { points += 50; rep += 10; }
    return { points, rep, correct, notes };
  }

  async finish(action, tookBribe) {
    const p = this.car.prof;
    let res;
    if (tookBribe) {
      res = { points: 0, rep: -25, correct: false, notes: ['Pora olindi. Ichki xavfsizlik xizmati kuzatmoqda...'], bribe: this.bribeSum };
    } else {
      res = this.evaluate(action);
      const lines = {
        jarima: [['i', 'I11'], ['d', 'D9']],
        ogoh: [['i', 'I12'], ['d', 'D9']],
        chetlatish: [['i', 'I13']],
        qoyib: [['i', 'I14'], ['d', 'D12']],
      }[action];
      $('inspBody').innerHTML = `<h3 style="margin-top:0">${res.correct ? '✅ To‘g‘ri qaror' : '❌ Xato bor'}</h3>
        <p><b>${res.points >= 0 ? '+' : ''}${res.points}</b> ball · obro‘ ${res.rep >= 0 ? '+' : ''}${res.rep}</p>
        ${res.notes.map(n => `<p class="muted">• ${n}</p>`).join('')}`;
      document.querySelectorAll('#inspTabs button').forEach(b => b.disabled = true);
      res.correct ? sfx.good() : sfx.bad();
      await this.script(lines);
      await sleep(600);
      document.querySelectorAll('#inspTabs button').forEach(b => b.disabled = false);
    }
    res.action = action;
    res.drunk = p.drunk;
    this.close();
    this.game.inspectionDone(this.car, res);
  }
}
