# Meitu Supporters Team B Submission Site

메이투 서포터즈 3기 B팀-SNS 콘텐츠 제작팀 제출 사이트입니다.

## 기능

- Supporters 본인 발문 제출
- Meitu 사용자 후기 제출
- 날짜 구간 선택: `6/22-6/28`, `6/29-7/5`, `7/6-7/12`, `7/13-7/19`, `7/20-7/26`
- 담당자 대시보드
- 기간별, 플랫폼별, 유형별 제출 현황
- CSV / JSON 내보내기
- Google Sheets Apps Script 연동 준비

## 로컬 실행

```bash
npm install
npm run dev
```

## Vercel 배포

1. 이 폴더를 GitHub 저장소로 올립니다.
2. Vercel에서 `Add New Project`를 선택합니다.
3. GitHub 저장소를 연결합니다.
4. Framework Preset은 `Vite`로 두고 배포합니다.

## Google Sheets 연동

Vercel 정적 사이트만으로는 여러 사용자의 제출을 중앙 저장할 수 없습니다. 실제 운영에서는 Google Sheets Apps Script 웹앱 URL을 만들어 Vercel 환경 변수에 연결하는 방식을 추천합니다.

### 1. 제출 저장용 Apps Script 만들기

1. Google Sheets를 새로 만듭니다.
2. `확장 프로그램 > Apps Script`를 엽니다.
3. `google-apps-script/Code.gs` 내용을 붙여 넣습니다.
4. `배포 > 새 배포 > 웹 앱`을 선택합니다.
5. 실행 권한은 본인, 접근 권한은 제출자가 접근 가능한 범위로 설정합니다.
6. 생성된 웹앱 URL을 Vercel 환경 변수에 넣습니다.

```text
VITE_SUBMISSION_ENDPOINT=https://script.google.com/macros/s/여기에_웹앱_ID/exec
```

이 설정을 하면 모든 제출이 Google Sheets에 쌓이고, 사용자 후기 캡처 이미지는 Google Drive의 `meitu-team-b-screenshots` 폴더에 저장됩니다.

### 2. 대시보드에서 Sheets 데이터 불러오기

Google Sheets에서 `파일 > 공유 > 웹에 게시`를 선택하고, `submissions` 시트를 CSV로 게시합니다. 생성된 CSV URL을 Vercel 환경 변수에 넣습니다.

```text
VITE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/e/공개_ID/pub?gid=0&single=true&output=csv
```

사이트 대시보드에서 `Sheets 동기화`를 누르면 중앙 시트 데이터를 불러와 기간별/플랫폼별 집계를 확인할 수 있습니다.

환경 변수가 없으면 데이터는 제출자의 현재 브라우저 `localStorage`에만 저장됩니다. 이 모드는 디자인 확인과 로컬 테스트에 적합합니다.

## 추천 운영 방식

- 제출자는 Vercel 사이트에서 폼 제출
- 담당자는 Google Sheets 원본 데이터 확인
- 사이트 대시보드에서는 `Sheets 동기화` 후 집계 확인
- 회차별 마감 후 CSV/JSON으로 백업
