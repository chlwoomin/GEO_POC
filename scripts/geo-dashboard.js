#!/usr/bin/env node
/**
 * GEO 분석 대시보드
 *
 * 사용법:
 *   node scripts/geo-dashboard.js
 *   node scripts/geo-dashboard.js --port 3134
 *
 * API:
 *   GET /             — 대시보드 HTML
 *   GET /api/score    — geo-score.py --json 실행 결과
 *   GET /landing/*    — 랜딩페이지 파일 프록시 (미리보기용)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = (() => {
  const idx = process.argv.indexOf("--port");
  if (idx >= 0 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1], 10);
  const inline = process.argv.find((a) => a.startsWith("--port="));
  if (inline) return parseInt(inline.slice(7), 10);
  return parseInt(process.env.GEO_PORT || "3133", 10);
})();

function abs(rel) {
  return path.join(ROOT, rel);
}

function resolvePython() {
  for (const cmd of ["python3", "python"]) {
    const r = spawnSync(cmd, ["-c", "import sys; sys.exit(0)"], { stdio: "ignore" });
    if (r.status === 0) return cmd;
  }
  return null;
}

function runGeoScore() {
  const python = resolvePython();
  if (!python) {
    return { error: "Python 인터프리터를 찾을 수 없습니다." };
  }
  const scriptPath = abs("scripts/geo-score.py");
  if (!fs.existsSync(scriptPath)) {
    return { error: "scripts/geo-score.py 없음" };
  }
  try {
    const result = spawnSync(python, [scriptPath, "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 15000,
    });
    if (result.error) return { error: String(result.error) };
    const stdout = (result.stdout || "").trim();
    if (!stdout) return { error: result.stderr || "빈 출력" };
    return JSON.parse(stdout);
  } catch (err) {
    return { error: String(err) };
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveLanding(req, res) {
  let urlPath = req.url.replace(/^\/landing/, "") || "/index.html";
  if (urlPath === "" || urlPath === "/") urlPath = "/index.html";
  const filePath = abs("landing" + urlPath.split("?")[0]);
  if (!filePath.startsWith(abs("landing"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function sendJson(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

// ── HTML ─────────────────────────────────────
const HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEO 분석 대시보드</title>
<style>
:root {
  --bg: #f4f6fa;
  --panel: #ffffff;
  --ink: #1a202c;
  --muted: #64748b;
  --line: #e2e8f0;
  --soft: #f8fafc;
  --teal: #0d7377;
  --teal-bg: #e6f7f7;
  --amber: #92400e;
  --amber-bg: #fef3c7;
  --red: #991b1b;
  --red-bg: #fee2e2;
  --green: #065f46;
  --green-bg: #d1fae5;
  --blue: #1e40af;
  --blue-bg: #dbeafe;
  --radius: 10px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: Inter, "Pretendard", ui-sans-serif, system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}
.shell {
  display: grid;
  grid-template-columns: 1fr 420px;
  grid-template-rows: auto 1fr;
  height: 100dvh;
  max-width: 1600px;
  margin: 0 auto;
  gap: 0;
}
/* ── 헤더 ── */
.header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}
.header-left { display: flex; align-items: center; gap: 12px; }
.logo { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: var(--teal); }
.header-sub { font-size: 13px; color: var(--muted); }
.header-actions { display: flex; gap: 8px; align-items: center; }
/* ── 좌측: 분석 결과 ── */
.left-col {
  overflow-y: auto;
  padding: 20px 20px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* ── 우측: 랜딩 미리보기 ── */
.right-col {
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  flex-shrink: 0;
}
.preview-title { font-size: 13px; font-weight: 700; }
iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}
/* ── 공통 패널 ── */
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--soft);
}
.panel-title { font-size: 13px; font-weight: 750; }
.panel-body { padding: 16px; }
/* ── 점수 카드 ── */
.score-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 20px;
  align-items: center;
  padding: 20px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.grade-badge {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 900;
  background: var(--teal-bg);
  color: var(--teal);
}
.grade-badge.B { background: var(--blue-bg); color: var(--blue); }
.grade-badge.C { background: var(--amber-bg); color: var(--amber); }
.grade-badge.D { background: var(--red-bg); color: var(--red); }
.score-nums { display: flex; align-items: baseline; gap: 4px; }
.score-big { font-size: 44px; font-weight: 900; line-height: 1; }
.score-denom { font-size: 18px; color: var(--muted); }
.score-pct {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 750;
  background: var(--teal-bg);
  color: var(--teal);
}
.score-label { font-size: 13px; color: var(--muted); margin-top: 4px; }
/* ── 체크 항목 ── */
.check-list { display: grid; gap: 10px; }
.check-item {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--soft);
}
.check-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.check-name { font-size: 13px; font-weight: 750; }
.check-score-txt { font-size: 13px; font-weight: 750; color: var(--muted); white-space: nowrap; }
.bar-track {
  height: 6px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
  margin-bottom: 6px;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--teal);
  transition: width 0.4s ease;
}
.bar-fill.warn { background: #f59e0b; }
.bar-fill.fail { background: #ef4444; }
.check-detail { font-size: 12px; color: var(--muted); line-height: 1.45; }
/* ── 태그 ── */
.tag {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}
.tag.pass { background: var(--green-bg); color: var(--green); }
.tag.warn { background: var(--amber-bg); color: var(--amber); }
.tag.fail { background: var(--red-bg); color: var(--red); }
.tag.info { background: var(--blue-bg); color: var(--blue); }
/* ── 버튼 ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: var(--panel);
  color: var(--ink);
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}
.btn:hover { border-color: var(--teal); color: var(--teal); background: var(--teal-bg); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: var(--teal); color: #fff; border-color: var(--teal); }
.btn.primary:hover { background: #0a5f63; border-color: #0a5f63; color: #fff; }
/* ── 상태 ── */
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  padding: 4px 0;
}
.spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--line);
  border-top-color: var(--teal);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
