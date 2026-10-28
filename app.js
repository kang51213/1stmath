// 학원 앱 화면 로직. 콘텐츠는 data.js(window.APP_DATA), 학생 개인 기록은 localStorage.
(function () {
  "use strict";
  const D = window.APP_DATA;
  const NAME = D.academy.name;
  document.title = NAME;

  // ── 저장소 (모든 접근 try/catch) ──
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const K = { session: "1st.session", hw: "1st.hwDone", wrong: "1st.wrong" };

  // ── 도우미 ──
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const toDate = s => { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const fmt = dt => `${dt.getMonth() + 1}월 ${dt.getDate()}일(${DAYS[dt.getDay()]})`;
  const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const daysLeft = s => Math.round((toDate(s) - today0()) / 864e5);
  const ddayText = n => n === 0 ? "오늘까지" : n > 0 ? `D-${n}` : "기한 지남";
  const ICON = {
    class: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    hw: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    wrong: '<path d="M5 4h14v16H5zM9 9h6M9 13h6"/>',
    score: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    notice: '<path d="M4 10v4h4l6 4V6l-6 4z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    install: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    map: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2z"/>'
  };
  const ic = n => `<svg viewBox="0 0 24 24">${ICON[n]}</svg>`;
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
  const WORDMARK = `<span class="wm">${esc(NAME)}</span>`; // 텍스트 워드마크 (심볼 없음)

  // ── 학생·반 ──
  // 시험판: 로그인 아이디와 관계없이 data.js 의 가상 학생을 보여준다. (실제 인증 없음)
  const me = () => D.student;
  const myClass = () => D.classes[me().classId];

  function nextClass() {
    const c = myClass(), now = new Date();
    let best = null;
    c.schedule.forEach(s => {
      const di = DAYS.indexOf(s.day), hm = s.start.split(":").map(Number);
      for (let k = 0; k < 8; k++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, hm[0], hm[1]);
        if (d.getDay() === di && d > now) { if (!best || d < best.at) best = { at: d, s }; break; }
      }
    });
    return best;
  }
  function whenLabel(d) {
    const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - today0()) / 864e5);
    return n === 0 ? "오늘" : n === 1 ? "내일" : fmt(d);
  }
  function sections(subject) {
    const out = [];
    (D.curriculum[subject] || []).forEach(u => u.sections.forEach(s => out.push({ unit: u.unit, no: s[0], name: s[1] })));
    return out;
  }
  function currentSection() {
    const c = myClass();
    return sections(c.subject).find(s => s.no === c.current);
  }

  // ── 숙제 ──
  const myHW = () => D.homework.filter(h => h.classId === me().classId).sort((a, b) => a.due < b.due ? -1 : 1);
  const hwDone = () => store.get(K.hw, []);
  function toggleHW(id) {
    const d = hwDone();
    store.set(K.hw, d.includes(id) ? d.filter(x => x !== id) : d.concat(id));
  }

  // ── 오답 ──
  function loadWrong() {
    let w = store.get(K.wrong, null);
    if (!Array.isArray(w)) {
      // 시험판 v1 기록(키 "wrong")이 있으면 옮겨 온다.
      const old = store.get("wrong", null);
      w = Array.isArray(old)
        ? old.map((x, i) => ({ id: "m" + i, subject: "공통수학1", sec: x.sec, no: x.no, why: x.why, memo: "", retry: true, solved: false }))
        : [{ id: "ex1", subject: "공통수학1", sec: "02 항등식", no: "031", why: "개념", memo: "예시 오답입니다", retry: true, solved: false }];
      store.set(K.wrong, w);
    }
    return w;
  }
  function updateWrong(id, fn) {
    const w = loadWrong(), i = w.findIndex(x => x.id === id);
    if (i < 0) return;
    const r = fn(w[i]);
    if (r === null) w.splice(i, 1); else w[i] = r;
    store.set(K.wrong, w);
  }

  // ── 라우팅 ──
  const PUBLIC = ["login", "about"];
  const NAVOF = { home: "home", class: "class", hw: "hw", wrong: "wrong", more: "more", score: "more", notice: "more", about: "more", me: "more" };
  const SUBTITLE = { score: "전체", notice: "전체", about: "전체", me: "전체" };
  const loggedIn = () => !!store.get(K.session, null);
  let wrongFilter = "retry";

  function route() {
    let r = (location.hash || "#home").slice(1);
    if (!PAGES[r]) r = "home";
    if (!loggedIn() && !PUBLIC.includes(r)) r = "login";
    if (loggedIn() && r === "login") r = "home";
    const showNav = loggedIn() && r !== "login";
    document.body.classList.toggle("nonav", !showNav);
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.n === NAVOF[r]));
    // 헤더: 하위 화면은 '뒤로', 나머지는 로고
    const back = SUBTITLE[r] && loggedIn()
      ? `<a class="back" href="#more">‹ ${SUBTITLE[r]}</a>`
      : r === "about" && !loggedIn() ? `<a class="back" href="#login">‹ 로그인</a>` : "";
    $("#hd").hidden = r === "login";
    $("#hd").innerHTML = (back || `<a class="logo" href="#home">${WORDMARK}</a>`) +
      (loggedIn() ? `<span class="who">${esc(me().name)} · ${esc(myClass().name)}</span>` : "");
    $("#page").innerHTML = PAGES[r]();
    if (BIND[r]) BIND[r]();
    window.scrollTo(0, 0);
  }
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

  // ── 화면 ──
  const PAGES = {
    login() {
      return `<div class="login">
        <div class="mark">${WORDMARK}<span class="lead" style="margin:0">학생·학부모 앱</span></div>
        <form id="lf" autocomplete="off">
          <label>아이디<input id="lid" name="id" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="아이디" required></label>
          <label>비밀번호<input id="lpw" type="password" placeholder="비밀번호" required></label>
          <button class="btn ac">로그인</button>
        </form>
        <div class="box">시험판에서는 아이디와 비밀번호에 <b>아무 값이나</b> 입력하면 들어갈 수 있습니다. 비밀번호는 어디에도 저장되지 않으며, 가상 학생 화면이 보입니다.</div>
        <div class="links"><a href="#about">학원 안내</a><a href="install.html">앱 설치 방법</a></div>
      </div>`;
    },

    home() {
      const nc = nextClass(), c = myClass(), cur = currentSection();
      const hw = myHW(), done = hwDone(), left = hw.filter(h => !done.includes(h.id));
      const retry = loadWrong().filter(w => w.retry && !w.solved).length;
      const n = latestNotice();
      return `<h1>${esc(me().name)} 학생, 안녕하세요</h1>
        <p class="lead">${fmt(new Date())}</p>
        <h2>오늘 할 일</h2>
        <div class="stats">
          <a class="stat" href="#hw"><b>${left.length}</b><span>남은 숙제</span></a>
          <a class="stat" href="#wrong"><b>${retry}</b><span>다시 풀 오답</span></a>
        </div>
        <h2>다음 수업</h2>
        ${nc ? `<a class="card hi" href="#class"><div class="k">${whenLabel(nc.at)} ${nc.s.start}-${nc.s.end}</div>
          <div class="t">${esc(c.subject)} · ${esc(c.name)}</div>
          <div class="s">${cur ? esc(cur.unit + " " + cur.no + " " + cur.name) : ""}</div></a>` : `<div class="empty">등록된 수업이 없습니다</div>`}
        ${n ? `<h2>공지 <a class="more" href="#notice">전체 보기 ›</a></h2>
          <a class="card" href="#notice"><div class="s" style="margin:0 0 2px">${fmt(toDate(n.date))}</div><div class="t">${esc(n.title)}</div></a>` : ""}
        <h2>메뉴</h2>
        <div class="tiles">
          ${[["class", "수업"], ["hw", "숙제"], ["wrong", "오답노트"], ["score", "성적"], ["notice", "공지"], ["about", "학원 안내"]]
            .map(t => `<a class="tile" href="#${t[0]}">${ic(t[0])}${t[1]}</a>`).join("")}
        </div>
        <p class="note">시험판 · 화면의 학생 정보는 가상 데이터입니다.</p>`;
    },

    class() {
      const c = myClass(), nc = nextClass(), all = sections(c.subject);
      const ci = all.findIndex(s => s.no === c.current);
      const pct = all.length ? Math.round(Math.max(ci, 0) / all.length * 100) : 0;
      let lastUnit = "";
      const prog = all.map((s, i) => {
        const head = s.unit !== lastUnit ? `<div class="unit">${esc(s.unit)}</div>` : "";
        lastUnit = s.unit;
        const st = i < ci ? "past" : i === ci ? "now" : "";
        return head + `<div class="sec ${st}"><span class="n">${esc(s.no)}</span><span>${esc(s.name)}</span>
          <span class="st">${i < ci ? "완료" : i === ci ? "진행 중" : ""}</span></div>`;
      }).join("");
      return `<h1>수업</h1><p class="lead">${esc(c.name)} · ${esc(c.subject)}</p>
        ${nc ? `<div class="card hi"><div class="k">다음 수업</div><div class="t">${whenLabel(nc.at)} ${nc.s.start}-${nc.s.end}</div><div class="s">${esc(c.room)}</div></div>` : ""}
        <h2>시간표</h2>
        <div class="card"><table>${c.schedule.map(s => `<tr><th>${s.day}요일</th><td>${s.start}-${s.end}</td><td style="color:var(--mid)">${esc(c.room)}</td></tr>`).join("")}</table></div>
        <div class="card"><div class="row"><span class="grow s" style="margin:0">담당</span><b>${esc(c.teacher)}</b></div>
          <div class="row" style="margin-top:8px"><span class="grow s" style="margin:0">교재</span><span style="text-align:right">${esc(c.book)}</span></div></div>
        <h2>수업 내용</h2>
        <div class="card">${c.plan.map(p => {
          const past = toDate(p.date) < today0();
          return `<div class="sec ${past ? "past" : ""}"><span style="width:92px;flex:none;font-size:13px">${fmt(toDate(p.date))}</span><span>${esc(p.topic)}</span></div>`;
        }).join("")}</div>
        <h2>진도 <span class="tag ac">${pct}%</span></h2>
        <div class="card"><div class="bar" style="margin:0 0 14px"><i style="width:${pct}%"></i></div>${prog}</div>`;
    },

    hw() {
      const hw = myHW(), done = hwDone();
      const todo = hw.filter(h => !done.includes(h.id)), fin = hw.filter(h => done.includes(h.id));
      const item = h => {
        const n = daysLeft(h.due), d = done.includes(h.id);
        return `<button class="card row ${d ? "done" : ""}" data-hw="${esc(h.id)}"><span class="chk">${CHECK}</span>
          <span class="grow"><span class="t" style="display:block">${esc(h.text)}</span><span class="s" style="display:block;margin-top:2px">${fmt(toDate(h.due))}까지</span></span>
          ${d ? "" : `<span class="dday ${n <= 1 && n >= 0 ? "on" : ""}">${ddayText(n)}</span>`}</button>`;
      };
      const pct = hw.length ? Math.round(fin.length / hw.length * 100) : 0;
      return `<h1>숙제</h1><p class="lead">끝낸 숙제를 누르면 체크됩니다. 다시 누르면 취소됩니다.</p>
        <div class="card"><div class="row"><span class="grow t">완료 ${fin.length} / ${hw.length}</span><span class="tag ac">${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
        <h2>할 일 ${todo.length}</h2>
        ${todo.length ? todo.map(item).join("") : `<div class="empty">남은 숙제가 없습니다</div>`}
        ${fin.length ? `<h2>완료 ${fin.length}</h2>${fin.map(item).join("")}` : ""}
        <p class="note">체크 기록은 이 휴대폰에만 저장됩니다.</p>`;
    },

    wrong() {
      const w = loadWrong(), subj = myClass().subject;
      const groups = { retry: w.filter(x => x.retry && !x.solved), all: w.filter(x => !x.solved), solved: w.filter(x => x.solved) };
      const list = groups[wrongFilter];
      const opts = sections(subj).map(s => `<option>${esc(s.no + " " + s.name)}</option>`).join("");
      const subjOpts = Object.keys(D.curriculum).map(s => `<option ${s === subj ? "selected" : ""}>${esc(s)}</option>`).join("");
      const card = x => `<div class="card wrong">
          <div class="row"><span class="no">${esc(x.no)}</span><span class="grow"><span class="t" style="display:block">${esc(x.sec)}</span>
          <span class="s" style="display:block;margin-top:2px">${esc(x.subject)} <span class="tag">${esc(x.why)}</span></span></span></div>
          ${x.memo ? `<div class="s">${esc(x.memo)}</div>` : ""}
          <div class="acts">${x.solved
            ? `<button data-w="unsolve" data-id="${esc(x.id)}">다시 꺼내기</button><button data-w="del" data-id="${esc(x.id)}">삭제</button>`
            : `<button class="${x.retry ? "on" : ""}" data-w="retry" data-id="${esc(x.id)}">${x.retry ? "다시 풀기 ✓" : "다시 풀기 표시"}</button><button data-w="solve" data-id="${esc(x.id)}">해결</button>`}</div>
        </div>`;
      return `<h1>오답노트</h1><p class="lead">틀린 문제를 적어 두고, 다시 풀어서 맞히면 '해결'을 누르세요.</p>
        <details class="add" id="wadd"><summary>+ 오답 추가</summary>
          <form id="wf">
            <label>과목<select id="wsub">${subjOpts}</select></label>
            <label>단원<select id="wsec">${opts}</select></label>
            <label>문항 번호<input id="wno" inputmode="numeric" placeholder="예: 024" required maxlength="10"></label>
            <label>틀린 이유<select id="wwhy">${D.wrongReasons.map(r => `<option>${esc(r)}</option>`).join("")}</select></label>
            <label>메모 (선택)<input id="wmemo" placeholder="예: 부호 실수" maxlength="60"></label>
            <button class="btn ac">추가</button>
          </form></details>
        <div class="chips">
          ${[["retry", "다시 풀 문제"], ["all", "전체"], ["solved", "해결함"]].map(f =>
            `<button class="chip ${wrongFilter === f[0] ? "on" : ""}" data-f="${f[0]}">${f[1]} ${groups[f[0]].length}</button>`).join("")}
        </div>
        ${list.length ? list.map(card).join("") : `<div class="empty">${wrongFilter === "solved" ? "아직 해결한 문제가 없습니다" : "표시된 오답이 없습니다"}</div>`}
        <p class="note">오답 기록은 이 휴대폰에만 저장됩니다.</p>`;
    },

    more() {
      const s = me();
      return `<h1>전체</h1><p class="lead">필요한 메뉴를 고르세요.</p>
        <a class="card row" href="#me">${ic("user").replace("<svg", '<svg style="width:40px;height:40px;fill:none;stroke:#2b4a6f;stroke-width:1.6"')}
          <span class="grow"><span class="t" style="display:block">${esc(s.name)}</span><span class="s" style="display:block;margin:0">${esc(s.grade)} · ${esc(myClass().name)}</span></span><span style="color:var(--soft)">›</span></a>
        <h2>공부</h2>
        <div class="list">
          ${[["class", "수업 · 시간표 · 진도"], ["hw", "숙제"], ["wrong", "오답노트"], ["score", "성적 · 진단평가"]]
            .map(m => `<a href="#${m[0]}">${ic(m[0])}${m[1]}<span class="arr">›</span></a>`).join("")}
        </div>
        <h2>학원</h2>
        <div class="list">
          <a href="#notice">${ic("notice")}공지<span class="arr">›</span></a>
          <a href="#about">${ic("about")}학원 안내 · 위치 · 상담 문의<span class="arr">›</span></a>
          <a href="install.html">${ic("install")}앱 설치 방법<span class="arr">›</span></a>
        </div>
        <p class="note">${esc(NAME)} 앱 시험판 · 가상 학생 데이터</p>`;
    },

    me() {
      const s = me(), c = myClass();
      const rows = [["이름", s.name], ["학교", s.school], ["학년", s.grade], ["반", c.name], ["과목", c.subject]];
      return `<h1>내 정보</h1><p class="lead">시험판에서는 가상 학생 정보가 보입니다.</p>
        <div class="card"><table>${rows.map(r => `<tr><th style="width:64px;color:var(--mid);font-weight:600">${r[0]}</th><td>${esc(r[1])}</td></tr>`).join("")}</table></div>
        <button class="btn line" id="logout" style="margin-top:16px">로그아웃</button>
        <p class="note">로그아웃해도 이 휴대폰에 저장된 숙제 체크·오답 기록은 지워지지 않습니다.</p>`;
    },

    score() {
      const list = D.scores.filter(x => x.studentId === me().id).sort((a, b) => a.date < b.date ? 1 : -1);
      return `<h1>성적 · 진단평가</h1><p class="lead">평가 결과와 단원별 정답률입니다.</p>
        ${list.length ? list.map(x => `<div class="card">
          <div class="row"><span class="grow"><span class="s" style="display:block;margin:0">${fmt(toDate(x.date))} · ${esc(x.kind)}</span>
          <span class="t" style="display:block">${esc(x.title)}</span></span>
          <span class="big">${x.score}<small>/${x.total}</small></span></div>
          <div class="bar gray"><i style="width:${Math.round(x.score / x.total * 100)}%"></i></div>
          <div style="margin-top:14px">${x.units.map(u => `<div class="ur"><span class="nm">${esc(u[0])}</span><span class="bar"><i style="width:${u[1]}%"></i></span><span class="v">${u[1]}%</span></div>`).join("")}</div>
          ${x.comment ? `<div class="box" style="margin-bottom:0">${esc(x.comment)}</div>` : ""}
        </div>`).join("") : `<div class="empty">아직 등록된 결과가 없습니다</div>`}
        <p class="note">시험판 · 가상 성적입니다.</p>`;
    },

    notice() {
      const list = sortedNotices();
      return `<h1>공지</h1><p class="lead">제목을 누르면 내용이 펼쳐집니다.</p>
        ${list.map((n, i) => `<details class="ntc" ${i === 0 ? "open" : ""}><summary><div class="d">${fmt(toDate(n.date))}${n.pin ? ' <span class="tag ac">고정</span>' : ""}</div><div class="t">${esc(n.title)}</div></summary><p>${esc(n.body)}</p></details>`).join("")}`;
    },

    about() {
      const a = D.academy, ct = a.contact;
      return `<h1>학원 안내</h1><p class="lead">${esc(a.name)} · 고등 수학</p>
        <h2>소개</h2>
        <div class="card"><ul class="dot">${a.intro.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
        <h2>수업 방식</h2>
        ${a.method.map((m, i) => `<div class="card"><div class="t"><span style="color:var(--accent)">${i + 1}</span>&nbsp; ${esc(m.title)}</div><div class="s">${esc(m.text)}</div></div>`).join("")}
        <h2>다루는 과목</h2>
        <div class="chips">${a.subjects.map(s => `<span class="chip" style="display:inline-flex;align-items:center">${esc(s)}</span>`).join("")}</div>
        <h2>위치 · 교통</h2>
        <div class="card"><div class="row">${ic("map").replace("<svg", '<svg style="width:28px;height:28px;flex:none;fill:none;stroke:#2b4a6f;stroke-width:1.8"')}<span class="t">${esc(a.location)}</span></div>
          <ul class="dot" style="margin-top:10px">${a.transit.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
          <div class="s" style="margin-top:8px">${esc(a.locationNote)}</div></div>
        <h2>상담 문의</h2>
        <div class="card">
          ${ct.phone ? `<a class="btn ac" href="tel:${esc(ct.phone.replace(/[^0-9]/g, ""))}">전화 ${esc(ct.phone)}</a>` : `<div class="t">연락처 준비 중</div><div class="s">개원 전에 이 화면과 공지로 안내합니다.</div>`}
          ${ct.kakao ? `<a class="btn line" style="margin-top:8px" href="${esc(ct.kakao)}" target="_blank" rel="noopener">카카오톡 상담</a>` : ""}
          <ul class="dot" style="margin-top:12px"><li>${esc(ct.hours)}</li><li>${esc(ct.note)}</li></ul>
        </div>
        <div class="list" style="margin-top:20px"><a href="install.html">${ic("install")}앱 설치 방법<span class="arr">›</span></a></div>`;
    }
  };

  function sortedNotices() {
    return D.notices.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (a.date < b.date ? 1 : -1));
  }
  function latestNotice() { return sortedNotices()[0]; }

  // ── 이벤트 ──
  const BIND = {
    login() {
      $("#lf").onsubmit = e => {
        e.preventDefault();
        // 실제 인증 없음. 비밀번호는 읽지도, 저장하지도 않는다.
        $("#lpw").value = "";
        store.set(K.session, { id: $("#lid").value.trim().slice(0, 30), at: Date.now() });
        location.hash = "#home";
        route();
      };
    },
    hw() {
      document.querySelectorAll("[data-hw]").forEach(b => b.onclick = () => { toggleHW(b.dataset.hw); rerender(); });
    },
    wrong() {
      document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { wrongFilter = b.dataset.f; rerender(); });
      document.querySelectorAll("[data-w]").forEach(b => b.onclick = () => {
        const id = b.dataset.id, a = b.dataset.w;
        updateWrong(id, x => a === "del" ? null
          : a === "retry" ? Object.assign(x, { retry: !x.retry })
          : a === "solve" ? Object.assign(x, { solved: true, retry: false })
          : Object.assign(x, { solved: false, retry: true }));
        rerender();
      });
      const sub = $("#wsub"), sec = $("#wsec");
      sub.onchange = () => { sec.innerHTML = sections(sub.value).map(s => `<option>${esc(s.no + " " + s.name)}</option>`).join(""); };
      $("#wf").onsubmit = e => {
        e.preventDefault();
        const no = $("#wno").value.trim();
        if (!no) return;
        const w = loadWrong();
        w.unshift({ id: "w" + Date.now(), subject: sub.value, sec: sec.value, no: /^\d+$/.test(no) ? no.padStart(3, "0") : no,
          why: $("#wwhy").value, memo: $("#wmemo").value.trim(), retry: true, solved: false });
        store.set(K.wrong, w);
        wrongFilter = "retry";
        route();
      };
    },
    me() {
      $("#logout").onclick = () => { store.del(K.session); location.hash = "#login"; route(); };
    }
  };

  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(() => {}); }
})();
