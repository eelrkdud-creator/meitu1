import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Download,
  ExternalLink,
  FileDown,
  ImagePlus,
  Link as LinkIcon,
  MessageSquareText,
  Send,
  Sparkles,
  UsersRound
} from 'lucide-react';
import './styles.css';

const PERIODS = ['6/22-6/28', '6/29-7/5', '7/6-7/12', '7/13-7/19', '7/20-7/26'];
const PLATFORMS = ['X', 'Threads', 'IG', 'Everytime', '기타'];
const STORAGE_KEY = 'meitu-team-b-submissions';
const SHEETS_ENDPOINT = import.meta.env.VITE_SUBMISSION_ENDPOINT || '';
const SHEET_CSV_URL = import.meta.env.VITE_SHEET_CSV_URL || '';
const MAX_SCREENSHOT_SIDE = 1400;
const LOCAL_SCREENSHOT_LIMIT = 900000;

const initialForm = {
  name: '',
  platform: 'X',
  customPlatform: '',
  link: '',
  description: '',
  screenshotName: '',
  screenshotData: ''
};

function readStoredSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredSubmissions(submissions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

function App() {
  const [step, setStep] = useState('home');
  const [submissionType, setSubmissionType] = useState('');
  const [period, setPeriod] = useState('');
  const [form, setForm] = useState(initialForm);
  const [submissions, setSubmissions] = useState(readStoredSubmissions);
  const [remoteSubmissions, setRemoteSubmissions] = useState([]);
  const [status, setStatus] = useState('');
  const [dashboardStatus, setDashboardStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState('전체');
  const fileInputRef = useRef(null);

  const visibleSubmissions = remoteSubmissions.length > 0 ? remoteSubmissions : submissions;

  const filteredSubmissions = useMemo(() => {
    if (dashboardFilter === '전체') return visibleSubmissions;
    return visibleSubmissions.filter((item) => item.period === dashboardFilter);
  }, [dashboardFilter, visibleSubmissions]);

  const stats = useMemo(() => buildStats(filteredSubmissions), [filteredSubmissions]);

  function resetFlow(nextStep = 'home') {
    setStep(nextStep);
    setSubmissionType('');
    setPeriod('');
    setForm(initialForm);
    setStatus('');
  }

  function chooseType(type) {
    setSubmissionType(type);
    setPeriod('');
    setForm(initialForm);
    setStatus('');
    setStep('period');
  }

  function choosePeriod(selectedPeriod) {
    setPeriod(selectedPeriod);
    setStep('form');
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatus('이미지 파일만 업로드할 수 있어요.');
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      setForm((current) => ({
        ...current,
        screenshotName: file.name,
        screenshotData: dataUrl
      }));
      setStatus('이미지가 첨부되었습니다.');
    } catch {
      setStatus('이미지를 처리하지 못했어요. 다른 캡처 파일로 다시 시도해 주세요.');
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    setStatus('');

    const validation = validateForm(submissionType, form);
    if (validation) {
      setStatus(validation);
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      type: submissionType,
      period,
      supporterName: form.name.trim(),
      platform: submissionType === 'supporter'
        ? form.platform === '기타'
          ? form.customPlatform.trim()
          : form.platform
        : '사용자 후기',
      link: form.link.trim(),
      description: form.description.trim(),
      screenshotName: form.screenshotName,
      screenshotData: form.screenshotData,
      screenshotUrl: '',
      createdAt: new Date().toISOString()
    };

    setIsSending(true);
    try {
      if (SHEETS_ENDPOINT) {
        await fetch(SHEETS_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item)
        });
      }

      const localItem = makeLocalSubmission(item);
      const next = [localItem, ...submissions];
      setSubmissions(next);
      try {
        saveStoredSubmissions(next);
      } catch {
        const lighterNext = [makeLocalSubmission(item, true), ...submissions.map((submission) => makeLocalSubmission(submission, true))];
        setSubmissions(lighterNext);
        saveStoredSubmissions(lighterNext);
      }
      setStatus('제출되었습니다. 담당자 대시보드에도 바로 반영됐어요.');
      setForm(initialForm);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setStatus('전송 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSending(false);
    }
  }

  function exportCsv() {
    downloadFile('meitu-team-b-submissions.csv', toCsv(visibleSubmissions), 'text/csv;charset=utf-8');
  }

  function exportJson() {
    downloadFile(
      'meitu-team-b-submissions.json',
      JSON.stringify(visibleSubmissions, null, 2),
      'application/json;charset=utf-8'
    );
  }

  async function syncFromSheet() {
    if (!SHEET_CSV_URL) {
      setDashboardStatus('Google Sheets CSV URL이 아직 연결되지 않았어요. README의 VITE_SHEET_CSV_URL 설정을 확인해 주세요.');
      return;
    }

    setDashboardStatus('Google Sheets에서 데이터를 불러오는 중입니다.');
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csv = await response.text();
      const parsed = parseSheetCsv(csv);
      setRemoteSubmissions(parsed);
      setDashboardStatus(`Google Sheets 제출 ${parsed.length}건을 불러왔습니다.`);
    } catch {
      setDashboardStatus('Google Sheets 데이터를 불러오지 못했어요. CSV 공개 링크와 접근 권한을 확인해 주세요.');
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="header-copy">
          <p className="eyebrow">Team B Submission Hub</p>
          <h1>
            메이투 서포터즈 3기
            <span>B팀-SNS 콘텐츠 제작팀</span>
          </h1>
        </div>
        <button className="dashboard-toggle" onClick={() => setStep('dashboard')} type="button">
          <BarChart3 size={18} />
          대시보드
        </button>
      </header>

      {step === 'home' && (
        <section className="home-grid" aria-label="제출 유형 선택">
          <button className="choice-panel supporter" onClick={() => chooseType('supporter')} type="button">
            <span className="panel-icon"><Sparkles size={28} /></span>
            <span className="panel-title">Supporters 본인 발문</span>
            <span className="panel-body">
              트렌드 선정, Meitu 연결 방식, 이용자 반응과 기대 효과를 함께 제출합니다.
            </span>
          </button>
          <button className="choice-panel review" onClick={() => chooseType('review')} type="button">
            <span className="panel-icon"><UsersRound size={28} /></span>
            <span className="panel-title">Meitu 사용자 후기</span>
            <span className="panel-body">
              주변 실제 사용자의 SNS 후기 링크와 캡처 이미지를 수집합니다.
            </span>
          </button>
        </section>
      )}

      {step === 'period' && (
        <section className="flow-panel">
          <FlowTop
            title="발문 날짜 구간 선택"
            subtitle={submissionType === 'supporter' ? 'Supporters 본인 발문' : 'Meitu 사용자 후기'}
            onBack={() => resetFlow('home')}
          />
          <div className="period-grid">
            {PERIODS.map((item) => (
              <button key={item} className="period-button" type="button" onClick={() => choosePeriod(item)}>
                <CalendarDays size={20} />
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'form' && (
        <section className="flow-panel">
          <FlowTop
            title={submissionType === 'supporter' ? 'Supporters 본인 발문 제출' : 'Meitu 사용자 후기 제출'}
            subtitle={`선택 기간: ${period}`}
            onBack={() => setStep('period')}
          />

          <form className="submission-form" onSubmit={submitForm}>
            <label>
              <span>{submissionType === 'supporter' ? '姓名 / 이름' : 'Supporters 姓名 / 이름'}</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="예: 김미투"
                required
              />
            </label>

            {submissionType === 'supporter' && (
              <div className="field-row">
                <label>
                  <span>发布平台 / 게시 플랫폼</span>
                  <select
                    value={form.platform}
                    onChange={(event) => updateField('platform', event.target.value)}
                  >
                    {PLATFORMS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                {form.platform === '기타' && (
                  <label>
                    <span>기타 플랫폼</span>
                    <input
                      value={form.customPlatform}
                      onChange={(event) => updateField('customPlatform', event.target.value)}
                      placeholder="플랫폼명을 입력해 주세요"
                    />
                  </label>
                )}
              </div>
            )}

            <label>
              <span>发文 link / 게시물 링크</span>
              <div className="input-with-icon">
                <LinkIcon size={18} />
                <input
                  type="url"
                  value={form.link}
                  onChange={(event) => updateField('link', event.target.value)}
                  placeholder="https://"
                  required
                />
              </div>
            </label>

            {submissionType === 'supporter' ? (
              <label>
                <span>내용 설명</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="선정한 트렌드 및 이슈, 메이투와의 연결 방식, 활용한 SNS·커뮤니티 채널, 이용자 반응 및 기대 효과 등을 포함하여 활동 내용을 작성해 주세요. 또한 어떤 방식으로 메이투의 자연스러운 언급량을 높이고 사용자들의 관심을 유도하고자 했는지도 함께 작성해 주세요."
                  required
                />
              </label>
            ) : (
              <label>
                <span>发文截图 / 게시물 캡처</span>
                <button className="upload-button" type="button" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={18} />
                  {form.screenshotName || '이미지 선택'}
                </button>
                <input ref={fileInputRef} className="hidden-input" type="file" accept="image/*" onChange={handleFile} />
                {form.screenshotData && (
                  <img className="screenshot-preview" src={form.screenshotData} alt="업로드한 게시물 캡처 미리보기" />
                )}
              </label>
            )}

            {status && <p className="form-status">{status}</p>}

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => resetFlow('home')}>
                취소
              </button>
              <button className="primary-button" type="submit" disabled={isSending}>
                <Send size={18} />
                {isSending ? '전송 중' : '제출하기'}
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 'dashboard' && (
        <section className="dashboard">
          <FlowTop
            title="담당자 대시보드"
            subtitle="제출 현황, 플랫폼 분포, 기간별 활동량을 한눈에 확인합니다."
            onBack={() => resetFlow('home')}
          />

          <div className="dashboard-toolbar">
            <label>
              <span>기간 필터</span>
              <select value={dashboardFilter} onChange={(event) => setDashboardFilter(event.target.value)}>
                <option value="전체">전체</option>
                {PERIODS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="toolbar-actions">
              <button className="secondary-button" type="button" onClick={syncFromSheet}>
                <Download size={17} />
                Sheets 동기화
              </button>
              <button className="secondary-button" type="button" onClick={exportCsv}>
                <FileDown size={17} />
                CSV
              </button>
              <button className="secondary-button" type="button" onClick={exportJson}>
                <Download size={17} />
                JSON
              </button>
            </div>
          </div>

          {dashboardStatus && <p className="dashboard-status">{dashboardStatus}</p>}

          <div className="metric-grid">
            <Metric icon={<ClipboardList size={22} />} label="총 제출" value={stats.total} />
            <Metric icon={<Sparkles size={22} />} label="본인 발문" value={stats.supporter} />
            <Metric icon={<MessageSquareText size={22} />} label="사용자 후기" value={stats.review} />
            <Metric icon={<CheckCircle2 size={22} />} label="참여자 수" value={stats.uniquePeople} />
          </div>

          <div className="chart-grid">
            <Chart title="기간별 제출" data={stats.byPeriod} />
            <Chart title="플랫폼별 제출" data={stats.byPlatform} />
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>제출일</th>
                  <th>기간</th>
                  <th>유형</th>
                  <th>이름</th>
                  <th>플랫폼</th>
                  <th>링크</th>
                  <th>내용 / 캡처</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-cell">아직 제출된 내용이 없습니다.</td>
                  </tr>
                ) : (
                  filteredSubmissions.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.period}</td>
                      <td>{item.type === 'supporter' ? '본인 발문' : '사용자 후기'}</td>
                      <td>{item.supporterName}</td>
                      <td>{item.platform}</td>
                      <td>
                        <a href={item.link} target="_blank" rel="noreferrer">
                          열기 <ExternalLink size={14} />
                        </a>
                      </td>
                      <td className="detail-cell">
                        {item.type === 'supporter'
                          ? item.description
                          : item.screenshotUrl
                            ? 'Google Drive 캡처'
                            : item.screenshotName || '캡처 첨부'}
                        {(item.screenshotData || item.screenshotUrl) && (
                          <img
                            className="table-image"
                            src={item.screenshotData || item.screenshotUrl}
                            alt="제출된 캡처"
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <aside className="ops-note">
            <strong>운영 팁</strong>
            <span>
              Vercel에서 여러 사람의 제출을 중앙 수집하려면 Google Sheets Apps Script 웹앱 URL을
              <code>VITE_SUBMISSION_ENDPOINT</code> 환경 변수로 넣어 주세요. 환경 변수가 없을 때는 현재 브라우저에만 저장됩니다.
            </span>
          </aside>
        </section>
      )}
    </main>
  );
}

function FlowTop({ title, subtitle, onBack }) {
  return (
    <div className="flow-top">
      <button className="back-button" type="button" onClick={onBack} aria-label="뒤로가기">
        <ChevronLeft size={20} />
      </button>
      <div>
        <p>{subtitle}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric-card">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Chart({ title, data }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="bars">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildStats(items) {
  const byPeriodMap = countBy(items, 'period');
  const byPlatformMap = countBy(items, 'platform');
  const people = new Set(items.map((item) => item.supporterName).filter(Boolean));

  return {
    total: items.length,
    supporter: items.filter((item) => item.type === 'supporter').length,
    review: items.filter((item) => item.type === 'review').length,
    uniquePeople: people.size,
    byPeriod: PERIODS.map((period) => ({ label: period, value: byPeriodMap[period] || 0 })),
    byPlatform: Object.entries(byPlatformMap).map(([label, value]) => ({ label, value }))
  };
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key] || '미입력';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function validateForm(type, form) {
  if (!form.name.trim()) return '이름을 입력해 주세요.';
  if (!form.link.trim()) return '게시물 링크를 입력해 주세요.';
  if (type === 'supporter' && form.platform === '기타' && !form.customPlatform.trim()) {
    return '기타 플랫폼명을 입력해 주세요.';
  }
  if (type === 'supporter' && !form.description.trim()) return '내용 설명을 입력해 주세요.';
  if (type === 'review' && !form.screenshotData) return '게시물 캡처 이미지를 첨부해 주세요.';
  return '';
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, MAX_SCREENSHOT_SIDE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeLocalSubmission(item, forceRemoveScreenshot = false) {
  const shouldKeepScreenshot = item.screenshotData
    && item.screenshotData.length <= LOCAL_SCREENSHOT_LIMIT
    && !forceRemoveScreenshot;

  return {
    ...item,
    screenshotData: shouldKeepScreenshot ? item.screenshotData : ''
  };
}

function toCsv(items) {
  const headers = ['createdAt', 'period', 'type', 'supporterName', 'platform', 'link', 'description', 'screenshotName', 'screenshotUrl'];
  const rows = items.map((item) => headers.map((key) => quoteCsv(item[key] || '')).join(','));
  return `${headers.join(',')}\n${rows.join('\n')}`;
}

function parseSheetCsv(csv) {
  const rows = parseCsvRows(csv);
  const [headers, ...dataRows] = rows;
  if (!headers) return [];

  return dataRows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])))
    .filter((row) => row.id || row.link)
    .map((row) => ({
      id: row.id || crypto.randomUUID(),
      createdAt: row.receivedAt || row.createdAt || new Date().toISOString(),
      type: row.type || 'supporter',
      period: row.period || '',
      supporterName: row.supporterName || '',
      platform: row.platform || '',
      link: row.link || '',
      description: row.description || '',
      screenshotName: row.screenshotName || '',
      screenshotUrl: row.screenshotUrl || '',
      screenshotData: ''
    }))
    .reverse();
}

function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((items) => items.some(Boolean));
}

function quoteCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

createRoot(document.getElementById('root')).render(<App />);
