#!/usr/bin/env node
/**
 * GEOPOC Agent Workflow Dashboard
 *
 * 사용법:
 *   node scripts/dashboard.js
 *   PORT=3132 node scripts/dashboard.js
 *   node scripts/dashboard.js --snapshot
 *
 * 이 대시보드는 읽기 전용입니다. Claude watcher와 gate 명령은 화면에 표시하지만,
 * 대시보드가 직접 실행하지는 않습니다.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = getPort();

const REQUIRED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "ai/SPEC.md",
  "ai/PLAN.md",
  "ai/RUNBOOK.md",
  "ai/STATUS.md",
  "ai/METRICS.json",
  "scripts/validate.sh",
  "scripts/score-result.sh",
  "scripts/claude-review-gate.sh",
  "scripts/claude-code-review.sh",
  "scripts/watch-claude-gate.sh",
  "scripts/dashboard.js",
  ".codex/config.toml",
  ".codex/skills/implement-milestone/SKILL.md",
  ".codex/skills/review-diff/SKILL.md",
  ".codex/skills/debug-failure/SKILL.md",
  ".codex/skills/update-status/SKILL.md",
];

const COMMANDS = [
  {
    group: "대시보드",
    name: "대시보드 실행",
    shell: "PowerShell",
    command: "node scripts/dashboard.js",
  },
  {
    group: "대시보드",
    name: "대체 포트 실행",
    shell: "PowerShell",
    command: "node scripts/dashboard.js --port 3132",
  },
  {
    group: "로컬 검증",
    name: "기본 검증",
    shell: "PowerShell",
    command: "bash scripts/validate.sh",
  },
  {
    group: "로컬 검증",
    name: "워크플로 점수",
    shell: "PowerShell",
    command: "bash scripts/score-result.sh",
  },
  {
    group: "Claude Gate",
    name: "커밋 감시 watcher",
    shell: "PowerShell",
    command: "bash scripts/watch-claude-gate.sh",
  },
  {
    group: "Claude Gate",
    name: "시작 즉시 현재 커밋 리뷰",
    shell: "PowerShell",
    command: '$env:CLAUDE_WATCH_RUN_ON_START="1"; bash scripts/watch-claude-gate.sh',
  },
  {
    group: "Claude Gate",
    name: "직접 gate 실행",
    shell: "PowerShell",
    command: "bash scripts/claude-review-gate.sh",
  },
];

function abs(rel) {
  return path.join(ROOT, rel);
}

function getPort() {
  const portFlagIndex = process.argv.indexOf("--port");
  if (portFlagIndex >= 0 && process.argv[portFlagIndex + 1]) {
    return Number.parseInt(process.argv[portFlagIndex + 1], 10);
  }

  const inlineFlag = process.argv.find((arg) => arg.startsWith("--port="));
  if (inlineFlag) {
    return Number.parseInt(inlineFlag.slice("--port=".length), 10);
  }

  return Number.parseInt(process.env.PORT || "3131", 10);
}

function readFileSafe(rel) {
  try {
    return fs.readFileSync(abs(rel), "utf8");
  } catch {
    return null;
  }
}

function readJsonSafe(rel) {
  const text = readFileSafe(rel);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readJsonLines(rel) {
  const text = readFileSafe(rel);
  if (!text || !text.trim()) return [];
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function exists(rel) {
  return fs.existsSync(abs(rel));
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function resolveGitDir() {
  const dotGit = abs(".git");
  try {
    const stat = fs.statSync(dotGit);
    if (stat.isDirectory()) return dotGit;
    if (stat.isFile()) {
      const text = fs.readFileSync(dotGit, "utf8").trim();
      const match = text.match(/^gitdir:\s*(.+)$/i);
      if (match) return path.resolve(ROOT, match[1]);
    }
  } catch {
    return null;
  }
  return null;
}

function readPackedRef(gitDir, ref) {
  try {
    const packed = fs.readFileSync(path.join(gitDir, "packed-refs"), "utf8");
    for (const line of packed.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const [sha, packedRef] = line.split(" ");
      if (packedRef === ref) return sha;
    }
  } catch {
    return null;
  }
  return null;
}

function readGitHeadFallback() {
  const gitDir = resolveGitDir();
  if (!gitDir) return { isRepo: false, branch: null, fullSha: null, shortSha: null };

  try {
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (head.startsWith("ref:")) {
      const ref = head.replace(/^ref:\s*/, "");
      const refPath = path.join(gitDir, ...ref.split("/"));
      let fullSha = null;
      try {
        fullSha = fs.readFileSync(refPath, "utf8").trim();
      } catch {
        fullSha = readPackedRef(gitDir, ref);
      }
      const branch = ref.replace(/^refs\/heads\//, "");
      return {
        isRepo: Boolean(fullSha),
        branch,
        fullSha,
        shortSha: fullSha ? fullSha.slice(0, 7) : null,
      };
    }
    return {
      isRepo: /^[a-f0-9]{40}$/i.test(head),
      branch: "detached",
      fullSha: head,
      shortSha: head.slice(0, 7),
    };
  } catch {
    return { isRepo: false, branch: null, fullSha: null, shortSha: null };
  }
}

