import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type Branch = {
  id: number;
  center_id: number;
  name: string;
  address: string | null;
  phone: string | null;
};

type BranchContextValue = {
  /** Branches visible to the signed-in staff member (RLS-scoped). */
  branches: Branch[];
  /** Selected branch id; null = all branches. */
  branchId: number | null;
  setBranchId: (id: number | null) => void;
  /** The selected branch row, when a single branch is selected. */
  branch: Branch | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

const storageKey = (uid: string) => `kinders.branch.${uid}`;

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user, isStaff } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = user?.id ?? null;

  const load = useCallback(async () => {
    if (!uid || !isStaff) {
      setBranches([]);
      setBranchIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('branches')
      .select('id, center_id, name, address, phone')
      .order('id');
    const rows = (data ?? []) as Branch[];
    setBranches(rows);
    // Restore the saved selection when it still exists; a single branch needs no choice.
    const saved = Number(localStorage.getItem(storageKey(uid)));
    if (rows.length === 1) {
      setBranchIdState(rows[0].id);
    } else if (saved && rows.some((b) => b.id === saved)) {
      setBranchIdState(saved);
    } else {
      setBranchIdState(null);
    }
    setLoading(false);
  }, [uid, isStaff]);

  useEffect(() => {
    void load();
  }, [load]);

  const setBranchId = useCallback(
    (id: number | null) => {
      setBranchIdState(id);
      if (uid) {
        if (id === null) localStorage.removeItem(storageKey(uid));
        else localStorage.setItem(storageKey(uid), String(id));
      }
    },
    [uid],
  );

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      branchId,
      setBranchId,
      branch: branches.find((b) => b.id === branchId) ?? null,
      loading,
      refresh: load,
    }),
    [branches, branchId, setBranchId, loading, load],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
}
