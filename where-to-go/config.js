// 어디가? 선택 설정
//
// kakaoJsKey: 카카오맵 JavaScript 키 (비워 두면 OpenStreetMap → 내장 메뉴 순으로 자동 대체돼요)
//
// 키를 쓰려면
//  1. https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가
//  2. 앱 설정 → 앱 키 → "JavaScript 키"를 아래에 붙여넣기 (REST API 키나 Admin 키는 절대 넣지 마세요)
//  3. 앱 설정 → 플랫폼 → Web → "사이트 도메인"에 배포 주소를 등록 (예: https://example.com)
//     등록하지 않은 도메인에서는 SDK가 거절돼서 자동으로 OpenStreetMap을 써요.
//  4. 제품 설정 → 카카오맵 사용 설정을 켜기
//
// JavaScript 키는 브라우저에 노출되는 공개 키예요. 도메인 등록으로만 보호되니 꼭 3번을 해 주세요.
export const kakaoJsKey = "";
