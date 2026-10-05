// 통아저씨 페이지 (/who-pays/barrel/)
import { startShell } from "../shell.js";
import { startBarrel } from "../barrel.js";
import { startIntro } from "./intro.js";

startShell({ mode: "barrel", start: startBarrel, intro: startIntro });
