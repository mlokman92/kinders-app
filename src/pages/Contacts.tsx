import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Table,
  Td,
  TextInput,
  Th,
  Toolbar,
} from '@/components/ui';
import { useBranch } from '@/lib/branch';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/lib/theme';

type GuardianRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  students: { id: number; name: string } | null;
};

/** One contact, merged across the children they're linked to (by email). */
type Contact = {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  hasAccount: boolean;
  students: { id: number; name: string }[];
};

export function Contacts() {
  const { branchId } = useBranch();
  const [rows, setRows] = useState<GuardianRow[]>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [guardiansRes, linkedRes] = await Promise.all([
          branchId !== null
            ? supabase
                .from('guardians')
                .select('id, name, email, phone, relationship, students!inner(id, name)')
                .eq('students.branch_id', branchId)
                .order('name')
            : supabase
                .from('guardians')
                .select('id, name, email, phone, relationship, students(id, name)')
                .order('name'),
          supabase.rpc('my_linked_guardian_emails'),
        ]);
        if (!active) return;
        if (guardiansRes.error) throw guardiansRes.error;
        setRows((guardiansRes.data ?? []) as unknown as GuardianRow[]);
        setLinked(new Set(((linkedRes.data as string[] | null) ?? []).map((e) => e.toLowerCase())));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load contacts.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [branchId]);

  // Merge guardian rows into contacts: rows sharing an email are one person
  // (a parent of siblings); rows without an email stay separate.
  const contacts = useMemo(() => {
    const byKey = new Map<string, Contact>();
    for (const g of rows) {
      const emailKey = g.email ? g.email.trim().toLowerCase() : null;
      // Merge by email AND name: a parent of siblings collapses into one contact,
      // but two different people sharing a family email stay separate.
      const key = emailKey ? `${emailKey}|${(g.name ?? '').trim().toLowerCase()}` : `g:${g.id}`;
      let c = byKey.get(key);
      if (!c) {
        c = {
          key,
          name: g.name,
          email: g.email,
          phone: g.phone,
          relationship: g.relationship,
          hasAccount: emailKey ? linked.has(emailKey) : false,
          students: [],
        };
        byKey.set(key, c);
      } else {
        c.name = c.name || g.name;
        c.phone = c.phone || g.phone;
        c.relationship = c.relationship || g.relationship;
      }
      if (g.students && !c.students.some((s) => s.id === g.students!.id)) {
        c.students.push(g.students);
      }
    }
    return [...byKey.values()].sort((a, b) =>
      (a.name || a.email || '').localeCompare(b.name || b.email || ''),
    );
  }, [rows, linked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        c.students.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={
          loading
            ? 'Parents and guardians.'
            : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} across your roster.`
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          message="Add contacts to students and they'll appear here."
          icon="📇"
        />
      ) : (
        <>
          <Toolbar>
            <Field label="Search">
              <TextInput value={query} onChange={setQuery} placeholder="Name, email, phone, child…" />
            </Field>
          </Toolbar>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="No contacts match your search." icon="🔍" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Children</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.key}>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={c.name || c.email || c.phone || ''} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                          >
                            <span style={{ fontWeight: 700, color: Brand.onSurface }}>
                              {c.name || '—'}
                            </span>
                            {c.relationship ? <Badge tone="neutral">{c.relationship}</Badge> : null}
                            {c.hasAccount ? <Badge tone="success">App account</Badge> : null}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td style={{ color: c.email ? Brand.onSurface : Brand.onSurfaceVariant }}>
                      {c.email || '—'}
                    </Td>
                    <Td style={{ color: c.phone ? Brand.onSurface : Brand.onSurfaceVariant }}>
                      {c.phone || '—'}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.students.length === 0 ? (
                          <span style={{ color: Brand.onSurfaceVariant }}>—</span>
                        ) : (
                          c.students.map((s) => (
                            <Link key={s.id} to={`/students/${s.id}`} style={{ textDecoration: 'none' }}>
                              <Badge tone="primary">{s.name}</Badge>
                            </Link>
                          ))
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
