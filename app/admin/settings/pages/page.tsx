'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, ShieldQuestion, X, Loader as Loader2, Menu as MenuIcon } from 'lucide-react';

interface PageItem {
  id: string; pageId: string; pageName: string; accessToken: string;
  isActive: boolean; autoReplyEnabled: boolean; hourlyCommentLimit: number;
  reactionEnabled: boolean; erpConfigId: string | null;
  erpConfig?: { id: string; name: string } | null;
}

interface ErpItem { id: string; name: string; }

type TokenStatus = 'valid' | 'expired' | 'unknown';

interface FormState {
  pageId: string;
  pageName: string;
  accessToken: string;
  autoReplyEnabled: boolean;
}

const EMPTY_FORM: FormState = { pageId: '', pageName: '', accessToken: '', autoReplyEnabled: true };

const isDemoMode = true;

export default function PagesAdminPage() {
  const [items, setItems] = useState<PageItem[]>([]);
  const [erps, setErps] = useState<ErpItem[]>([]);
  const [tokenStatus, setTokenStatus] = useState<Record<string, TokenStatus>>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PageItem | null>(null);
  const [deleting, setDeleting] = useState<PageItem | null>(null);
  const [menuBusy, setMenuBusy] = useState<string | null>(null);

  async function configureMenu(p: PageItem) {
    setMenuBusy(p.id);
    try {
      const r = await fetch(`/api/admin/pages/${p.id}/persistent-menu`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) toast.success('Persistent Menu тохируулагдлаа / configured');
      else toast.error(d.error || 'Тохируулж чадсангүй / Could not configure');
    } catch {
      toast.error('Холбогдсонгүй / Connection failed');
    } finally {
      setMenuBusy(null);
    }
  }

  async function load() {
    const [pR, eR] = await Promise.all([fetch('/api/admin/pages'), fetch('/api/admin/erp')]);
    const pD = await pR.json(); const eD = await eR.json();
    const pages: PageItem[] = pD.items || [];
    setItems(pages); setErps(eD.items || []);
    const init: Record<string, TokenStatus> = {};
    for (const p of pages) init[p.id] = tokenStatus[p.id] ?? 'unknown';
    setTokenStatus(init);
    checkAllTokens();
  }

  async function checkAllTokens() {
    try {
      const r = await fetch('/api/admin/pages/token-status');
      const d = await r.json();
      const next: Record<string, TokenStatus> = {};
      for (const it of d.items || []) next[it.id] = it.valid ? 'valid' : 'expired';
      setTokenStatus(next);
    } catch {
      // keep as unknown
    }
  }

  useEffect(() => { load(); }, []);

  async function softDelete(p: PageItem) {
    const r = await fetch(`/api/admin/pages/${p.id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Пэйж устгагдлаа / Page deactivated'); setDeleting(null); load(); }
    else toast.error('Алдаа гарлаа / Error');
  }

  const expired = items.filter((p) => p.isActive && tokenStatus[p.id] === 'expired');

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Facebook пэйж / Facebook pages</h1>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
          <Plus className="w-4 h-4" /> Шинэ пэйж нэмэх / Add page
        </button>
      </div>

      {!isDemoMode && expired.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <div className="font-semibold mb-0.5">Токен дууссан пэйж байна / Expired token(s)</div>
            <div className="text-red-700">
              {expired.map((p) => p.pageName).join(', ')} — шинэ access token оруулна уу / please enter a new access token.
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {items.map((p) => {
          const ts = tokenStatus[p.id] ?? 'unknown';
          const tokenMasked = '***' + (p.accessToken || '').slice(-10);
          return (
            <div key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="font-semibold text-slate-900">{p.pageName}</div>
                    <TokenBadge status={ts} />
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {p.isActive ? 'Идэвхтэй / Active' : 'Идэвхгүй / Inactive'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${p.autoReplyEnabled ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
                      Автомат хариу / Auto-reply: {p.autoReplyEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">ID: <span className="font-mono">{p.pageId}</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">Token: <span className="font-mono">{tokenMasked}</span></div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => configureMenu(p)}
                    disabled={menuBusy === p.id}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50"
                    title="Messenger-ийн доод цэсэнд 'Захиалга хянах' товчийг тохируулна / Configure the 'Track order' button in Messenger persistent menu"
                  >
                    {menuBusy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MenuIcon className="w-3.5 h-3.5" />} Persistent Menu тохируулах / Configure
                  </button>
                  <button
                    onClick={() => setEditing(p)}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Засах / Edit
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Устгах / Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!items.length && <div className="p-8 text-center text-slate-500 text-sm">Пэйж байхгүй байна / No pages</div>}
      </div>

      {creating && (
        <PageFormModal
          title="Шинэ пэйж нэмэх / Add new page"
          initial={EMPTY_FORM}
          erps={erps}
          onClose={() => setCreating(false)}
          onSave={async (form, erpConfigId) => {
            const r = await fetch('/api/admin/pages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...form, erpConfigId: erpConfigId || null }),
            });
            if (r.ok) { toast.success('Пэйж нэмэгдлээ / Page added'); setCreating(false); load(); }
            else toast.error('Алдаа гарлаа / Error');
          }}
        />
      )}

      {editing && (
        <PageFormModal
          title={`Засах / Edit: ${editing.pageName}`}
          initial={{
            pageId: editing.pageId,
            pageName: editing.pageName,
            accessToken: editing.accessToken,
            autoReplyEnabled: editing.autoReplyEnabled,
          }}
          initialErpConfigId={editing.erpConfigId}
          erps={erps}
          editing
          onClose={() => setEditing(null)}
          onSave={async (form, erpConfigId) => {
            const r = await fetch(`/api/admin/pages/${editing.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pageName: form.pageName,
                accessToken: form.accessToken,
                autoReplyEnabled: form.autoReplyEnabled,
                erpConfigId: erpConfigId || null,
              }),
            });
            if (r.ok) { toast.success('Хадгалагдлаа / Saved'); setEditing(null); load(); }
            else toast.error('Алдаа гарлаа / Error');
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Пэйж устгах уу? / Delete page?"
          message={`Delete page "${deleting.pageName}"?\nAll chats remain, but the bot will stop replying.`}
          confirmText="Тийм, устгах / Yes, delete"
          cancelText="Болих / Cancel"
          onCancel={() => setDeleting(null)}
          onConfirm={() => softDelete(deleting)}
        />
      )}
    </div>
  );
}