/* ── 오류 ── */
.error-box {
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--red-bg);
  color: var(--red);
  font-size: 13px;
}
/* ── 개선 제안 ── */
.suggestion-list { display: grid; gap: 8px; }
.suggestion {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 8px;
  font-size: 13px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  align-items: start;
}
.suggestion:last-child { border-bottom: 0; }
.suggestion-icon { color: var(--amber); font-weight: 900; padding-top: 1px; }
/* ── 반응형 ── */
@media (max-width: 900px) {
  .shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    height: auto;
  }
  .right-col {
    border-left: 0;
    border-top: 1px solid var(--line);
    height: 480px;
  }
}
</style>
</head>
<body>
<div class="shell">

  <header class="header">
    <div class="header-left">
      <span class="logo">GEO 분석</span>
      <span class="header-sub">Generative Engine Optimization · 랜딩페이지 진단</span>
    </div>
    <div class="header-actions">
      <span class="status-row" id="status-row">
        <span class="spinner" id="spinner"></span>
        <span id="status-text">분석 중...</span>
      </span>
      <button class="btn primary" id="run-btn" onclick="runAnalysis()">재분석</button>
    </div>
  </header>

  <div class="left-col">

    <!-- 점수 카드 -->
    <div class="score-card" id="score-card" style="display:none">
      <div class="grade-badge" id="grade-badge">-</div>
      <div>
        <div class="score-nums">
          <span class="score-big" id="score-big">-</span>
          <span class="score-denom" id="score-denom">/100</span>
          <span class="score-pct" id="score-pct">-</span>
        </div>
        <div class="score-label" id="score-label">분석 중</div>
      </div>
    </div>

    <!-- 오류 -->
    <div class="error-box" id="error-box" style="display:none"></div>

    <!-- 체크 항목 -->
    <div class="panel" id="checks-panel" style="display:none">
      <div class="panel-head">
        <span class="panel-title">항목별 점수</span>
        <span class="tag info" id="checks-count">-개 항목</span>
      </div>
      <div class="panel-body">
        <div class="check-list" id="check-list"></div>
      </div>
    </div>

    <!-- 개선 제안 -->
    <div class="panel" id="suggestions-panel" style="display:none">
      <div class="panel-head">
        <span class="panel-title">개선 제안</span>
        <span class="tag warn" id="suggestions-count">-개</span>
      </div>
      <div class="panel-body">
        <div class="suggestion-list" id="suggestion-list"></div>
      </div>
    </div>

  </div>

  <div class="right-col">
    <div class="preview-head">
      <span class="preview-title">랜딩페이지 미리보기</span>
      <a class="btn" href="/landing/" target="_blank">새 탭에서 열기</a>
    </div>
    <iframe src="/landing/" title="랜딩페이지 미리보기" sandbox="allow-same-origin allow-scripts"></iframe>
  </div>

</div>

