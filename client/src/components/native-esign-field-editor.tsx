import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Grip, Plus, Trash2 } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { NativeEsignField } from "@shared/native-esign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

let pdfRuntimePromise: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfRuntime(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([runtime, worker]) => {
      runtime.GlobalWorkerOptions.workerSrc = worker.default;
      return runtime;
    });
  }
  return pdfRuntimePromise;
}

const FIELD_TYPES: Array<{ value: NativeEsignField["type"]; label: string }> = [
  { value: "signature", label: "Signature" },
  { value: "initials", label: "Initials" },
  { value: "date", label: "Date" },
  { value: "text", label: "Text" },
  { value: "checkbox", label: "Checkbox" },
];

const FIELD_SIZES: Record<NativeEsignField["type"], { width: number; height: number }> = {
  signature: { width: 0.36, height: 0.065 },
  initials: { width: 0.16, height: 0.055 },
  date: { width: 0.2, height: 0.045 },
  text: { width: 0.32, height: 0.045 },
  checkbox: { width: 0.045, height: 0.045 },
};

type Interaction = {
  pointerId: number;
  fieldId: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  initial: NativeEsignField;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fieldLabel(type: NativeEsignField["type"]): string {
  return FIELD_TYPES.find((item) => item.value === type)?.label || type;
}

export function NativeEsignFieldEditor({
  file,
  fields,
  onFieldsChange,
  roleOptions,
}: {
  file: File | null;
  fields: NativeEsignField[];
  onFieldsChange: (fields: NativeEsignField[]) => void;
  roleOptions: Array<{ value: string; label: string }>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>("");
  const [placingType, setPlacingType] = useState<NativeEsignField["type"] | null>(null);
  const [availableWidth, setAvailableWidth] = useState(720);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const resize = new ResizeObserver(([entry]) => setAvailableWidth(Math.max(260, Math.min(820, entry.contentRect.width - 2))));
    resize.observe(host);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdf(null);
    setPage(1);
    setSelectedId("");
    setLoadError("");
    if (!file) return;
    setLoading(true);
    void Promise.all([file.arrayBuffer(), loadPdfRuntime()])
      .then(([bytes, runtime]) => {
        if (!active) throw new DOMException("PDF load cancelled", "AbortError");
        loadingTask = runtime.getDocument({ data: new Uint8Array(bytes), stopAtErrors: true });
        return loadingTask.promise;
      })
      .then((document) => {
        if (active) setPdf(document);
      })
      .catch(() => { if (active) setLoadError("EOS could not open this PDF. Use a readable, non-encrypted PDF."); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let active = true;
    let renderTask: RenderTask | null = null;
    void pdf.getPage(page).then((pdfPage) => {
      if (!active || !canvasRef.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: availableWidth / base.width });
      const pixelRatio = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setCanvasSize({ width: viewport.width, height: viewport.height });
      const context = canvas.getContext("2d");
      if (!context) return;
      renderTask = pdfPage.render({ canvas, canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      return renderTask.promise;
    }).catch((error) => {
      if (active && error?.name !== "RenderingCancelledException") setLoadError("EOS could not render this PDF page.");
    });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pdf, page, availableWidth]);

  const selected = useMemo(() => fields.find((field) => field.id === selectedId) || null, [fields, selectedId]);
  const visibleFields = useMemo(() => fields.filter((field) => field.page === page), [fields, page]);
  const missingSignatureRoles = useMemo(() => roleOptions.filter((role) => !fields.some((field) =>
    field.roleKey === role.value && field.type === "signature" && field.required,
  )), [fields, roleOptions]);

  function updateField(id: string, changes: Partial<NativeEsignField>) {
    onFieldsChange(fields.map((field) => field.id === id ? { ...field, ...changes } : field));
  }

  function placeField(event: React.PointerEvent<HTMLDivElement>) {
    if (!placingType || event.target !== event.currentTarget || !canvasSize.width || !canvasSize.height) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const size = FIELD_SIZES[placingType];
    const id = crypto.randomUUID();
    const field: NativeEsignField = {
      id,
      roleKey: roleOptions[0]?.value || "client",
      type: placingType,
      page,
      x: clamp((event.clientX - rect.left) / rect.width - size.width / 2, 0, 1 - size.width),
      y: clamp((event.clientY - rect.top) / rect.height - size.height / 2, 0, 1 - size.height),
      width: size.width,
      height: size.height,
      label: `${roleOptions[0]?.label || "Signer"} ${fieldLabel(placingType).toLowerCase()}`,
      required: true,
    };
    onFieldsChange([...fields, field]);
    setSelectedId(id);
    setPlacingType(null);
  }

  function beginInteraction(event: React.PointerEvent<HTMLDivElement>, field: NativeEsignField, mode: Interaction["mode"]) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = { pointerId: event.pointerId, fieldId: field.id, mode, startX: event.clientX, startY: event.clientY, initial: field };
    setSelectedId(field.id);
  }

  function continueInteraction(event: React.PointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !canvasSize.width || !canvasSize.height) return;
    const dx = (event.clientX - interaction.startX) / canvasSize.width;
    const dy = (event.clientY - interaction.startY) / canvasSize.height;
    if (interaction.mode === "move") {
      updateField(interaction.fieldId, {
        x: clamp(interaction.initial.x + dx, 0, 1 - interaction.initial.width),
        y: clamp(interaction.initial.y + dy, 0, 1 - interaction.initial.height),
      });
    } else {
      updateField(interaction.fieldId, {
        width: clamp(interaction.initial.width + dx, 0.025, 1 - interaction.initial.x),
        height: clamp(interaction.initial.height + dy, 0.025, 1 - interaction.initial.y),
      });
    }
  }

  function endInteraction(event: React.PointerEvent<HTMLDivElement>) {
    if (interactionRef.current?.pointerId === event.pointerId) interactionRef.current = null;
  }

  if (!file) return null;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-3" ref={hostRef}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Place signer fields</p>
          <p className="text-xs text-muted-foreground">Choose a field, tap its exact PDF location, then drag or resize it. Coordinates are stored against this immutable version.</p>
        </div>
        {pdf && <div className="flex items-center gap-1 text-xs font-medium"><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} aria-label="Previous PDF page"><ChevronLeft className="h-4 w-4"/></Button><span className="min-w-20 text-center">Page {page} of {pdf.numPages}</span><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((value) => Math.min(pdf.numPages, value + 1))} disabled={page === pdf.numPages} aria-label="Next PDF page"><ChevronRight className="h-4 w-4"/></Button></div>}
      </div>

      <div className="flex flex-wrap gap-2">
        {FIELD_TYPES.map((type) => <Button key={type.value} type="button" size="sm" variant={placingType === type.value ? "default" : "outline"} onClick={() => setPlacingType((value) => value === type.value ? null : type.value)}><Plus className="mr-1 h-3.5 w-3.5"/>{type.label}</Button>)}
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Opening PDF…</p>}
      {loadError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}
      <div className="overflow-auto rounded-lg bg-neutral-200 p-2">
        <div className="relative mx-auto bg-white shadow-sm" style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}>
          <canvas ref={canvasRef} className="block" aria-label={`PDF page ${page}`}/>
          {!!canvasSize.width && <div className={`absolute inset-0 touch-none ${placingType ? "cursor-crosshair" : ""}`} onPointerDown={placeField}>
            {visibleFields.map((field) => <div
              key={field.id}
              className={`absolute flex select-none items-center overflow-hidden border-2 px-1 text-[10px] font-semibold shadow-sm ${selectedId === field.id ? "border-violet-700 bg-violet-200/80 text-violet-950" : "border-violet-500 bg-violet-100/70 text-violet-900"}`}
              style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%` }}
              onPointerDown={(event) => beginInteraction(event, field, "move")}
              onPointerMove={continueInteraction}
              onPointerUp={endInteraction}
              onPointerCancel={endInteraction}
            ><Grip className="mr-1 h-3 w-3 shrink-0"/><span className="truncate">{field.label}</span><div className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize border-l border-t border-violet-700 bg-white" onPointerDown={(event) => beginInteraction(event, field, "resize")}/></div>)}
          </div>}
        </div>
      </div>

      {selected && <div className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium sm:col-span-2">Field label<Input value={selected.label} onChange={(event) => updateField(selected.id, { label: event.target.value })}/></label>
        <label className="space-y-1 text-xs font-medium">Signer role<select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selected.roleKey} onChange={(event) => updateField(selected.id, { roleKey: event.target.value })}>{roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium">Page<Input type="number" min={1} max={pdf?.numPages || 1} value={selected.page} onChange={(event) => { const nextPage = clamp(Number(event.target.value), 1, pdf?.numPages || 1); updateField(selected.id, { page: nextPage }); setPage(nextPage); }}/></label>
        <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={selected.required} onChange={(event) => updateField(selected.id, { required: event.target.checked })}/>Required</label>
        <Button type="button" variant="outline" size="sm" className="justify-self-start text-destructive" onClick={() => { onFieldsChange(fields.filter((field) => field.id !== selected.id)); setSelectedId(""); }}><Trash2 className="mr-1 h-4 w-4"/>Remove field</Button>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{fields.length} field{fields.length === 1 ? "" : "s"} across {pdf?.numPages || "…"} page{pdf?.numPages === 1 ? "" : "s"}</span><span className={missingSignatureRoles.length ? "font-medium text-destructive" : "font-medium text-primary"}>{missingSignatureRoles.length ? `Required signature needed for ${missingSignatureRoles.map((role) => role.label).join(", ")}` : `Every signer role has a required signature`}</span></div>
    </div>
  );
}
