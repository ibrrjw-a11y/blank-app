// 구슬 레이스 페이지 (/who-pays/)
import { startShell } from "./shell.js";
import { startIntro } from "./intro.js";
import { startRace } from "./race.js";

startShell({ mode: "race", start: startRace, intro: startIntro });