function parseReview(reviewMd) {
  if (!reviewMd) {
    return {
      exists: false,
      verdict: null,
      commit: null,
      date: null,
      blockers: [],
      warnings: [],
      full: null,
      stale: true,
    };
  }

  const verdictMatch = reviewMd.match(/VERDICT\s*:\s*(PASS|WARN|FAIL)/i);
  const commitMatch = reviewMd.match(/Commit\s*:\s*([a-f0-9]+)/i);
  const dateMatch = reviewMd.match(/Date\s*:\s*(.+)/i);

  return {
    exists: true,
    verdict: verdictMatch ? verdictMatch[1].toUpperCase() : null,
    commit: commitMatch ? commitMatch[1] : null,
    date: dateMatch ? dateMatch[1].trim() : null,
    blockers: extractBullets(reviewMd, ["BLOCKERS", "Blockers", "차단"]),
    warnings: extractBullets(reviewMd, ["WARNINGS", "Warnings", "경고"]),
    full: reviewMd,
    stale: true,
  };
}

function extractBullets(text, headings) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let active = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,4}\s+/.test(trimmed)) {
      active = headings.some((heading) => trimmed.toLowerCase().includes(heading.toLowerCase()));
      continue;
    }
    if (active && /^[-*]\s+/.test(trimmed)) {
      items.push(trimmed.replace(/^[-*]\s+/, ""));
    }
  }

  return items.slice(0, 8);
}

function parsePorcelain(raw) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim() || "modified",
      path: line.slice(3),
    }));
}

function parseNumstat(raw) {
  const totals = { added: 0, deleted: 0, files: 0 };
  if (!raw) return totals;

  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    const [added, deleted] = line.split(/\s+/);
    totals.files += 1;
    totals.added += Number.parseInt(added, 10) || 0;
    totals.deleted += Number.parseInt(deleted, 10) || 0;
  }

  return totals;
}

function parseGitLog(raw) {
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, date, ...message] = line.split("\t");
    return { sha, date, message: message.join("\t") };
  });
}

function buildGitSnapshot() {
  const fallback = readGitHeadFallback();
  const fullSha = git(["rev-parse", "HEAD"]) || fallback.fullSha;
  const shortSha = git(["rev-parse", "--short", "HEAD"]) || fallback.shortSha;
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || fallback.branch;
  const statusRaw = git(["status", "--porcelain=v1"]);
  const files = parsePorcelain(statusRaw);
  const numstatRaw = git(["diff", "--numstat", "HEAD", "--"]);
  const numstat = parseNumstat(numstatRaw);
  const log = parseGitLog(git(["log", "-5", "--pretty=format:%h%x09%ad%x09%s", "--date=iso-strict"]));

  return {
    isRepo: Boolean(fullSha),
    commandAvailable: statusRaw !== null,
    branch,
    fullSha,
    shortSha,
    dirty: statusRaw === null ? null : files.length > 0,
    changedFiles: files,
    diff: {
      available: numstatRaw !== null,
      files: numstat.files,
      added: numstat.added,
      deleted: numstat.deleted,
      lines: numstat.added + numstat.deleted,
    },
    log,
  };
}

