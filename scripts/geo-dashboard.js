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
 *   GET /api/score?mode=dev|persona|prod — geo-score.py --json 실행 결과
 *   GET /landing/*    — 랜딩페이지 파일 프록시 (미리보기용)
 */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = (() => {
  const idx = process.argv.indexOf("--port");
  if (idx >= 0 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1], 10);
  const inline = process.argv.find((a) => a.startsWith("--port="));
  if (inline) return parseInt(inline.slice(7), 10);
  return parseInt(process.env.GEO_PORT || "3133", 10);
})();

function getScoreMode() {
  const idx = process.argv.indexOf("--mode");
  if (idx >= 0 && process.argv[idx + 1]) return normalizeMode(process.argv[idx + 1]);
  const inline = process.argv.find((a) => a.startsWith("--mode="));
  if (inline) return normalizeMode(inline.slice(7));
  return normalizeMode(process.env.GEO_SCORE_MODE || "dev");
}

function normalizeMode(mode) {
  return ["dev", "persona", "prod"].includes(mode) ? mode : "dev";
}

function abs(rel) {
  return path.join(ROOT, rel);
}

function bundledPythonPath() {
  return path.join(
    os.homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    process.platform === "win32" ? "python.exe" : "bin/python"
  );
}

function resolvePython() {
  const candidates = [];
  for (const envName of ["GEO_PYTHON", "PYTHON"]) {
    if (process.env[envName]) {
      candidates.push({ command: process.env[envName], prefix: [], label: envName });
    }
  }

  const bundled = bundledPythonPath();
  if (fs.existsSync(bundled)) {
    candidates.push({ command: bundled, prefix: [], label: "codex-bundled-python" });
  }

  candidates.push(
    { command: "python3", prefix: [], label: "python3" },
    { command: "python", prefix: [], label: "python" },
    { command: "py", prefix: ["-3"], label: "py -3" }
  );

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.prefix, "-c", "import sys; sys.exit(0)"], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function runGeoScore(mode) {
  const python = resolvePython();
  if (!python) {
    return scoreWithJsFallback(mode, "Python 인터프리터를 찾을 수 없음");
  }
  const scriptPath = abs("scripts/geo-score.py");
  if (!fs.existsSync(scriptPath)) {
    return { error: "scripts/geo-score.py 없음" };
  }
  try {
    const result = spawnSync(python.command, [...python.prefix, scriptPath, "--json", "--mode", mode], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
    });
    if (result.error) return scoreWithJsFallback(mode, String(result.error));
    const stdout = (result.stdout || "").trim();
    if (!stdout) return scoreWithJsFallback(mode, result.stderr || "빈 출력");
    const parsed = JSON.parse(stdout);
    parsed.python = python.label;
    parsed.source = "python";
    return parsed;
  } catch (err) {
    return scoreWithJsFallback(mode, String(err));
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

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasPersonaDisclosure(html) {
  const text = stripHtml(html);
  const hasDemoContext = text.includes("데모") || text.includes("가상의") || text.includes("가상");
  const clearNotService = [
    "실제 법률 서비스가 아닙니다",
    "실제로 전송되지",
    "변호사·사무소 정보는 가상",
    "AI GEO 테스트",
  ].some((phrase) => text.includes(phrase));
  return hasDemoContext && clearNotService;
}

function extractJsonLd(html) {
  const payloads = [];
  const errors = [];
  const re = /<script\s+type=["']application\/ld\+json["']>\s*([\s\S]*?)\s*<\/script>/gi;
  let match;
  let index = 0;
  while ((match = re.exec(html))) {
    index += 1;
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payloads.push(parsed);
      } else {
        errors.push(`JSON-LD block ${index}: root must be an object`);
      }
    } catch (err) {
      errors.push(`JSON-LD block ${index}: ${err.message}`);
    }
  }
  return { payloads, errors };
}

function flattenNodes(value) {
  const nodes = [];
  if (Array.isArray(value)) {
    for (const item of value) nodes.push(...flattenNodes(item));
    return nodes;
  }
  if (value && typeof value === "object") {
    if (value["@type"]) nodes.push(value);
    for (const child of Object.values(value)) nodes.push(...flattenNodes(child));
  }
  return nodes;
}

function allTypes(payloads) {
  const found = new Set();
  for (const payload of payloads) {
    for (const node of flattenNodes(payload)) {
      const type = node["@type"];
      if (Array.isArray(type)) type.forEach((item) => found.add(String(item)));
      else if (type) found.add(String(type));
    }
  }
  return found;
}

function makeCheck(name, score, maxScore, detail, passed, critical = false) {
  return {
    name,
    score,
    max_score: maxScore,
    detail,
    passed,
    critical,
  };
}

