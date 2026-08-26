import { useEffect, useRef, useState } from "react";
import { Eraser, Keyboard, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SignatureMethod = "typed" | "drawn" | "uploaded";

export type SignatureImageCapture = {
  mimeType: "image/png" | "image/jpeg";
  base64: string;
  sha256: string;
};

async function captureFromBytes(bytes: Uint8Array, mimeType: "image/png" | "image/jpeg"): Promise<SignatureImageCapture> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 0x8000)));
  return { mimeType, base64: btoa(binary), sha256 };
}

export function NativeEsignSignatureCapture(props: {
  method: SignatureMethod;
  signerName: string;
  capture: SignatureImageCapture | null;
  onMethodChange: (method: SignatureMethod) => void;
  onCaptureChange: (capture: SignatureImageCapture | null) => void;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (props.method !== "drawn") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 800;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#171717";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    setHasStroke(false);
    props.onCaptureChange(null);
  }, [props.method]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  }

  function begin(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.setPointerCapture(event.pointerId);
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
    drawingRef.current = true;
    setHasStroke(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  async function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
    const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, "image/png"));
    if (!blob) return props.onError("The drawn signature could not be captured. Try again or use a typed signature.");
    props.onCaptureChange(await captureFromBytes(new Uint8Array(await blob.arrayBuffer()), "image/png"));
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    props.onCaptureChange(null);
  }

  async function chooseUpload(file: File | undefined) {
    props.onError("");
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return props.onError("Upload a PNG or JPEG signature image.");
    if (file.size > 512 * 1024) return props.onError("The signature image must be 512 KB or smaller.");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    props.onCaptureChange(await captureFromBytes(new Uint8Array(await file.arrayBuffer()), file.type as "image/png" | "image/jpeg"));
  }

  const methods: Array<{ key: SignatureMethod; label: string; icon: typeof Keyboard }> = [
    { key: "typed", label: "Type", icon: Keyboard },
    { key: "drawn", label: "Draw", icon: PenLine },
    { key: "uploaded", label: "Upload", icon: Upload },
  ];

  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Signature method">
      {methods.map(({ key, label, icon: Icon }) => <Button key={key} type="button" variant={props.method === key ? "default" : "outline"} onClick={() => props.onMethodChange(key)} aria-pressed={props.method === key}><Icon className="h-4 w-4"/>{label}</Button>)}
    </div>
    {props.method === "typed" ? <div className="rounded-lg border bg-white px-4 py-5 text-center font-serif text-2xl italic" aria-label="Typed signature preview">{props.signerName || "Your signature"}</div> : null}
    {props.method === "drawn" ? <div className="space-y-2">
      <Label>Draw your signature</Label>
      <canvas ref={canvasRef} className="h-[150px] w-full touch-none rounded-lg border bg-white shadow-inner" aria-label="Draw signature area" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/>
      <Button type="button" size="sm" variant="ghost" onClick={clearDrawing} disabled={!hasStroke}><Eraser className="h-4 w-4"/>Clear drawing</Button>
    </div> : null}
    {props.method === "uploaded" ? <div className="space-y-3">
      <Label htmlFor="signature-upload">Upload a signature image</Label>
      <Input id="signature-upload" type="file" accept="image/png,image/jpeg" onChange={(event) => void chooseUpload(event.target.files?.[0])}/>
      <p className="text-xs text-muted-foreground">PNG or JPEG, no larger than 512 KB. EOS validates and stores the capture privately.</p>
      {previewUrl ? <img src={previewUrl} alt="Uploaded signature preview" className="max-h-40 w-full rounded-lg border bg-white object-contain p-3"/> : null}
    </div> : null}
  </div>;
}