function buildReadiness({ metrics, review, gitSnapshot }) {
  const maxFiles = metrics.loop?.max_files_changed_per_loop ?? 8;
  const maxLines = metrics.loop?.max_lines_changed_per_loop ?? 400;
  const changedFileCount = gitSnapshot.changedFiles.length;
  const changedLines = gitSnapshot.diff.lines;
  const statusKnown = gitSnapshot.commandAvailable;
  const diffKnown = gitSnapshot.diff.available;
  const missing = REQUIRED_FILES.filter((file) => !exists(file));
  const reviewMatchesHead =
    review.exists && review.commit && gitSnapshot.fullSha && gitSnapshot.fullSha.startsWith(review.commit);
  const legacyWatcherExists = exists("scripts/review-watcher.sh");

  const checks = [
    {
      id: "required-files",
      label: "필수 워크플로 파일",
      status: missing.length === 0 ? "pass" : "fail",
      detail: missing.length === 0 ? "모두 존재함" : `누락: ${missing.join(", ")}`,
    },
    {
      id: "validation",
      label: "로컬 검증",
      status: metrics.validation?.last_status === "passed" ? "pass" : "warn",
      detail: `${metrics.validation?.last_command || "명령 미기록"} / ${metrics.validation?.last_status || "상태 미기록"}`,
    },
    {
      id: "score",
      label: "워크플로 점수",
      status: (metrics.validation?.last_score ?? 0) >= 90 ? "pass" : "warn",
      detail: `최근 점수 ${metrics.validation?.last_score ?? "미기록"}`,
    },
    {
      id: "review",
      label: "Claude review",
      status: review.exists ? (review.verdict === "FAIL" ? "fail" : reviewMatchesHead ? "pass" : "warn") : "warn",
      detail: review.exists
        ? `${review.verdict || "verdict 없음"} / ${reviewMatchesHead ? "현재 HEAD와 일치" : "현재 HEAD와 불일치 또는 commit 미기록"}`
        : "REVIEW.md 없음",
    },
    {
      id: "watcher",
      label: "Watcher",
      status: metrics.watcher?.available && exists("scripts/watch-claude-gate.sh") ? "pass" : "fail",
      detail: metrics.watcher?.command || "watcher 명령 미기록",
    },
    {
      id: "safety-files",
      label: "파일 변경 예산",
      status: statusKnown ? (changedFileCount <= maxFiles ? "pass" : "fail") : "warn",
      detail: statusKnown ? `${changedFileCount}/${maxFiles} files` : "git status를 실행할 수 없어 알 수 없음",
    },
    {
      id: "safety-lines",
      label: "라인 변경 예산",
      status: diffKnown ? (changedLines <= maxLines ? "pass" : "fail") : "warn",
      detail: diffKnown ? `${changedLines}/${maxLines} lines` : "git diff를 실행할 수 없어 알 수 없음",
    },
    {
      id: "legacy-watcher",
      label: "중복 watcher",
      status: legacyWatcherExists ? "warn" : "pass",
      detail: legacyWatcherExists
        ? "scripts/review-watcher.sh 감지됨. 표준 watcher는 scripts/watch-claude-gate.sh"
        : "중복 watcher 없음",
    },
  ];

  return checks;
}

function buildSnapshot() {
  const metrics = readJsonSafe("ai/METRICS.json") || {};
  const statusMd = readFileSafe("ai/STATUS.md") || "";
  const planMd = readFileSafe("ai/PLAN.md") || "";
  const dashboardSpecMd = readFileSafe("ai/specs/agent-workflow-dashboard.md") || "";
  const history = readJsonLines("ai/LOOP_LOG.jsonl").reverse();
  const gitSnapshot = buildGitSnapshot();
  const review = parseReview(readFileSafe("REVIEW.md"));

  review.stale = !(review.exists && review.commit && gitSnapshot.fullSha && gitSnapshot.fullSha.startsWith(review.commit));

  return {
    project: metrics.project || "GEOPOC",
    timestamp: new Date().toISOString(),
    metrics,
    git: gitSnapshot,
    review,
    history,
    readiness: buildReadiness({ metrics, review, gitSnapshot }),
    commands: COMMANDS,
    docs: {
      status: statusMd,
      plan: planMd,
      dashboardSpec: dashboardSpecMd,
    },
  };
}

