// 2번 기계(오늘의 동네) 전용: 하단 링크를 도로 이정표로
import { $ } from "../../shared/kit.js";

export function machine() {
  const title = $("#more .more-sites__title");
  if (title) title.textContent = "이 길로 가면 옆 기계";
}