function scoreWithJsFallback(mode, reason) {
  const htmlPath = abs("landing/index.html");
  if (!fs.existsSync(htmlPath)) {
    return { error: "landing/index.html 없음", fallback_reason: reason };
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const text = stripHtml(html);
  const { payloads, errors } = extractJsonLd(html);
  const nodes = payloads.flatMap(flattenNodes);
  const types = allTypes(payloads);
  const checks = [];

  const requiredTypes = ["LegalService", "Attorney", "Person", "FAQPage", "LocalBusiness"];
  const presentTypes = requiredTypes.filter((type) => types.has(type));
  const missingTypes = requiredTypes.filter((type) => !types.has(type));
  checks.push(makeCheck(
    "JSON-LD 필수 타입",
    errors.length ? 0 : Math.floor((presentTypes.length / requiredTypes.length) * 20),
    20,
    `필수 타입 ${presentTypes.length}/${requiredTypes.length}개 존재` +
      (missingTypes.length ? ` | 누락: ${missingTypes.join(", ")}` : "") +
      (errors.length ? ` | JSON-LD 오류: ${errors.slice(0, 3).join("; ")}` : ""),
    missingTypes.length === 0 && errors.length === 0,
    true
  ));

  const questions = nodes.filter((node) => node["@type"] === "Question");
  const longAnswers = questions.filter((q) => String(q.acceptedAnswer?.text || "").length >= 60);
  checks.push(makeCheck(
    "FAQPage JSON-LD 품질",
    Math.floor((Math.min(questions.length, 8) / 8) * 8 + (Math.min(longAnswers.length, 8) / 8) * 4),
    12,
    `FAQ 질문 ${questions.length}개 (목표 8개+) | 60자+ 직접 답변 ${longAnswers.length}개`,
    questions.length >= 8 && longAnswers.length >= 6,
    true
  ));

  const h2Matches = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripHtml(m[1]));
  const questionH2 = h2Matches.filter((heading) => /[?]|나요|인가요|하나요|보나요|언제|무엇/.test(heading));
  checks.push(makeCheck(
    "질문형 H2 헤딩",
    Math.floor((Math.min(questionH2.length, 6) / 6) * 12),
    12,
    `질문형 H2 ${questionH2.length}개 (목표 5개+) | ${questionH2.slice(0, 3).join(", ") || "없음"}`,
    questionH2.length >= 5
  ));

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 8).map((m) => stripHtml(m[1]));
  const earlyLaw = paragraphs.slice(0, 4).some((p) => /민법 제\d+조|대법원|판결|결정/.test(p));
  const directAnswer = paragraphs.slice(0, 4).some((p) => /(합니다|됩니다|입니다|없습니다|있습니다)\.?/.test(p));
  const directScore = (earlyLaw ? 5 : 0) + (directAnswer ? 5 : 0);
  checks.push(makeCheck(
    "직접 답변 구조",
    directScore,
    10,
    [
      earlyLaw ? "초반 문단에 법조문/판례 포함 +5" : null,
      directAnswer ? "문장 종결형 직접 답변 포함 +5" : null,
    ].filter(Boolean).join(" | ") || "직접 답변 신호 미검출",
    directScore >= 7
  ));

  const laws = new Set(text.match(/민법 제\d+조(?:의\d+)?(?:\s*제\d+항)?/g) || []);
  const caseDates = new Set(text.match(/대법원\s+\d{4}\.\s*\d+\.\s*\d+\./g) || []);
  const caseNums = new Set(text.match(/\d{2,4}[므스]\d+/g) || []);
  const citationScore = Math.floor((Math.min(laws.size, 6) / 6) * 8 + (Math.min(caseDates.size + caseNums.size, 4) / 4) * 7);
  checks.push(makeCheck(
    "법조문·판례 인용 밀도",
    citationScore,
    15,
    `법조문 ${laws.size}종 | 대법원 판결일 ${caseDates.size}건 | 사건번호 ${caseNums.size}건`,
    citationScore >= 11,
    true
  ));

  const attorney = nodes.find((node) => String(node["@type"]).includes("Attorney"));
  let entityScore = 0;
  const entityDetails = [];
  if (attorney) {
    entityScore += 3;
    entityDetails.push(`Attorney 엔티티: ${attorney.name || ""} +3`);
    if (Array.isArray(attorney.knowsAbout) && attorney.knowsAbout.length >= 3) {
      entityScore += 2;
      entityDetails.push(`knowsAbout ${attorney.knowsAbout.length}개 +2`);
    }
  }
  const areaNode = nodes.find((node) => node.areaServed);
  if (areaNode) {
    entityScore += 2;
    entityDetails.push(`areaServed: ${JSON.stringify(areaNode.areaServed)} +2`);
  }
  if (/서울|서초구|강남구|경기|인천/.test(html)) {
    entityScore += 2;
    entityDetails.push("지역명 본문 포함 +2");
  }
  if (/identifier|등록번호/i.test(html)) {
    entityScore += 1;
    entityDetails.push("등록번호 필드 존재 +1");
  }
  checks.push(makeCheck(
    "전문가 엔티티 신호",
    Math.min(entityScore, 10),
    10,
    entityDetails.join(" | ") || "엔티티 신호 미검출",
    entityScore >= 7
  ));

  const forbidden = ["100% 승소", "반드시 승소", "무조건 승소", "최고 변호사", "1위", "보장합니다", "결과를 보장"].filter((phrase) => html.includes(phrase));
  checks.push(makeCheck(
    "변호사 광고 리스크",
    forbidden.length ? 0 : 8,
    8,
    forbidden.length ? `위험 표현: ${forbidden.join(", ")}` : "금지/고위험 표현 없음",
    forbidden.length === 0,
    true
  ));

  const robotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const robots = robotsMatch ? robotsMatch[1].toLowerCase() : "";
  const blocked = robots.includes("noindex") || robots.includes("nofollow");
  if (mode === "persona") {
    const protectedByRobots = robots.includes("noindex") && robots.includes("nofollow");
    checks.push(makeCheck(
      "페르소나 색인 보호",
      protectedByRobots ? 7 : 0,
      7,
      (robots ? `robots meta: ${robots}` : "robots meta 없음") +
        " | persona 모드에서는 검색 노출 방지를 위해 noindex,nofollow가 필요",
      protectedByRobots,
      true
    ));
  } else {
    checks.push(makeCheck(
      "색인 가능성",
      blocked ? 0 : 7,
      7,
      (robots ? `robots meta: ${robots}` : "robots meta 없음") +
        (blocked && mode === "dev" ? " | dev 모드에서는 데모 보호용 noindex를 경고로 처리" : ""),
      !blocked,
      mode === "prod"
    ));
  }

  const demoMarkers = ["데모", "가상의", "제XXXXX", "local.example", "02-000-0000", "010-0000-0000", "000-0000", "데모 주소"]
    .filter((marker) => html.includes(marker));
  if (mode === "persona") {
    const disclosed = hasPersonaDisclosure(html);
    checks.push(makeCheck(
      "페르소나 데모 고지",
      demoMarkers.length && !disclosed ? 0 : 6,
      6,
      (demoMarkers.length ? `데모 marker: ${demoMarkers.slice(0, 8).join(", ")}` : "데모/placeholder 없음") +
        " | persona 모드에서는 명확한 가상 페이지/비서비스 고지가 필요",
      demoMarkers.length === 0 || disclosed,
      true
    ));
  } else {
    checks.push(makeCheck(
      "데모 데이터 배포 차단",
      demoMarkers.length ? 0 : 6,
      6,
      demoMarkers.length
        ? `데모 marker: ${demoMarkers.slice(0, 8).join(", ")}` + (mode === "dev" ? " | dev 모드에서는 경고로 처리" : "")
        : "데모/placeholder 없음",
      demoMarkers.length === 0,
      mode === "prod"
    ));
  }

  const total = checks.reduce((sum, check) => sum + check.score, 0);
  const max = checks.reduce((sum, check) => sum + check.max_score, 0);
  const pct = max ? Math.floor((total / max) * 100) : 0;
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : "D";
  const passThreshold = mode === "dev" ? 80 : 90;
  const criticalFailures = checks.filter((check) => check.critical && !check.passed).map((check) => check.name);

  return {
    mode,
    total,
    max,
    pct,
    grade,
    passed: pct >= passThreshold && criticalFailures.length === 0,
    pass_threshold: passThreshold,
    critical_failures: criticalFailures,
    checks,
    source: "javascript-fallback",
    fallback_reason: reason,
  };
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
  "페르소나 색인 보호": "persona staging 페이지는 robots meta에 noindex,nofollow를 유지하세요.",
  "페르소나 데모 고지": "가상 인물·가상 사무소·실제 법률 서비스가 아님을 첫 화면과 폼 근처에 명확히 표시하세요.",
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
  const modeLabel = data.mode === "persona" ? "persona staging" : data.mode;
  byId("score-label").textContent =
    data.passed
      ? "GEO " + modeLabel + " 기준 통과 (" + data.pass_threshold + "% 이상)"
      : "GEO " + modeLabel + " 기준 미달 또는 critical failure";
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
    const mode = url.searchParams.get("mode") || process.env.GEO_SCORE_MODE || "dev";
    const data = runGeoScore(normalizeMode(mode));
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
  process.stdout.write("Usage: node scripts/geo-dashboard.js [--port 3133] [--score-json --mode dev|persona|prod]\n");
  process.exit(0);
}

if (process.argv.includes("--score-json")) {
  const data = runGeoScore(getScoreMode());
  process.stdout.write(`${JSON.stringify(data)}\n`);
  if (data.error) process.exit(2);
  process.exit(data.passed ? 0 : 1);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[geo-dashboard] http://127.0.0.1:${PORT}`);
  console.log("[geo-dashboard] 종료: Ctrl+C");
});