function TokenBadge({ status }: { status: TokenStatus }) {
  if (status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
        <ShieldCheck className="w-3 h-3" /> Хүчинтэй / Valid
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
        <ShieldAlert className="w-3 h-3" /> Дууссан / Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
      <ShieldQuestion className="w-3 h-3" /> Шалгаагүй / Unchecked
    </span>
  );
}

interface FormModalProps {
  title: string;
  initial: FormState;
  initialErpConfigId?: string | null;
  erps: ErpItem[];
  editing?: boolean;
  onClose: () => void;
  onSave: (form: FormState, erpConfigId: string | null) => void | Promise<void>;
}

function PageFormModal({ title, initial, initialErpConfigId, erps, editing, onClose, onSave }: FormModalProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [erpConfigId, setErpConfigId] = useState<string>(initialErpConfigId ?? '');
  const [verifying, setVerifying] = useState(false);
  const [verifyState, setVerifyState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  async function verify() {
    if (!form.accessToken.trim()) {
      toast.error('Токен оруулна уу / Please enter a token');
      return;
    }
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const r = await fetch('/api/admin/pages/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: form.accessToken }),
      });
      const d = await r.json();
      if (d.ok) {
        setVerifyState('valid');
        setVerifyMsg(`Token хүчинтэй — хадгалах боломжтой / Token is valid — ready to save${d.name ? ` (${d.name})` : ''}`);
        if (!form.pageName && d.name) setForm((f) => ({ ...f, pageName: d.name }));
        if (!form.pageId && d.id) setForm((f) => ({ ...f, pageId: d.id }));
        toast.success('Token хүчинтэй / Token valid');
      } else {
        setVerifyState('invalid');
        setVerifyMsg('Token хүчингүй — шинэ token үүсгэнэ үү / Token invalid — please generate a new one');
        toast.error('Token хүчингүй / Token invalid');
      }
    } catch {
      setVerifyState('invalid');
      setVerifyMsg('Token хүчингүй — шинэ token үүсгэнэ үү / Token invalid — please generate a new one');
      toast.error('Холбогдсонгүй / Connection failed');
    } finally {
      setVerifying(false);
    }
  }

  const fieldsOk = !!(form.pageId.trim() && form.pageName.trim() && form.accessToken.trim());
  const canAutoSave = fieldsOk && verifyState === 'valid';
  const canForceSave = fieldsOk && verifyState === 'invalid';

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-auto">
          <Field label="Page Name">
            <input
              value={form.pageName}
              onChange={(e) => setForm({ ...form, pageName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Жишээ / Example: Nomi UB"
            />
          </Field>
          <Field label="Page ID">
            <input
              value={form.pageId}
              onChange={(e) => setForm({ ...form, pageId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              disabled={!!editing}
              placeholder="Жишээ / Example: 1234567890"
            />
          </Field>
          <Field label="Access Token">
            <div className="flex gap-2">
              <input
                value={form.accessToken}
                onChange={(e) => { setForm({ ...form, accessToken: e.target.value }); setVerifyState('idle'); setVerifyMsg(null); }}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                placeholder="EAA..."
              />
              <button
                onClick={verify}
                disabled={verifying}
                className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Шалгах / Verify
              </button>
            </div>
            {verifyMsg && (
              <div className={`text-xs mt-1.5 ${verifyState === 'valid' ? 'text-emerald-700' : 'text-red-700'}`}>{verifyMsg}</div>
            )}
          </Field>
          <Field label="ERP">
            <select
              value={erpConfigId}
              onChange={(e) => setErpConfigId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">(Сонгоогүй / Not selected)</option>
              {erps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoReplyEnabled}
              onChange={(e) => setForm({ ...form, autoReplyEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            Автомат хариу идэвхтэй / Auto-reply enabled
          </label>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl flex-wrap">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Болих / Cancel</button>
          {canForceSave ? (
            <button
              onClick={() => onSave(form, erpConfigId || null)}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              title="Token хүчингүй байсан ч хадгална / Save even if token is invalid"
            >
              Баталгаажуулалтгүйгээр хадгалах / Save without verification
            </button>
          ) : (
            <button
              onClick={() => onSave(form, erpConfigId || null)}
              disabled={!fieldsOk || (!editing && !canAutoSave)}
              className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Хадгалах / Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function ConfirmModal({ title, message, confirmText, cancelText, onCancel, onConfirm }: {
  title: string; message: string; confirmText: string; cancelText: string; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-slate-700 whitespace-pre-line">{message}</div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">{cancelText}</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