<script>
const SUGGESTIONS = {
  "JSON-LD 필수 타입": "LegalService, Attorney, Person, FAQPage, LocalBusiness JSON-LD 타입을 모두 추가하세요.",
  "FAQPage JSON-LD 품질": "FAQPage JSON-LD에 8개 이상의 질문을 추가하고 각 답변을 60자 이상으로 작성하세요.",
  "질문형 H2 헤딩": "페이지에 '?'로 끝나는 질문형 H2 헤딩을 5개 이상 추가하세요.",
  "직접 답변 구조": "첫 문단에 법조문이나 판례를 인용하고 종결형 문장으로 핵심 답변을 제시하세요.",
  "법조문·판례 인용 밀도": "민법 조문 6종 이상, 대법원 판결 4건 이상을 본문에 인용하세요.",
  "전문가 엔티티 신호": "Attorney JSON-LD에 이름, knowsAbout, areaServed를 추가하고 본문에 지역명과 등록번호를 포함하세요.",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function byId(id) { return document.getElementById(id); }

function setLoading(loading) {
  byId("spinner").style.display = loading ? "" : "none";
  byId("run-btn").disabled = loading;
  if (loading) byId("status-text").textContent = "분석 중...";
}

function barClass(pct) {
  if (pct >= 80) return "";
  if (pct >= 50) return "warn";
  return "fail";
}

function renderScore(data) {
  if (data.error) {
    byId("error-box").style.display = "";
    byId("error-box").textContent = "오류: " + data.error;
    byId("score-card").style.display = "none";
    byId("checks-panel").style.display = "none";
    byId("suggestions-panel").style.display = "none";
    byId("status-text").textContent = "분석 실패";
    return;
  }

  byId("error-box").style.display = "none";

  // 점수 카드
  const card = byId("score-card");
  card.style.display = "";
  const badge = byId("grade-badge");
  badge.textContent = data.grade;
  badge.className = "grade-badge " + (data.grade !== "A" ? data.grade : "");
  byId("score-big").textContent = data.total;
  byId("score-denom").textContent = "/" + data.max;
  byId("score-pct").textContent = data.pct + "%";
  byId("score-label").textContent =
    data.passed ? "GEO 최적화 기준 통과 (80% 이상)" : "GEO 최적화 기준 미달 (80% 미만)";
  byId("score-pct").style.background = data.passed ? "var(--green-bg)" : "var(--red-bg)";
  byId("score-pct").style.color = data.passed ? "var(--green)" : "var(--red)";

  // 체크 항목
  const checks = data.checks || [];
  byId("checks-panel").style.display = "";
  byId("checks-count").textContent = checks.length + "개 항목";
  byId("check-list").innerHTML = checks.map(function(c) {
    const pct = c.max_score > 0 ? Math.round(c.score / c.max_score * 100) : 0;
    const cls = barClass(pct);
    const tagCls = c.passed ? "pass" : (pct >= 50 ? "warn" : "fail");
    const details = c.detail.split("|").map(function(d) { return d.trim(); });
    return '<div class="check-item">' +
      '<div class="check-top">' +
        '<span class="check-name">' + esc(c.name) + '</span>' +
        '<span class="check-score-txt">' + c.score + ' / ' + c.max_score + 'pt</span>' +
      '</div>' +
      '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '<div class="check-detail">' + details.map(function(d) { return esc(d); }).join(' &nbsp;·&nbsp; ') + '</div>' +
    '</div>';
  }).join("");

  // 개선 제안 (실패한 항목만)
  const failed = checks.filter(function(c) { return !c.passed; });
  if (failed.length > 0) {
    byId("suggestions-panel").style.display = "";
    byId("suggestions-count").textContent = failed.length + "개";
    byId("suggestion-list").innerHTML = failed.map(function(c) {
      const msg = SUGGESTIONS[c.name] || c.detail;
      return '<div class="suggestion"><span class="suggestion-icon">!</span><span>' + esc(msg) + '</span></div>';
    }).join("");
  } else {
    byId("suggestions-panel").style.display = "none";
  }

  byId("status-text").textContent = "마지막 분석: " + new Date().toLocaleTimeString("ko-KR");
  byId("checks-panel").style.display = "";
}

async function runAnalysis() {
  setLoading(true);
  try {
    const res = await fetch("/api/score", { cache: "no-store" });
    const data = await res.json();
    renderScore(data);
  } catch (err) {
    byId("error-box").style.display = "";
    byId("error-box").textContent = "서버 오류: " + err.message;
    byId("status-text").textContent = "오류";
  } finally {
    setLoading(false);
  }
}

runAnalysis();
</script>
</body>
</html>`;

// ── 서버 ─────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/api/score") {
    const data = runGeoScore();
    return sendJson(res, data);
  }

  if (url.pathname.startsWith("/landing")) {
    return serveLanding(req, res);
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(HTML);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

if (process.argv.includes("--help")) {
  process.stdout.write("Usage: node scripts/geo-dashboard.js [--port 3133]\n");
  process.exit(0);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[geo-dashboard] http://127.0.0.1:${PORT}`);
  console.log("[geo-dashboard] 종료: Ctrl+C");
});
