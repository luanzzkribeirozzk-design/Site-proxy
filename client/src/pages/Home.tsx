import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Archive,
  Bell,
  Check,
  CircleAlert,
  Cloud,
  Database,
  GitBranch,
  LayoutDashboard,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Terminal,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const statusLabels = {
  green: "ATIVO",
  yellow: "ATENÇÃO",
  red: "INDISPONÍVEL",
} as const;

const statusClasses = {
  green: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  yellow: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  red: "border-rose-400/40 bg-rose-400/10 text-rose-300",
} as const;

type CatalogStatus = keyof typeof statusLabels;
type CatalogItem = {
  id: string;
  name: string;
  defaultName?: string;
  order: number;
  status: CatalogStatus;
  available: boolean;
  archived: boolean;
  version: string;
  fileName: string;
};

export default function Home() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [ownerUnlocked, setOwnerUnlocked] = useState(() => sessionStorage.getItem("owner-panel-unlocked") === "1");
  async function unlockOwnerMode() {
    const key = window.prompt("Chave do modo proprietário");
    if (!key) return;
    const response = await fetch("/api/owner/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });
    const result = await response.json() as { authorized?: boolean };
    if (result.authorized) {
      sessionStorage.setItem("owner-panel-unlocked", "1");
      setOwnerUnlocked(true);
    } else {
      window.alert("Chave inválida.");
    }
  }
  async function loadCatalog() {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/catalog/manifest");
      if (!response.ok) throw new Error("manifest_unavailable");
      const manifest = await response.json() as { items?: CatalogItem[] };
      setItems(manifest.items ?? []);
      setCatalogError(null);
    } catch {
      setCatalogError("Não foi possível carregar o catálogo agora.");
    } finally {
      setCatalogLoading(false);
    }
  }
  async function ownerRequest(path: string, body: unknown) {
    if (!ownerUnlocked) {
      await unlockOwnerMode();
      return false;
    }
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.status === 403) {
      sessionStorage.removeItem("owner-panel-unlocked");
      setOwnerUnlocked(false);
      window.alert("Sessão do proprietário expirada.");
      return false;
    }
    if (!response.ok) throw new Error("owner_request_failed");
    return true;
  }
  useEffect(() => { void loadCatalog(); }, []);
  const catalog = { data: items, isLoading: catalogLoading, refetch: loadCatalog };
  const history = { data: [] as unknown[] };
  const publish = { isPending: false, mutate: () => void ownerRequest("/api/catalog/publish", {}) };
  const update = { isPending: false, mutate: (input: unknown) => void ownerRequest("/api/catalog/update", input) };
  const add = { isPending: false, mutate: (input: unknown) => void ownerRequest("/api/catalog/add", input).then(() => { setAddOpen(false); void loadCatalog(); }) };
  const notify = { isPending: false, mutate: (input: unknown) => void ownerRequest("/api/catalog/notify", input) };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "available" | "archived">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [newItem, setNewItem] = useState({ id: "", name: "", version: "1.0.0", fileName: "" });

  const visibleItems = useMemo(
    () => items.filter(item => {
      if (filter === "available") return item.available && !item.archived;
      if (filter === "archived") return item.archived;
      return true;
    }),
    [filter, items],
  );
  const selected = items.find(item => item.id === selectedId) ?? visibleItems[0];
  const activeCount = items.filter(item => item.available && !item.archived).length;
  const warningCount = items.filter(item => item.status === "yellow").length;
  const archivedCount = items.filter(item => item.archived).length;

  function saveItem() {
    if (!selected) return;
    update.mutate({
      id: selected.id,
      name: selected.name,
      defaultName: selected.defaultName ?? selected.name,
      status: selected.status,
      available: selected.available,
      archived: selected.archived,
      order: selected.order,
      version: selected.version,
      fileName: selected.fileName,
    });
  }

  function updateSelected(patch: Partial<typeof selected>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    setSelectedId(next.id);
    const index = items.findIndex(item => item.id === next.id);
    if (index >= 0) setItems(previous => previous.map(item => item.id === next.id ? next : item));
  }

  return (
    <main className="min-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#05070d] text-slate-100 shadow-[0_0_80px_rgba(0,229,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.035)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="relative">
        <header className="flex flex-col gap-5 border-b border-cyan-300/15 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300/70">
              <Terminal className="h-3.5 w-3.5" />
              Opera // control channel
            </div>
            <h1 className="font-mono text-3xl font-black tracking-tight text-white sm:text-4xl">
              CATÁLOGO <span className="text-fuchsia-400">ONLINE</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Central de controle do catálogo V2. Os itens são publicados em versões e a IPA consulta apenas o manifesto válido.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className={ownerUnlocked ? "border-emerald-300/30 bg-emerald-300/5 text-emerald-200" : "border-fuchsia-300/30 bg-fuchsia-300/5 text-fuchsia-200"} onClick={() => void unlockOwnerMode()}>
              <ShieldCheck className="mr-2 h-4 w-4" /> {ownerUnlocked ? "Proprietário ativo" : "Modo proprietário"}
            </Button>
            <Button variant="outline" className="border-cyan-300/30 bg-cyan-300/5 text-cyan-200 hover:bg-cyan-300/10" onClick={() => void catalog.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button className="bg-fuchsia-500 text-white shadow-[0_0_24px_rgba(217,70,239,0.3)] hover:bg-fuchsia-400" onClick={() => publish.mutate()} disabled={publish.isPending || items.length === 0}>
              {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Publicar catálogo
            </Button>
          </div>
        </header>

        <section className="grid gap-3 border-b border-cyan-300/10 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          <Metric icon={Database} label="Itens no catálogo" value={String(items.length).padStart(2, "0")} accent="cyan" />
          <Metric icon={Radio} label="Disponíveis" value={String(activeCount).padStart(2, "0")} accent="emerald" />
          <Metric icon={CircleAlert} label="Em atenção" value={String(warningCount).padStart(2, "0")} accent="amber" />
          <Metric icon={Archive} label="Arquivados" value={String(archivedCount).padStart(2, "0")} accent="fuchsia" />
        </section>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300/60">/ catalog / records</p>
                <h2 className="mt-1 text-xl font-bold text-white">Itens cadastrados</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                  {(["all", "available", "archived"] as const).map(value => (
                    <button key={value} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${filter === value ? "bg-cyan-300/15 text-cyan-200" : "text-slate-500 hover:text-slate-300"}`} onClick={() => setFilter(value)}>
                      {value === "all" ? "Todos" : value === "available" ? "Ativos" : "Arquivados"}
                    </button>
                  ))}
                </div>
                <Button size="icon" variant="outline" className="border-fuchsia-300/30 bg-fuchsia-300/5 text-fuchsia-200 hover:bg-fuchsia-300/10" onClick={() => setAddOpen(true)} aria-label="Adicionar item">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {catalog.isLoading && <LoadingRow />}
              {catalogError && <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-200">{catalogError}</p>}
              {!catalog.isLoading && !catalogError && visibleItems.length === 0 && <EmptyState />}
              {visibleItems.map(item => (
                <button key={item.id} onClick={() => setSelectedId(item.id)} className={`group w-full rounded-xl border p-4 text-left transition ${selected?.id === item.id ? "border-cyan-300/50 bg-cyan-300/[0.08] shadow-[0_0_28px_rgba(0,229,255,0.08)]" : "border-white/10 bg-white/[0.025] hover:border-cyan-300/30 hover:bg-white/[0.05]"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 font-mono text-xs text-cyan-200">{String(item.order).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{item.name}</p>
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{item.id} · v{item.version}</p>
                      </div>
                    </div>
                    <Badge className={`shrink-0 border text-[10px] ${statusClasses[item.status]}`}>{statusLabels[item.status]}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-slate-500">
                    <span>{item.fileName || "sem arquivo associado"}</span>
                    <span className={item.available && !item.archived ? "text-emerald-300" : "text-rose-300"}>{item.archived ? "ARQUIVADO" : item.available ? "PUBLICÁVEL" : "BLOQUEADO"}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <Card className="border-cyan-300/20 bg-white/[0.035] text-white">
              <CardHeader className="border-b border-white/10 pb-4"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/60">/ inspector</p><CardTitle className="mt-1 text-lg">Editar item</CardTitle></div><ShieldCheck className="h-5 w-5 text-emerald-300" /></div></CardHeader>
              <CardContent className="space-y-4 pt-5">
                {selected ? <>
                  <label className="block text-xs font-semibold text-slate-400">Nome exibido<Input value={selected.name} onChange={event => updateSelected({ name: event.target.value })} className="mt-2 border-white/10 bg-black/20 text-white" /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-400">Versão<Input value={selected.version} onChange={event => updateSelected({ version: event.target.value })} className="mt-2 border-white/10 bg-black/20 text-white" /></label>
                    <label className="block text-xs font-semibold text-slate-400">Ordem<Input type="number" value={selected.order} onChange={event => updateSelected({ order: Number(event.target.value) })} className="mt-2 border-white/10 bg-black/20 text-white" /></label>
                  </div>
                  <div><p className="mb-2 text-xs font-semibold text-slate-400">Status visual</p><div className="grid grid-cols-3 gap-2">{(["green", "yellow", "red"] as const).map(status => <button key={status} onClick={() => updateSelected({ status })} className={`rounded-lg border px-2 py-2 text-[10px] font-bold ${selected.status === status ? statusClasses[status] : "border-white/10 bg-white/[0.02] text-slate-500"}`}>{statusLabels[status]}</button>)}</div></div>
                  <div className="grid grid-cols-2 gap-2"><ToggleButton active={selected.available} onClick={() => updateSelected({ available: !selected.available })} label="Disponível" /><ToggleButton active={!selected.archived} onClick={() => updateSelected({ archived: !selected.archived })} label="Visível" /></div>
                  <Button onClick={saveItem} disabled={update.isPending} className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar alterações</Button>
                </> : <p className="text-sm text-slate-500">Selecione um item para editar.</p>}
              </CardContent>
            </Card>

            <Card className="border-fuchsia-300/20 bg-fuchsia-300/[0.035] text-white">
              <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-fuchsia-300" /><CardTitle className="text-base">Notificação para a IPA</CardTitle></div></CardHeader>
              <CardContent className="space-y-3"><Input value={noticeTitle} onChange={event => setNoticeTitle(event.target.value)} placeholder="Título" className="border-white/10 bg-black/20 text-white placeholder:text-slate-600" /><Textarea value={noticeBody} onChange={event => setNoticeBody(event.target.value)} placeholder="Mensagem exibida na próxima sincronização" className="min-h-20 border-white/10 bg-black/20 text-white placeholder:text-slate-600" /><Button variant="outline" className="w-full border-fuchsia-300/30 bg-transparent text-fuchsia-200 hover:bg-fuchsia-300/10" disabled={notify.isPending || !noticeTitle || !noticeBody} onClick={() => notify.mutate({ title: noticeTitle, body: noticeBody })}>{notify.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Enviar mensagem</Button></CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.02] text-white"><CardContent className="flex items-center justify-between gap-4 p-4"><div className="flex items-center gap-3"><GitBranch className="h-4 w-4 text-cyan-300" /><div><p className="text-xs font-semibold">Histórico de publicações</p><p className="text-[11px] text-slate-500">{history.data?.length ?? 0} versão(ões) armazenada(s)</p></div></div><RotateCcw className="h-4 w-4 text-slate-500" /></CardContent></Card>
          </aside>
        </div>
      </div>

      {addOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><Card className="w-full max-w-md border-cyan-300/30 bg-[#090d17] text-white"><CardHeader className="flex-row items-center justify-between"><CardTitle>Novo item de catálogo</CardTitle><Button variant="ghost" size="icon" onClick={() => setAddOpen(false)}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-4"><Input placeholder="id-do-item" value={newItem.id} onChange={event => setNewItem({ ...newItem, id: event.target.value })} className="border-white/10 bg-black/20 text-white" /><Input placeholder="Nome exibido" value={newItem.name} onChange={event => setNewItem({ ...newItem, name: event.target.value })} className="border-white/10 bg-black/20 text-white" /><div className="grid grid-cols-2 gap-3"><Input placeholder="Versão" value={newItem.version} onChange={event => setNewItem({ ...newItem, version: event.target.value })} className="border-white/10 bg-black/20 text-white" /><Input placeholder="Arquivo associado" value={newItem.fileName} onChange={event => setNewItem({ ...newItem, fileName: event.target.value })} className="border-white/10 bg-black/20 text-white" /></div><Button className="w-full bg-fuchsia-500 hover:bg-fuchsia-400" disabled={add.isPending || !newItem.id || !newItem.name || !newItem.fileName} onClick={() => add.mutate(newItem)}><Plus className="mr-2 h-4 w-4" />Cadastrar item</Button></CardContent></Card></div>}
    </main>
  );
}

function Metric({ icon: Icon, label, value, accent }: { icon: typeof Database; label: string; value: string; accent: "cyan" | "emerald" | "amber" | "fuchsia" }) {
  const colors = { cyan: "text-cyan-300 bg-cyan-300/10", emerald: "text-emerald-300 bg-emerald-300/10", amber: "text-amber-200 bg-amber-300/10", fuchsia: "text-fuchsia-300 bg-fuchsia-300/10" };
  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className={`rounded-lg p-2 ${colors[accent]}`}><Icon className="h-4 w-4" /></span><span className="font-mono text-2xl font-bold text-white">{value}</span></div><p className="mt-3 text-xs text-slate-500">{label}</p></div>;
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition ${active ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/[0.02] text-slate-500"}`}><span>{label}</span>{active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</button>;
}

function LoadingRow() {
  return <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" />Carregando catálogo seguro…</div>;
}

function EmptyState() {
  return <div className="rounded-xl border border-dashed border-white/15 p-8 text-center"><LayoutDashboard className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 text-sm text-slate-400">Nenhum item neste filtro.</p></div>;
}
