'use client';

import { useState, useEffect, useMemo } from 'react';

interface SatisfactionRow {
  fileName: string;
  folderName: string;
  fileLink: string;
  surveyDate: string;
  instructor: string;
  satisfaction: string;
}

function formatSatisfaction(val: string): string {
  const v = (val || '').trim();
  if (!v) return '-';
  const num = parseFloat(v);
  if (!Number.isNaN(num)) return num.toFixed(2);
  return v;
}

export default function EMSatisfactionPage() {
  const [rows, setRows] = useState<SatisfactionRow[]>([]);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [instructorAverages, setInstructorAverages] = useState<Record<string, string>>({});
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/em/satisfaction');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '만족도 데이터를 불러올 수 없습니다.');
        setRows(data.rows || []);
        setInstructors(data.instructors || []);
        setInstructorAverages(data.instructorAverages || {});
        setSelectedInstructor('');
        setSelectedFolder('');
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const folderNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.folderName || '(폴더 없음)'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (selectedInstructor.trim()) {
      list = list.filter((r) => r.instructor === selectedInstructor);
    }
    if (selectedFolder.trim()) {
      list = list.filter((r) => (r.folderName || '(폴더 없음)') === selectedFolder);
    }
    return list;
  }, [rows, selectedInstructor, selectedFolder]);

  const selectedInstructorAverage = useMemo(() => {
    if (!selectedInstructor.trim()) return null;
    const avg = instructorAverages[selectedInstructor];
    return avg != null && avg !== '' ? avg : null;
  }, [selectedInstructor, instructorAverages]);

  const groupedByFolder = useMemo(() => {
    const map = new Map<string, SatisfactionRow[]>();
    for (const row of filteredRows) {
      const key = row.folderName || '(폴더 없음)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">강의 만족도</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            기업·강사별 만족도 조회 (Google 시트 연동)
          </p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">기업</span>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white min-w-[180px] focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
            >
              <option value="">전체</option>
              {folderNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">강사</span>
            <select
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white min-w-[140px] focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
            >
              <option value="">전체</option>
              {instructors.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">
            {filteredRows.length}건
          </span>
        </div>
      </div>

      {/* 강사 선택 시: 기업 교육 평균 만족도 먼저 표시 */}
      {selectedInstructor && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">선택 강사</span>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{selectedInstructor}</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 block">기업 교육 평균 만족도</span>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {selectedInstructorAverage != null
                ? formatSatisfaction(selectedInstructorAverage)
                : '—'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">불러오는 중</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-xs text-gray-500 mt-1">시트 접근 권한을 확인해 주세요.</p>
        </div>
      ) : groupedByFolder.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
          {selectedInstructor || selectedFolder ? '조건에 맞는 데이터가 없습니다.' : '데이터가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByFolder.map(([folderName, folderRows]) => (
            <div key={folderName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="font-medium text-gray-800 text-sm">{folderName}</span>
                <span className="text-xs text-gray-500">{folderRows.length}건</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600">파일명</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-24">강사</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-20">만족도</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-28">설문일시</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-20">링크</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {folderRows.map((row, idx) => (
                      <tr key={`${row.fileName}-${idx}`} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-gray-900 max-w-[320px]">
                          <span className="line-clamp-2" title={row.fileName}>
                            {row.fileName || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{row.instructor || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={
                              /^\d/.test((row.satisfaction || '').trim())
                                ? 'font-medium text-gray-900'
                                : 'text-gray-500'
                            }
                          >
                            {formatSatisfaction(row.satisfaction)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {row.surveyDate === '날짜 없음' ? '—' : row.surveyDate}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {row.fileLink ? (
                            <a
                              href={row.fileLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 hover:text-gray-900 underline"
                            >
                              열기
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
