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

export function hasExpectedImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function captureFromBytes(bytes: Uint8Array, mimeType: "image/png" | "image/jpeg"): Promise<SignatureImageCapture> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 0x8000)));
  return { mimeType, base64: btoa(binary), sha256 };
}

export function NativeEsignSignatureCapture(props: {
  allowedMethods?: SignatureMethod[];
  method: SignatureMethod;
  signerName: string;
  capture: SignatureImageCapture | null;
  onMethodChange: (method: SignatureMethod) => void;
  onCaptureChange: (capture: SignatureImageCapture | null) => void;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadPreviewRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [hasUploadPreview, setHasUploadPreview] = useState(false);

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
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedImageSignature(bytes, file.type)) return props.onError("The file contents do not match the selected image format.");
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
      if (!bitmap.width || !bitmap.height || bitmap.width > 4096 || bitmap.height > 4096 || bitmap.width * bitmap.height > 16_000_000) {
        bitmap.close();
        return props.onError("The signature image dimensions are invalid or too large.");
      }
      const canvas = uploadPreviewRef.current;
      if (!canvas) {
        bitmap.close();
        return props.onError("The signature preview is unavailable. Try again.");
      }
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        return props.onError("The signature image could not be processed. Try again.");
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const sanitized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!sanitized) return props.onError("The signature image could not be normalized. Try again.");
      setHasUploadPreview(true);
      props.onCaptureChange(await captureFromBytes(new Uint8Array(await sanitized.arrayBuffer()), "image/png"));
    } catch {
      setHasUploadPreview(false);
      props.onCaptureChange(null);
      props.onError("The signature image could not be decoded. Upload a valid PNG or JPEG.");
    }
  }

  const methods: Array<{ key: SignatureMethod; label: string; icon: typeof Keyboard }> = [
    { key: "typed", label: "Type", icon: Keyboard },
    { key: "drawn", label: "Draw", icon: PenLine },
    { key: "uploaded", label: "Upload", icon: Upload },
  ];

  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Signature method">
      {methods.filter(({ key }) => !props.allowedMethods || props.allowedMethods.includes(key)).map(({ key, label, icon: Icon }) => <Button key={key} type="button" variant={props.method === key ? "default" : "outline"} onClick={() => props.onMethodChange(key)} aria-pressed={props.method === key}><Icon className="h-4 w-4"/>{label}</Button>)}
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
      <canvas ref={uploadPreviewRef} aria-label="Uploaded signature preview" className={`${hasUploadPreview ? "block" : "hidden"} max-h-40 w-full rounded-lg border bg-white object-contain p-3`}/>
    </div> : null}
  </div>;
}