function sendJson(res, data) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEOPOC Agent Workflow Dashboard</title>
<style>
:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --panel: #ffffff;
  --panel-alt: #fdfbf7;
  --ink: #1f2937;
  --muted: #667085;
  --line: #d9dee7;
  --soft-line: #edf0f5;
  --teal: #0f766e;
  --blue: #2563eb;
  --amber: #a16207;
  --red: #b42318;
  --violet: #6d28d9;
  --green-bg: #e7f7ef;
  --amber-bg: #fff4d7;
  --red-bg: #fee4e2;
  --blue-bg: #e7efff;
  --code: #111827;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.45;
}
button, input { font: inherit; }
.shell {
  width: min(1440px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 20px 0 28px;
}
.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.kicker {
  color: var(--teal);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
}
h1 {
  margin: 2px 0 4px;
  font-size: 24px;
  line-height: 1.2;
  letter-spacing: 0;
}
.subtle { color: var(--muted); font-size: 13px; }
.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--teal);
}
.summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.metric {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  min-width: 0;
}
.metric-label {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 5px;
}
.metric-value {
  font-size: 18px;
  font-weight: 750;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grid {
  display: grid;
  grid-template-columns: 1.1fr 1.35fr 1fr;
  gap: 12px;
  align-items: start;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 0;
  overflow: hidden;
}
.panel + .panel { margin-top: 12px; }
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--soft-line);
}
.panel-title {
  font-size: 14px;
  font-weight: 750;
}
.panel-body { padding: 12px 14px; }
.step-list {
  display: grid;
  gap: 7px;
}
.step {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 1px solid var(--soft-line);
  border-radius: 7px;
  background: #fff;
}
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--blue-bg);
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
}
.step-name { font-size: 13px; font-weight: 650; }
.step-note { color: var(--muted); font-size: 12px; }
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
.tag.pass { background: var(--green-bg); color: var(--teal); }
.tag.warn { background: var(--amber-bg); color: var(--amber); }
.tag.fail { background: var(--red-bg); color: var(--red); }
.tag.info { background: var(--blue-bg); color: var(--blue); }
.tag.blocked { background: var(--red-bg); color: var(--red); }
.tag.done { background: var(--green-bg); color: var(--teal); }
.tag.active { background: var(--blue-bg); color: var(--blue); }
.tag.planned { background: #eef2f7; color: var(--muted); }
.list {
  display: grid;
  gap: 8px;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid var(--soft-line);
}
.row:last-child { border-bottom: 0; }
.row-title { font-size: 13px; font-weight: 700; }
.row-detail {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
  overflow-wrap: anywhere;
}
.review-box, .doc-box {
  max-height: 330px;
  overflow: auto;
  border: 1px solid var(--soft-line);
  border-radius: 7px;
  background: #fbfcfe;
  padding: 10px;
}
pre {
  margin: 0;
  color: var(--code);
  font-family: "Cascadia Mono", Consolas, ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.history-item {
  border: 1px solid var(--soft-line);
  border-radius: 7px;
  padding: 9px;
  background: #fff;
}
.history-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.mono {
  font-family: "Cascadia Mono", Consolas, ui-monospace, SFMono-Regular, Menlo, monospace;
}
.table-wrap {
  overflow: auto;
  border: 1px solid var(--soft-line);
  border-radius: 7px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th, td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid var(--soft-line);
  vertical-align: top;
}
th { color: var(--muted); font-weight: 750; background: #fbfcfe; }
tr:last-child td { border-bottom: 0; }
.command-list {
  display: grid;
  gap: 8px;
}
.command {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--soft-line);
  border-radius: 7px;
  padding: 8px;
  background: #fff;
}
.command-name { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.command-code {
  font-family: "Cascadia Mono", Consolas, ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.copy {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 12px;
}
.copy:hover { border-color: var(--teal); color: var(--teal); }
.footer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
.empty {
  color: var(--muted);
  font-size: 13px;
  padding: 10px 0;
}
@media (max-width: 1180px) {
  .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .shell { width: min(100vw - 20px, 720px); padding-top: 12px; }
  .topbar { flex-direction: column; }
  .top-actions { justify-content: flex-start; }
  .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-value { font-size: 16px; }
  .step { grid-template-columns: 24px 1fr; }
  .step .tag { grid-column: 2; width: fit-content; }
  .command { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<main class="shell">
  <header class="topbar">
    <div>
      <div class="kicker">Codex first Ralph Loop</div>
      <h1>GEOPOC Agent Workflow</h1>
      <div class="subtle" id="last-updated">로딩 중</div>
    </div>
    <div class="top-actions">
      <span class="pill"><span class="dot"></span>3초 자동 갱신</span>
      <span class="pill" id="branch-pill">branch -</span>
      <span class="pill mono" id="head-pill">HEAD -</span>
    </div>
  </header>

  <section class="summary" aria-label="요약">
    <div class="metric"><div class="metric-label">활성 마일스톤</div><div class="metric-value" id="metric-milestone">-</div></div>
    <div class="metric"><div class="metric-label">로컬 검증</div><div class="metric-value" id="metric-validation">-</div></div>
    <div class="metric"><div class="metric-label">Claude review</div><div class="metric-value" id="metric-review">-</div></div>
    <div class="metric"><div class="metric-label">변경 파일</div><div class="metric-value" id="metric-files">-</div></div>
    <div class="metric"><div class="metric-label">변경 라인</div><div class="metric-value" id="metric-lines">-</div></div>
    <div class="metric"><div class="metric-label">점수</div><div class="metric-value" id="metric-score">-</div></div>
  </section>

  <section class="grid">
    <div>
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Ralph Loop 경로</div>
          <span class="tag info">watcher trigger</span>
        </div>
        <div class="panel-body">
          <div class="step-list" id="loop-steps"></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">실행 명령</div>
          <span class="tag info">복사 전용</span>
        </div>
        <div class="panel-body">
          <div class="command-list" id="command-list"></div>
        </div>
      </section>
    </div>

    <div>
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Gate 준비도</div>
          <span class="tag info" id="dirty-tag">worktree</span>
        </div>
        <div class="panel-body">
          <div class="list" id="readiness-list"></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">마일스톤</div>
          <span class="tag info">ai/METRICS.json</span>
        </div>
        <div class="panel-body">
          <div class="list" id="milestone-list"></div>
        </div>
      </section>
    </div>

    <div>
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">현재 REVIEW.md</div>
          <span class="tag warn" id="review-tag">없음</span>
        </div>
        <div class="panel-body">
          <div class="subtle" id="review-meta"></div>
          <div class="review-box" style="margin-top:8px"><pre id="review-content">REVIEW.md 없음</pre></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">루프 히스토리</div>
          <span class="tag info">ai/LOOP_LOG.jsonl</span>
        </div>
        <div class="panel-body">
          <div class="list" id="history-list"></div>
        </div>
      </section>
    </div>
  </section>

  <section class="footer-grid">
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Git 변경 목록</div>
        <span class="tag info" id="git-count">0</span>
      </div>
      <div class="panel-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>상태</th><th>파일</th></tr></thead>
            <tbody id="file-list"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">상태 문서</div>
        <span class="tag info">ai/STATUS.md</span>
      </div>
      <div class="panel-body">
        <div class="doc-box"><pre id="status-doc"></pre></div>
      </div>
    </section>
  </section>
</main>

<script>
const LOOP_STEPS = [
  ["1", "규칙과 REVIEW.md 읽기", "Codex가 이전 Claude verdict를 먼저 처리"],
  ["2", "마일스톤 하나 선택", "ai/PLAN.md 기준"],
  ["3", "작은 diff 구현", "파일과 라인 예산 안에서 진행"],
  ["4", "validate.sh 실행", "deterministic gate"],
  ["5", "커밋 생성", "watcher가 감지할 단위"],
  ["6", "watch-claude-gate.sh", "새 커밋 감지 후 Claude gate 실행"],
  ["7", "REVIEW.md 확인", "PASS/WARN/FAIL 처리"],
  ["8", "STATUS와 METRICS 갱신", "다음 루프 준비"],
];

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tagClass(status) {
  const value = String(status || "info").toLowerCase();
  if (["pass", "done"].includes(value)) return "tag pass";
  if (["warn", "active"].includes(value)) return "tag warn";
  if (["fail", "blocked"].includes(value)) return "tag fail";
  if (["planned"].includes(value)) return "tag planned";
  return "tag info";
}

function verdictStatus(verdict) {
  const value = String(verdict || "").toUpperCase();
  if (value === "PASS") return "pass";
  if (value === "WARN") return "warn";
  if (value === "FAIL") return "fail";
  return "warn";
}

function formatDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderLoop() {
  byId("loop-steps").innerHTML = LOOP_STEPS.map(function(step) {
    return '<div class="step">' +
      '<span class="step-num">' + escapeHtml(step[0]) + '</span>' +
      '<div><div class="step-name">' + escapeHtml(step[1]) + '</div><div class="step-note">' + escapeHtml(step[2]) + '</div></div>' +
      '<span class="tag info">loop</span>' +
    '</div>';
  }).join("");
}

function renderCommands(commands) {
  byId("command-list").innerHTML = commands.map(function(item) {
    return '<div class="command">' +
      '<div><div class="command-name">' + escapeHtml(item.group + " / " + item.name + " / " + item.shell) + '</div>' +
      '<div class="command-code">' + escapeHtml(item.command) + '</div></div>' +
      '<button class="copy" data-command="' + escapeHtml(item.command) + '">복사</button>' +
    '</div>';
  }).join("");
}

function renderReadiness(checks) {
  byId("readiness-list").innerHTML = checks.map(function(check) {
    return '<div class="row">' +
      '<div><div class="row-title">' + escapeHtml(check.label) + '</div><div class="row-detail">' + escapeHtml(check.detail) + '</div></div>' +
      '<span class="' + tagClass(check.status) + '">' + escapeHtml(check.status) + '</span>' +
    '</div>';
  }).join("");
}

function renderMilestones(metrics) {
  const milestones = metrics.milestones || [];
  if (milestones.length === 0) {
    byId("milestone-list").innerHTML = '<div class="empty">마일스톤 없음</div>';
    return;
  }
  byId("milestone-list").innerHTML = milestones.map(function(ms) {
    return '<div class="row">' +
      '<div><div class="row-title"><span class="mono">' + escapeHtml(ms.id) + '</span> ' + escapeHtml(ms.name) + '</div></div>' +
      '<span class="' + tagClass(ms.status) + '">' + escapeHtml(ms.status) + '</span>' +
    '</div>';
  }).join("");
}

function renderReview(review) {
  const tag = byId("review-tag");
  tag.className = tagClass(verdictStatus(review.verdict));
  tag.textContent = review.exists ? (review.verdict || "verdict 없음") : "없음";

  byId("review-meta").textContent = review.exists
    ? "commit " + (review.commit || "-") + " / " + (review.stale ? "현재 HEAD와 불일치 가능" : "현재 HEAD와 일치")
    : "watcher 또는 Claude gate 실행 후 생성됩니다.";

  byId("review-content").textContent = review.exists
    ? review.full
    : "REVIEW.md 없음\\n\\n권장 실행:\\nbash scripts/watch-claude-gate.sh\\n\\n커밋이 생성되면 watcher가 Claude review gate를 실행합니다.";
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    byId("history-list").innerHTML = '<div class="empty">아직 루프 기록 없음</div>';
    return;
  }

  byId("history-list").innerHTML = history.slice(0, 12).map(function(item) {
    const verdict = item.verdict || "?";
    return '<div class="history-item">' +
      '<div class="history-top"><span class="' + tagClass(verdictStatus(verdict)) + '">' + escapeHtml(verdict) + '</span><span class="subtle">' + escapeHtml(formatDate(item.ts)) + '</span></div>' +
      '<div class="mono subtle">' + escapeHtml(item.sha || "") + '</div>' +
      '<div class="row-detail">' + escapeHtml(item.commit || item.milestone || "") + '</div>' +
    '</div>';
  }).join("");
}

function renderFiles(git) {
  const files = git.changedFiles || [];
  byId("git-count").textContent = git.commandAvailable ? String(files.length) : "unknown";
  if (!git.commandAvailable) {
    byId("file-list").innerHTML = '<tr><td colspan="2" class="empty">현재 환경에서 git status 실행 권한이 없어 변경 목록을 알 수 없음</td></tr>';
    return;
  }
  if (files.length === 0) {
    byId("file-list").innerHTML = '<tr><td colspan="2" class="empty">변경 없음</td></tr>';
    return;
  }
  byId("file-list").innerHTML = files.map(function(file) {
    return '<tr><td class="mono">' + escapeHtml(file.status) + '</td><td class="mono">' + escapeHtml(file.path) + '</td></tr>';
  }).join("");
}

function renderSummary(snapshot) {
  const metrics = snapshot.metrics || {};
  const review = snapshot.review || {};
  const git = snapshot.git || {};
  const validation = metrics.validation || {};

  byId("last-updated").textContent = "마지막 갱신: " + formatDate(snapshot.timestamp);
  byId("branch-pill").textContent = "branch " + (git.branch || "-");
  byId("head-pill").textContent = "HEAD " + (git.shortSha || "-");
  byId("dirty-tag").className = git.dirty === null ? "tag warn" : git.dirty ? "tag warn" : "tag pass";
  byId("dirty-tag").textContent = git.dirty === null ? "unknown" : git.dirty ? "dirty" : "clean";

  byId("metric-milestone").textContent = metrics.active_milestone || "-";
  byId("metric-validation").textContent = validation.last_status || "-";
  byId("metric-review").textContent = review.exists ? (review.verdict || "?") : "없음";
  byId("metric-files").textContent = git.commandAvailable ? String((git.changedFiles || []).length) : "알 수 없음";
  byId("metric-lines").textContent = git.diff?.available ? String(git.diff?.lines ?? 0) : "알 수 없음";
  byId("metric-score").textContent = String(validation.last_score ?? "-");
}

function renderDocs(docs) {
  byId("status-doc").textContent = docs.status || "ai/STATUS.md 없음";
}

async function refresh() {
  const response = await fetch("/api/snapshot", { cache: "no-store" });
  const snapshot = await response.json();
  renderSummary(snapshot);
  renderReadiness(snapshot.readiness || []);
  renderMilestones(snapshot.metrics || {});
  renderReview(snapshot.review || {});
  renderHistory(snapshot.history || []);
  renderFiles(snapshot.git || {});
  renderCommands(snapshot.commands || []);
  renderDocs(snapshot.docs || {});
}

document.addEventListener("click", async function(event) {
  const button = event.target.closest("[data-command]");
  if (!button) return;
  const command = button.getAttribute("data-command");
  try {
    await navigator.clipboard.writeText(command);
    button.textContent = "복사됨";
    setTimeout(function() { button.textContent = "복사"; }, 1200);
  } catch {
    button.textContent = "실패";
    setTimeout(function() { button.textContent = "복사"; }, 1200);
  }
});

renderLoop();
refresh().catch(function(error) {
  byId("last-updated").textContent = "대시보드 갱신 실패: " + error.message;
});
setInterval(function() {
  refresh().catch(function(error) {
    byId("last-updated").textContent = "대시보드 갱신 실패: " + error.message;
  });
}, 3000);
</script>
</body>
</html>`;

if (process.argv.includes("--snapshot")) {
  process.stdout.write(`${JSON.stringify(buildSnapshot(), null, 2)}\n`);
  process.exit(0);
}

if (process.argv.includes("--help")) {
  process.stdout.write("Usage: node scripts/dashboard.js [--snapshot] [--port 3132]\n");
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/api/snapshot" || url.pathname === "/api/status") {
    return sendJson(res, buildSnapshot());
  }

  if (url.pathname === "/api/history") {
    return sendJson(res, buildSnapshot().history);
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(HTML);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[dashboard] http://127.0.0.1:${PORT}`);
  console.log("[dashboard] 종료: Ctrl+C");
});
