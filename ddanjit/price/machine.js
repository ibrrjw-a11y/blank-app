// 3번 기계(그때 그 가격) 전용: 하단 링크를 진열대 가격표로
import { $ } from "../../shared/kit.js";

export function machine() {
  const title = $("#more .more-sites__title");
  if (title) title.textContent = "옆 진열대";
}
