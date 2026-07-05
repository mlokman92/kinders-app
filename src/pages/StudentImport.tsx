import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBranch } from '@/lib/branch';
import {
  buildTemplateCsv,
  downloadCsv,
  mapHeaders,
  MAX_IMPORT_ROWS,
  parseCsv,
  toRpcPayload,
  validateRows,
  type BulkResult,
  type Classroom,
  type PreviewRow,
  type RosterEntry,
} from '@/lib/csv';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type Step = 'upload' | 'preview' | 'result';

export function StudentImport() {
  const navigate = useNavigate();
  const { role, can } = useAuth();
  const { branches, branchId } = useBranch();

  // Branch for the imported rows: the switcher's branch, else a choice made here.
  const [chosenBranchId, setChosenBranchId] = useState<number | null>(null);
  const importBranchId = branchId ?? chosenBranchId ?? branches[0]?.id ?? null;

  const [step, setStep] = useState<Step>('upload');
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);

  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Load the branch's classrooms (for name→id resolution) and roster (for dup detection).
  useEffect(() => {
    let active = true;
    (async () => {
      setRefLoading(true);
      setRefError(null);
      try {
        let clsQ = supabase.from('classrooms').select('id, name').order('name');
        // Scope dup detection to the destination branch: a same-name+dob child in
        // another branch is a distinct record and must not deselect a valid row.
        let rosterQ = supabase.from('students').select('name, dob');
        if (importBranchId !== null) {
          clsQ = clsQ.eq('branch_id', importBranchId);
          rosterQ = rosterQ.eq('branch_id', importBranchId);
        }
        const [clsRes, rosterRes] = await Promise.all([clsQ, rosterQ]);
        if (!active) return;
        if (clsRes.error) throw clsRes.error;
        if (rosterRes.error) throw rosterRes.error;
        setClassrooms((clsRes.data ?? []) as Classroom[]);
        setRoster((rosterRes.data ?? []) as RosterEntry[]);
      } catch (e) {
        if (active) setRefError(e instanceof Error ? e.message : 'Failed to load center data.');
      } finally {
        if (active) setRefLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [importBranchId]);

  const onFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length === 0) {
        setParseError('That file is empty.');
        return;
      }
      const headers = mapHeaders(table[0]);
      if (headers.name === undefined) {
        setParseError(
          "Couldn't find a “name” column. Download the template to see the expected headers.",
        );
        return;
      }
      const dataRows = table.slice(1);
      if (dataRows.length === 0) {
        setParseError('That file has headers but no student rows.');
        return;
      }
      if (dataRows.length > MAX_IMPORT_ROWS) {
        setParseError(
          `That file has ${dataRows.length} rows. Please import at most ${MAX_IMPORT_ROWS} at a time.`,
        );
        return;
      }
      const preview = validateRows(dataRows, headers, classrooms, roster);
      const sel: Record<number, boolean> = {};
      for (const r of preview)
        if (r.importable) sel[r.rowNumber] = !r.duplicateOfRoster && !r.duplicateInFile;
      setRows(preview);
      setSelected(sel);
      setStep('preview');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  const counts = useMemo(() => {
    let ready = 0;
    let errors = 0;
    let duplicates = 0;
    for (const r of rows) {
      if (!r.importable) errors += 1;
      else if (r.duplicateOfRoster || r.duplicateInFile) duplicates += 1;
      else ready += 1;
    }
    return { ready, errors, duplicates };
  }, [rows]);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.importable && selected[r.rowNumber]).length,
    [rows, selected],
  );

  const runImport = async () => {
    const chosen = rows.filter((r) => r.importable && selected[r.rowNumber]);
    if (chosen.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const payload = toRpcPayload(chosen);
      const { data, error } = await supabase.rpc('bulk_add_students', {
        p_rows: payload as unknown as Json,
        p_branch_id: importBranchId ?? undefined,
      });
      if (error) throw error;
      setResult(data as unknown as BulkResult);
      setStep('result');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setSelected({});
    setFileName('');
    setParseError(null);
    setResult(null);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const backLink = (
    <Link to="/students" style={{ fontSize: 14, fontWeight: 700, color: Brand.onSurfaceVariant }}>
      ← Students
    </Link>
  );

  /* ----------------------------------------------------------- render */

  // Needs the manage_students capability (RLS enforces the same). Placed after all
  // hooks so hook order stays stable across role resolution.
  if (role && !can('manage_students')) return <Navigate to="/students" replace />;

  return (
    <div>
      <PageHeader title="Import students" actions={backLink} />

      {refLoading ? (
        <Loading />
      ) : refError ? (
        <ErrorState message={refError} />
      ) : step === 'upload' ? (
        <>
          {branchId === null && branches.length > 1 ? (
            <div style={{ maxWidth: 280, marginBottom: 16 }}>
              <Field label="Branch">
                <Select
                  value={importBranchId != null ? String(importBranchId) : ''}
                  onChange={(v) => setChosenBranchId(v ? Number(v) : null)}
                  options={branches.map((b) => ({ label: b.name, value: String(b.id) }))}
                  style={{ width: '100%' }}
                />
              </Field>
            </div>
          ) : null}
          <UploadStep
            fileRef={fileRef}
            parseError={parseError}
            onFile={onFile}
            onTemplate={() => downloadCsv('kinders-students-template.csv', buildTemplateCsv())}
          />
        </>
      ) : step === 'preview' ? (
        <>
          {importError ? (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={importError} />
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: Brand.onSurfaceVariant }}>
              {fileName} ·
            </span>
            <Badge tone="success">{counts.ready} ready</Badge>
            {counts.duplicates > 0 ? <Badge tone="warning">{counts.duplicates} duplicate</Badge> : null}
            {counts.errors > 0 ? <Badge tone="error">{counts.errors} with errors</Badge> : null}
          </div>

          <PreviewTable rows={rows} selected={selected} setSelected={setSelected} />

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="secondary" onClick={reset} disabled={importing}>
              Choose a different file
            </Button>
            <Button onClick={runImport} disabled={importing || selectedCount === 0}>
              {importing ? <Spinner size={16} /> : `Import ${selectedCount} student${selectedCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      ) : (
        <ResultStep result={result} rows={rows} onDone={() => navigate('/students')} onAgain={reset} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Upload */

function UploadStep({
  fileRef,
  parseError,
  onFile,
  onTemplate,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  parseError: string | null;
  onFile: (file: File) => void;
  onTemplate: () => void;
}) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <p style={{ fontSize: 14, color: Brand.onSurfaceVariant, margin: 0 }}>
        Upload a CSV to add many children at once. Start from the template — only{' '}
        <strong>name</strong> is required.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ''; // allow re-selecting the same file after an error
        }}
      />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button onClick={() => fileRef.current?.click()}>Choose CSV file</Button>
        <Button variant="outline" onClick={onTemplate}>
          Download template
        </Button>
      </div>
      {parseError ? <ErrorState message={parseError} /> : null}
    </Card>
  );
}

/* ------------------------------------------------------------ Preview */

function PreviewTable({
  rows,
  selected,
  setSelected,
}: {
  rows: PreviewRow[];
  selected: Record<number, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th width={44}> </Th>
          <Th width={56}>Row</Th>
          <Th>Student</Th>
          <Th>Classroom</Th>
          <Th align="right" width={90}>Contacts</Th>
          <Th>Issues</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const tint = !r.importable
            ? Brand.errorContainer
            : r.duplicateOfRoster || r.duplicateInFile
              ? Brand.tertiaryContainer
              : undefined;
          return (
            <tr key={r.rowNumber} style={tint ? { background: tint } : undefined}>
              <Td>
                {r.importable ? (
                  <input
                    type="checkbox"
                    checked={!!selected[r.rowNumber]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [r.rowNumber]: e.target.checked }))
                    }
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                ) : (
                  <span style={{ color: Brand.error, fontWeight: 800 }}>✕</span>
                )}
              </Td>
              <Td style={{ color: Brand.onSurfaceVariant }}>{r.rowNumber}</Td>
              <Td>
                <div style={{ fontWeight: 700 }}>{r.name || '—'}</div>
                <div style={{ fontSize: 12, color: Brand.onSurfaceVariant }}>
                  {[r.dob, r.gender, r.nric ? `NRIC ${r.nric}` : null].filter(Boolean).join(' · ') || ' '}
                </div>
              </Td>
              <Td style={{ color: r.classroomName ? Brand.onSurface : Brand.onSurfaceVariant }}>
                {r.classroomName || '—'}
              </Td>
              <Td align="right">{r.guardians.length}</Td>
              <Td>
                {r.errors.length === 0 && r.warnings.length === 0 ? (
                  <Badge tone="success">Ready</Badge>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {r.errors.map((m, i) => (
                      <span key={`e${i}`} style={{ fontSize: 12.5, color: Brand.onErrorContainer }}>
                        {m}
                      </span>
                    ))}
                    {r.warnings.map((m, i) => (
                      <span key={`w${i}`} style={{ fontSize: 12.5, color: Brand.onTertiaryContainer }}>
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/* ------------------------------------------------------------- Result */

function ResultStep({
  result,
  rows,
  onDone,
  onAgain,
}: {
  result: BulkResult | null;
  rows: PreviewRow[];
  onDone: () => void;
  onAgain: () => void;
}) {
  const nameByRow = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) m.set(r.rowNumber, r.name);
    return m;
  }, [rows]);

  const failed = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <div style={{ maxWidth: 640 }}>
      {result && result.inserted > 0 ? (
        <Card style={{ borderColor: Brand.success, background: Brand.successContainer, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: Brand.onSuccessContainer }}>
            Imported {result.inserted} student{result.inserted === 1 ? '' : 's'}.
          </div>
        </Card>
      ) : (
        <EmptyState title="Nothing imported" message="No students were added." icon="📭" />
      )}

      {failed.length > 0 ? (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: Brand.onSurface, margin: '8px 0 12px' }}>
            {failed.length} row{failed.length === 1 ? '' : 's'} failed
          </h2>
          <Card padding={0}>
            {failed.map((f, i) => (
              <div
                key={f.index}
                style={{
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${Brand.outlineVariant}`,
                }}
              >
                <div style={{ fontWeight: 700, color: Brand.onSurface }}>
                  Row {f.index}: {nameByRow.get(f.index) || '—'}
                </div>
                <div style={{ fontSize: 12.5, color: Brand.error, marginTop: 2 }}>{f.error}</div>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button variant="secondary" onClick={onAgain}>
          Import another file
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
