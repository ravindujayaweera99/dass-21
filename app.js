/* Vanilla JS single-page survey runner (DASS-21) mirroring the Shiny flow.
   IMPORTANT: Wordings and colors are preserved from the original R/Shiny UI. */

(function () {
  const cfg = window.APP_CONFIG;
  if (!cfg) {
    console.error("APP_CONFIG not found.");
    return;
  }

  const $ = (sel) => document.querySelector(sel);

  const state = {
    page: 0,              // 0 intro, 1 instructions, 2..4 questions, 5 results
    responses: Array(21).fill(null) // 0..3
  };

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function severityBand(scaleName, score) {
    const cutpoints = cfg.severityCutpoints[scaleName];
    const bands = cfg.severityOrder;
    // findInterval equivalent
    let idx = 0;
    for (let i = 0; i < cutpoints.length; i++) {
      if (score > cutpoints[i]) idx++;
      else break;
    }
    return bands[idx]; // 0..4
  }

  function computeScores() {
    const totals = { Depression: 0, Anxiety: 0, Stress: 0 };
    for (let i = 0; i < 21; i++) {
      const v = state.responses[i];
      if (v === null || Number.isNaN(v)) continue;
      const scale = cfg.subscales[i];
      totals[scale] += v;
    }
    const rows = ["Depression", "Anxiety", "Stress"].map((scale) => {
      const raw = totals[scale];
      return { scale, raw, severity: severityBand(scale, raw) };
    });
    return rows;
  }

  function pickMaxSeverity(rows) {
    // mimic Shiny: match severity order and take max
    const order = cfg.severityOrder;
    let best = rows[0];
    let bestIdx = order.indexOf(rows[0].severity);
    for (const r of rows) {
      const idx = order.indexOf(r.severity);
      if (idx > bestIdx) {
        best = r;
        bestIdx = idx;
      }
    }
    return best;
  }

  function recommendation(scale, severity) {
    const idx = cfg.severityOrder.indexOf(severity);
    const arr = cfg.recommendations[scale];
    return arr && arr[idx] ? arr[idx] : "";
  }

  function renderTitle() {
    $("#app-title").textContent = cfg.title;
  }

  function button(label, onClick, extraClass = "") {
    const b = document.createElement("button");
    b.className = `start-btn no-print ${extraClass}`.trim();
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderIntro0() {
    const root = $("#page");
    root.innerHTML = "";

    const box = document.createElement("div");
    box.className = "content-box";
    box.style.maxWidth = "800px";
    box.style.margin = "100px auto";
    box.style.fontSize = "20px";

    const h1 = document.createElement("h4");
    h1.textContent = cfg.page0.h1;
    h1.setAttribute("style", "color:#004080; font-weight:600; font-size:24px;");
    box.appendChild(h1);

    const p1 = document.createElement("p");
    p1.textContent = cfg.page0.p1;
    box.appendChild(p1);

    const h2 = document.createElement("h4");
    h2.textContent = cfg.page0.h2;
    h2.setAttribute("style", "color:#004080; font-weight:600; font-size:24px;");
    box.appendChild(h2);

    const ul = document.createElement("ul");
    for (const liTxt of cfg.page0.bullets) {
      const li = document.createElement("li");
      li.textContent = liTxt;
      ul.appendChild(li);
    }
    box.appendChild(ul);

    const btnWrap = document.createElement("div");
    btnWrap.className = "center";
    btnWrap.style.marginTop = "25px";
    btnWrap.appendChild(button(cfg.page0.nextLabel, () => { state.page = 1; render(); }));
    box.appendChild(btnWrap);

    root.appendChild(box);

    const ack = document.createElement("div");
    ack.setAttribute("style", "max-width: 800px; margin: 20px auto; text-align:center; font-size:16px; color:#333;");
    ack.textContent = cfg.page0.ack;
    root.appendChild(ack);

    const footer = document.createElement("div");
    footer.setAttribute("style", "display:flex; align-items:center; justify-content:center; gap:15px; margin-top:40px;");

    const img = document.createElement("img");
    img.src = cfg.logo;
    img.width = 80;
    img.style.display = "block";
    footer.appendChild(img);

    const ftText = document.createElement("div");
    ftText.setAttribute("style", "text-align:left;");

    const pL = document.createElement("p");
    pL.textContent = cfg.page0.footerLeft;
    pL.setAttribute("style", "margin: 0; font-weight:600; color:#004080; font-size:14px;");
    const pR = document.createElement("p");
    pR.textContent = cfg.page0.footerRight;
    pR.setAttribute("style", "margin: 0; font-weight:600; color:#004080; font-size:14px;");
    ftText.appendChild(pL);
    ftText.appendChild(pR);

    footer.appendChild(ftText);
    root.appendChild(footer);
  }

  function renderIntro1() {
    const root = $("#page");
    root.innerHTML = "";

    const box = document.createElement("div");
    box.className = "content-box";
    box.style.maxWidth = "800px";
    box.style.margin = "100px auto";
    box.style.fontSize = "15px";

    const p = document.createElement("p");
    p.textContent = cfg.page1.p;
    box.appendChild(p);

    const ul = document.createElement("ul");
    for (const liTxt of cfg.page1.choices) {
      const li = document.createElement("li");
      li.textContent = liTxt;
      ul.appendChild(li);
    }
    box.appendChild(ul);

    const img = document.createElement("img");
    img.src = cfg.page1.image;
    img.style.width = "50%";
    img.setAttribute("style", "display:block; margin:auto; border-radius:10px;");
    box.appendChild(img);

    const nav = document.createElement("div");
    nav.className = "row-between";
    nav.style.marginTop = "25px";
    nav.appendChild(button(cfg.page1.prevLabel, () => { state.page = 0; render(); }));
    nav.appendChild(button(cfg.page1.nextLabel, () => { state.page = 2; render(); }));
    box.appendChild(nav);

    root.appendChild(box);
  }

  function renderQuestionsPage(pageNum) {
    const root = $("#page");
    root.innerHTML = "";

    const box = document.createElement("div");
    box.className = "content-box";

    const startIdx = (pageNum - 2) * 7; // 0-based
    const endIdx = Math.min(startIdx + 7, 21);

    for (let i = startIdx; i < endIdx; i++) {
      const well = document.createElement("div");
      well.className = "well";

      const h = document.createElement("h4");
      h.className = "question-title";
      h.textContent = `Q${i + 1}`;
      well.appendChild(h);

      const p = document.createElement("p");
      p.textContent = cfg.questions[i];
      well.appendChild(p);

      const group = document.createElement("div");
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", `Q${i + 1}`);

      for (const opt of cfg.respChoices) {
        const id = `q${i+1}_v${opt.value}`;
        const wrap = document.createElement("div");
        wrap.style.margin = "6px 0";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = `resp_${i+1}`;
        input.id = id;
        input.value = String(opt.value);
        if (state.responses[i] === opt.value) input.checked = true;
        input.addEventListener("change", () => {
          state.responses[i] = Number(opt.value);
        });

        const label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = opt.label;

        wrap.appendChild(input);
        wrap.appendChild(document.createTextNode(" "));
        wrap.appendChild(label);
        group.appendChild(wrap);
      }

      well.appendChild(group);
      box.appendChild(well);
    }

    const nav = document.createElement("div");
    nav.className = "row-between";
    nav.appendChild(button(cfg.results.prevLabel, () => { state.page = Math.max(0, pageNum - 1); render(); }));
    nav.appendChild(button(cfg.page0.nextLabel, () => { // label differs; for Sinhala/English in questions it's "ඉදිරියට"/"Next"
      state.page = Math.min(5, pageNum + 1);
      render();
    }));
    // Override next label for question pages to match original Shiny ("ඉදිරියට"/"Next")
    nav.lastChild.textContent = cfg.page0.nextLabel;

    box.appendChild(nav);
    root.appendChild(box);
  }

  function renderResults() {
    const root = $("#page");
    root.innerHTML = "";

    const box = document.createElement("div");
    box.className = "content-box";

    const h3 = document.createElement("h3");
    h3.textContent = cfg.results.header;
    h3.setAttribute("style", "color:#003366; font-weight:700; text-align:left;");
    box.appendChild(h3);

    const rows = computeScores();

    // Table
    const table = document.createElement("table");
    table.setAttribute("style", "width:100%; border-collapse:collapse; font-size:16px;");
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    for (const thTxt of cfg.results.tableHeaders) {
      const th = document.createElement("th");
      // mimic left align for first column in Sinhala
      if (thTxt === cfg.results.tableHeaders[0]) {
        th.setAttribute("style", "text-align:left; padding:10px; background:#b30059; color:white;");
      } else {
        th.setAttribute("style", "text-align:center; padding:10px; background:#b30059; color:white;");
      }
      th.textContent = thTxt;
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const r of rows) {
      const sev = (r.severity || "").trim();
      const bg = cfg.results.colorMap[sev] || "#ffffff";
      const fg = (bg === "#ff4d4d" || bg === "#ff944d") ? "#ffffff" : "#000000";

      const tr = document.createElement("tr");

      const tdScale = document.createElement("td");
      tdScale.textContent = cfg.results.scaleLabels[r.scale] || r.scale;
      tdScale.setAttribute("style", `padding:10px; border-bottom:1px solid #ddd; background:${bg}; color:${fg}; text-align:left;`);
      tr.appendChild(tdScale);

      const tdRaw = document.createElement("td");
      tdRaw.textContent = String(r.raw);
      tdRaw.setAttribute("style", `text-align:center; padding:10px; border-bottom:1px solid #ddd; background:${bg}; color:${fg};`);
      tr.appendChild(tdRaw);

      const tdSev = document.createElement("td");
      tdSev.textContent = sev;
      tdSev.setAttribute("style", `text-align:center; padding:10px; border-bottom:1px solid #ddd; background:${bg}; color:${fg};`);
      tr.appendChild(tdSev);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    box.appendChild(table);

    const hr = document.createElement("hr");
    box.appendChild(hr);

    const h4 = document.createElement("h4");
    h4.textContent = cfg.results.recHeader;
    h4.setAttribute("style", "color:#004080; font-weight:600;");
    box.appendChild(h4);

    const best = pickMaxSeverity(rows);
    const recP = document.createElement("p");
    recP.textContent = recommendation(best.scale, best.severity);
    box.appendChild(recP);

    const note = document.createElement("div");
    note.setAttribute("style", "margin-top:20px; padding:15px; background-color:#f9f9f9; border-radius:10px; display:flex; align-items:flex-start; gap:10px;");
    const warn = document.createElement("span");
    warn.textContent = "⚠️";
    warn.setAttribute("style","font-size:20px; line-height:1.2;");
    note.appendChild(warn);

    const noteP = document.createElement("p");
    noteP.appendChild(document.createTextNode(cfg.results.noteText));
    const helpline = document.createElement("span");
    helpline.textContent = cfg.results.helpline;
    helpline.setAttribute("style","color:green; font-weight:bold; font-size:18px;");
    noteP.appendChild(helpline);
    note.appendChild(noteP);
    box.appendChild(note);

    // Videos
    const vidsWrap = document.createElement("div");
    vidsWrap.style.marginTop = "30px";

    const vh = document.createElement("h4");
    vh.textContent = cfg.results.videosHeader;
    vh.setAttribute("style","color:#004080; font-weight:600;");
    vidsWrap.appendChild(vh);

    const vp = document.createElement("p");
    vp.textContent = cfg.results.videosText;
    vidsWrap.appendChild(vp);

    const vids = document.createElement("div");
    vids.setAttribute("style","display:flex; flex-wrap:wrap; gap:20px; justify-content:center;");
    for (const src of cfg.results.videoSrcs) {
      const iframe = document.createElement("iframe");
      iframe.width = "360";
      iframe.height = "215";
      iframe.src = src;
      iframe.title = "Video";
      iframe.frameBorder = "0";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      vids.appendChild(iframe);
    }
    vidsWrap.appendChild(vids);
    box.appendChild(vidsWrap);

    const nav = document.createElement("div");
    nav.className = "row-between";
    nav.style.marginTop = "30px";
    nav.appendChild(button(cfg.results.prevLabel, () => { state.page = 4; render(); }));
    nav.appendChild(button(cfg.results.finishLabel, () => { reset(); render(); }));
    nav.appendChild(button(cfg.results.pdfLabel, () => { window.print(); }));
    box.appendChild(nav);

    root.appendChild(box);
  }

  function reset() {
    state.page = 0;
    state.responses = Array(21).fill(null);
  }

  function render() {
    renderTitle();
    if (state.page === 0) return renderIntro0();
    if (state.page === 1) return renderIntro1();
    if (state.page >= 2 && state.page <= 4) return renderQuestionsPage(state.page);
    if (state.page === 5) return renderResults();
  }

  // Wire up initial
  document.addEventListener("DOMContentLoaded", () => {
    render();
  });
})();