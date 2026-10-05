// 배틀로얄 추첨 페이지 (/who-pays/battle/)
import { startShell } from "../shell.js";
import { startBattle } from "../battle.js";
import { startIntro } from "./intro.js";

startShell({ mode: "battle", start: startBattle, intro: startIntro });
