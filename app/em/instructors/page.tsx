'use client';

import React, { useState, useEffect } from 'react';

interface InstructorInfo {
  rowIndex: number;
  name: string;
  affiliation: string;
  mobile: string;
  email: string;
  fee: string;
  notes: string;
  [key: string]: string | number;
}

interface InstructorPerformance {
  name: string;
  mainClients: string;
  sessionCount: string;
}

const GOOGLE_DRIVE_FOLDER_ID = '1w218kHL14yR1pCZSXHUD3VoY5q3EIj2c';
const GOOGLE_DRIVE_BASE_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`;

function formatMainClients(text: string): React.ReactNode {
  if (!text.trim()) return <span className="text-gray-400">—</span>;
  const parts = text.split(/(?=\[)/).map((s) => s.trim()).filter(Boolean);
  return (
    <div className="space-y-2 text-sm text-gray-700">
      {parts.map((block, i) => {
        const isSection = block.startsWith('[');
        return (
          <div key={i} className={isSection ? 'font-medium text-gray-800 mt-2 first:mt-0' : ''}>
            {block}
          </div>
        );
      })}
    </div>
  );
}

export default function EMInstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorInfo[]>([]);
  const [performance, setPerformance] = useState<InstructorPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InstructorInfo | null>(null);
  const [hideList, setHideList] = useState(false); // true면 드롭다운에서 선택한 경우 → 목록 숨김
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [infoRes, perfRes] = await Promise.all([
        fetch('/api/em/instructors-info'),
        fetch('/api/em/instructor-performance'),
      ]);
      if (!infoRes.ok) throw new Error('강사 목록을 불러올 수 없습니다.');
      const infoData = await infoRes.json();
      setInstructors(infoData.instructors || []);

      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setPerformance(perfData.performance || []);
      } else {
        setPerformance([]);
      }

      setSelected(null);
      setHideList(false);
      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getPerformance = (instructorName: string): InstructorPerformance | undefined => {
    const n = (instructorName || '').trim();
    return performance.find((p) => (p.name || '').trim() === n);
  };

  const startEdit = (rowIndex: number, column: string, currentValue: string) => {
    setEditingCell({ rowIndex, column });
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const columnMap: { [key: string]: number } = {
      name: 0,
      affiliation: 1,
      mobile: 6,
      email: 7,
      fee: 8,
      notes: 12,
    };
    const columnIndex = columnMap[editingCell.column];
    if (columnIndex === undefined) {
      cancelEdit();
      return;
    }
    try {
      const res = await fetch('/api/em/instructors-info/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: editingCell.rowIndex, columnIndex, value: editValue }),
      });
      if (!res.ok) throw new Error('업데이트에 실패했습니다.');
      setInstructors((prev) =>
        prev.map((inst) =>
          inst.rowIndex === editingCell.rowIndex ? { ...inst, [editingCell.column]: editValue } : inst
        )
      );
      if (selected?.rowIndex === editingCell.rowIndex) {
        setSelected((prev) =>
          prev ? { ...prev, [editingCell.column]: editValue } : null
        );
      }
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const Editable = ({
    value,
    column,
    rowIndex,
    children,
    inputType = 'text',
    multiline = false,
  }: {
    value: string;
    column: string;
    rowIndex: number;
    children: React.ReactNode;
    inputType?: string;
    multiline?: boolean;
  }) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column;
    if (isEditing) {
      const common = {
        value: editValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
        onBlur: saveEdit,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Escape') cancelEdit();
          if (e.key === 'Enter' && !multiline) saveEdit();
          if (e.key === 'Enter' && e.ctrlKey && multiline) saveEdit();
        },
        className: 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white',
        autoFocus: true,
      };
      return multiline ? (
        <textarea {...common} rows={3} />
      ) : (
        <input type={inputType} {...common} />
      );
    }
    return (
      <div
        className="cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1"
        onClick={(e) => { e.stopPropagation(); startEdit(rowIndex, column, value); }}
      >
        {children}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">강사 현황</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            강사를 선택하면 상세 정보와 강사 실적(출강 횟수, 주요 고객사)을 볼 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            새로고침
          </button>
          <a
            href={GOOGLE_DRIVE_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700"
          >
            드라이브
          </a>
        </div>
      </div>

      {/* 강사 선택 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">강사 선택</label>
        <select
          value={selected?.rowIndex ?? ''}
          onChange={(e) => {
            const rowIndex = Number(e.target.value);
            if (!rowIndex) {
              setSelected(null);
              setHideList(false);
              return;
            }
            const inst = instructors.find((i) => i.rowIndex === rowIndex);
            setSelected(inst ?? null);
            setHideList(true);
          }}
          className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
        >
          <option value="">선택하세요</option>
          {instructors.map((inst) => (
            <option key={inst.rowIndex} value={inst.rowIndex}>
              {inst.name} {inst.affiliation ? `(${inst.affiliation})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!hideList && (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <span className="text-sm font-medium text-gray-700">총 {instructors.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">강사명</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">소속</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 min-w-[200px]">특이사항</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {instructors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-gray-500">
                    강사 목록이 없습니다.
                  </td>
                </tr>
              ) : (
                instructors.map((inst) => {
                  const isSelected = selected?.rowIndex === inst.rowIndex;
                  return (
                    <tr
                      key={inst.rowIndex}
                      onClick={() => {
                        setSelected(inst);
                        setHideList(false);
                      }}
                      className={`cursor-pointer ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {inst.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        <Editable value={inst.affiliation} column="affiliation" rowIndex={inst.rowIndex}>
                          {inst.affiliation || '—'}
                        </Editable>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[280px]">
                        <Editable value={inst.notes} column="notes" rowIndex={inst.rowIndex} multiline>
                          {inst.notes ? (
                            <span className="line-clamp-3 text-left block" title={inst.notes}>
                              {inst.notes}
                            </span>
                          ) : (
                            '—'
                          )}
                        </Editable>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* 강사 상세 (선택 시에만 표시) */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-800">
            강사 상세 — {selected.name}
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-1">행 번호</p>
                <p className="font-medium text-gray-900">{selected.rowIndex}</p>
              </div>
              <div className="bg-gray-50 rounded border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-1">이메일</p>
                <Editable value={selected.email} column="email" rowIndex={selected.rowIndex} inputType="email">
                  <span className="break-all">{selected.email || '—'}</span>
                </Editable>
              </div>
              <div className="bg-gray-50 rounded border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-1">전화</p>
                <Editable value={selected.mobile} column="mobile" rowIndex={selected.rowIndex} inputType="tel">
                  {selected.mobile || '—'}
                </Editable>
              </div>
              <div className="bg-gray-50 rounded border border-gray-100 p-3">
                <p className="text-xs text-gray-500 mb-1">강사료</p>
                <Editable value={selected.fee} column="fee" rowIndex={selected.rowIndex}>
                  {selected.fee || '—'}
                </Editable>
              </div>
            </div>
            <div className="bg-gray-50 rounded border border-gray-100 p-3">
              <p className="text-xs text-gray-500 mb-2">특이사항</p>
              <Editable value={selected.notes} column="notes" rowIndex={selected.rowIndex} multiline>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{selected.notes || '—'}</div>
              </Editable>
            </div>

            {/* 실적 (강사 실적 시트: 1qtyBpb2... 대시보드) */}
            {(() => {
              const perf = getPerformance(selected.name);
              return (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 font-medium text-gray-800 text-sm">
                    실적 요약 (강사 실적 시트)
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <span className="text-xs text-gray-500">출강 횟수</span>
                      <p className="text-lg font-semibold text-gray-900 mt-0.5">
                        {perf?.sessionCount ? `${perf.sessionCount}회` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-2">주요 고객사</span>
                      <div className="bg-gray-50 rounded border border-gray-100 p-3 max-h-56 overflow-y-auto">
                        {perf?.mainClients ? formatMainClients(perf.mainClients) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
