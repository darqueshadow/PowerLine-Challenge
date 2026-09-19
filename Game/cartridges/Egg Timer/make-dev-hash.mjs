/* ===========================================================================
   make-dev-hash.mjs — the Developer Mode digest for a phrase, from a terminal.

   RUN   node make-dev-hash.mjs              (from this folder; no server, no browser)
         node make-dev-hash.mjs --self-test  (checks itself, asks for nothing)

   It asks for the phrase twice, with the terminal's echo OFF, and prints the
   32-character code to paste into `devModePasswordHash` in files/core/config.js.

   🚫 THE PHRASE NEVER LEAVES THIS PROCESS. It is not taken from the command
   line (that would put it in shell history and in the process list), never
   echoed, never written to a file, and never printed — not even in an error
   message. Only the digest is printed. Honest limit: a JavaScript string
   cannot be wiped from memory, so the guarantee is that the phrase is never
   persisted or displayed anywhere, not that the bytes are scrubbed.

   ⭐ IT DOES NOT REIMPLEMENT THE HASH. It loads files/core/config.js into a VM
   context exactly as verify-egg-timer-logic.mjs does, and calls the game's own
   ET.plcDigest(). If that function ever changes, this tool changes with it and
   cannot drift out of step with what the game will accept.

   The digest trims the phrase and upper-cases it before hashing, so "test",
   "TEST" and "  test  " all give the same code.

   MEASURED AGAINST THE BROWSER 2026-09-18: 18 phrases — case, surrounding and
   doubled spaces, punctuation, digits, a 54-character phrase and accented
   letters — gave byte-identical digests in the page console and here, with a
   control proving the comparison could tell two phrases apart. The four
   vectors below are from that run and --self-test re-checks them.
   ========================================================================= */
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import vm from "node:vm";

const HERE = new URL("./", import.meta.url);
const read = (p) => readFileSync(new URL(p, HERE), "utf8");

/* the game's own config, loaded unchanged — the same shape as the logic rig's load */
const ctx = vm.createContext({ Math, console });
vm.runInContext(read("files/core/config.js"), ctx, { filename: "config.js" });
const ET = ctx.ET;
if (!ET || typeof ET.plcDigest !== "function") {
  console.error("\n  files/core/config.js did not define ET.plcDigest — has it moved?\n");
  process.exit(2);
}

/* --------------------------------------------------------------------------
   Reading the phrase with the echo off.
   ⚠️ Raw mode hands over every keystroke, including the escape sequences the
   arrow keys send. Those must be swallowed WHOLE: dropping only the ESC byte
   would silently push "[A" into the phrase, and the typist would never see it.
   ⚠️ A pipe ends exactly once, so the second prompt can never wait on a second
   "end" — piped input is read in full up front instead.
   -------------------------------------------------------------------------- */
function readAllPiped(stdin) {
  return new Promise((resolve, reject) => {
    let buf = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (d) => { buf += d; });
    stdin.on("end", () => resolve(buf.split(/\r?\n/)));
    stdin.on("error", reject);
  });
}

function askHidden(prompt, stdin = process.stdin) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const chars = [];
    /* 0 = ordinary, 1 = just saw ESC, 2 = inside a CSI/SS3 sequence.
       ⚠️ "[" is the sequence's INTRODUCER, not its final byte. Treating it as
       one ends the escape a character early and pushes the "A" of an Up arrow
       straight into the phrase — which is what the self-test caught. */
    let esc = 0;

    const done = (fn, arg) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      fn(arg);
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (esc === 1) {
          /* ESC [ … and ESC O … are sequences; ESC + anything else is one key
             (Alt+key), so that single character is what gets swallowed */
          esc = (ch === "[" || ch === "O") ? 2 : 0;
          continue;
        }
        if (esc === 2) {
          /* parameter and intermediate bytes first, then the final byte @–~ */
          if (ch >= "@" && ch <= "~") esc = 0;
          continue;
        }
        if (ch === "\u001b") { esc = 1; continue; }
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          const phrase = chars.join("");
          chars.length = 0;
          return done(resolve, phrase);
        }
        if (ch === "\u0003") {                    // Ctrl+C
          chars.length = 0;
          return done(reject, new Error("cancelled"));
        }
        if (ch === "\u007f" || ch === "\b") { chars.pop(); continue; }
        if (ch < " ") continue;                   // any other control key
        chars.push(ch);
      }
    };

    stdin.on("data", onData);
  });
}

/* ------------------------------------------------------------------ self-test
   Proves the two things that could silently corrupt a phrase: the digest this
   file produces, and the keystroke handling nobody can see. */
async function selfTest() {
  let pass = 0, fail = 0;
  const ok = (cond, label) => {
    cond ? pass++ : fail++;
    console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
  };

  console.log("\nA. the digest, against the browser-measured vectors");
  for (const [phrase, want] of [
    ["test", "459b0eda7fe3bb838a9d25f4cacdf4c5"],
    ["EGG TIMER", "206b96fe39c93395de182f3cc60f4613"],
    ["hello world", "b8db07da86a7f125e244f1ec3fd21947"],
    ["café", "8498108367fc2e8e94b386a93cea801c"],
  ]) ok(ET.plcDigest(phrase) === want, `${JSON.stringify(phrase)} → ${want}`);
  ok(ET.plcDigest("test").length === 32, "a digest is 32 characters");
  ok(ET.plcDigest(" TeSt ") === ET.plcDigest("test"), "trimmed and upper-cased before hashing");
  ok(ET.plcDigest("test") !== ET.plcDigest("tset"), "[control] a different phrase gives a different digest");

  console.log("\nB. the keystrokes, through a stand-in terminal");
  const fakeTTY = () => Object.assign(new EventEmitter(), {
    isTTY: true, setRawMode() {}, resume() {}, pause() {}, setEncoding() {},
  });
  const typed = async (keys) => {
    const s = fakeTTY();
    const p = askHidden("  (self-test)  : ", s);
    for (const k of keys) s.emit("data", k);
    return p;
  };
  ok((await typed(["abc\r"])) === "abc", "plain typing, ended by Enter");
  ok((await typed(["a", "b", "c", "\r"])) === "abc", "one keystroke per event, same result");
  ok((await typed(["abX\u007fc\r"])) === "abc", "backspace rubs out the character before it");
  ok((await typed(["ab\u001b[Ac\r"])) === "abc", "an arrow key is swallowed whole, not left as \"[A\"");
  ok((await typed(["a\u001b[1;5Db\r"])) === "ab", "a longer escape sequence too (Ctrl+Left)");
  ok((await typed(["a\tb\r"])) === "ab", "a stray control character is ignored");
  ok((await typed(["a b\r"])) === "a b", "an ordinary space is kept");
  ok((await typed(["café\r"])) === "café", "an accented letter survives");
  ok((await typed(["\r"])) === "", "Enter alone gives an empty phrase, for main to refuse");
  ok((await typed(["abc\n"])) === "abc", "a bare newline ends it too");
  await typed(["abc\r"]).then(() => {});
  let cancelled = false;
  await typed(["ab\u0003"]).catch(() => { cancelled = true; });
  ok(cancelled, "Ctrl+C cancels rather than returning what was typed");

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

if (process.argv.includes("--self-test")) await selfTest();

/* ------------------------------------------------------------------- main */
console.log("\n  Egg Timer — Developer Mode digest");
console.log("  Type the phrase twice. Nothing is shown as you type, and nothing is stored.\n");

let first, second;
try {
  if (process.stdin.isTTY) {
    first = await askHidden("  phrase        : ");
    second = await askHidden("  and again     : ");
  } else {
    /* piped: read once, then hand out the lines. A single piped line answers
       both prompts — a pipe cannot be asked to confirm itself. */
    console.error("  (not a terminal: reading from stdin, with no echo control —");
    console.error("   a piped phrase is in your shell history. Prefer typing it.)");
    const lines = await readAllPiped(process.stdin);
    first = lines[0] ?? "";
    second = lines[1] !== undefined && lines[1] !== "" ? lines[1] : first;
  }
} catch {
  console.log("  cancelled — nothing was written.\n");
  process.exit(1);
}

if (first.trim() === "") {
  console.error("  An empty phrase is not a phrase. Nothing was written.\n");
  process.exit(1);
}

/* compare the DIGESTS, not the two phrases: a difference the hash would ignore
   anyway (case, surrounding spaces) is then not reported as a typo */
const digest = ET.plcDigest(first);
if (digest !== ET.plcDigest(second)) {
  console.error("  The two entries do not match. Nothing was written — run it again.\n");
  process.exit(1);
}

console.log("  digest        : " + digest + "\n");

const current = ET.CONFIG.devModePasswordHash;
if (current === digest) {
  console.log("  That is already the hash set in files/core/config.js.\n");
} else if (current === null) {
  console.log("  config.js currently has devModePasswordHash: null, so Developer Mode");
  console.log("  denies every entry until this code is set there.\n");
} else {
  console.log("  ⚠️ config.js currently holds a DIFFERENT hash, so this phrase is not");
  console.log("  the one Developer Mode accepts today.\n");
}
