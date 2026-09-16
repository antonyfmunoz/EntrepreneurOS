import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, CheckCircle2, CreditCard, PackageCheck, Plus, RefreshCw, Repeat2, ShoppingBag } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}
function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}
function minor(value: string) {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}
function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0) / 100);
}
function stateVariant(state: string) { return state === "active" || state === "completed" ? "default" as const : "outline" as const; }

export function NativeCommerceStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [offerName, setOfferName] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [orderName, setOrderName] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [entitlementScope, setEntitlementScope] = useState("service_delivery");
  const [error, setError] = useState("");

  const commerceQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-commerce"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/commerce`)).json() });
  const crmQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-commerce-buyers"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json() });
  const objects: Json[] = commerceQuery.data?.objects || [];
  const offers = useMemo(() => objects.filter((object) => object.objectType === "offer"), [objects]);
  const orders = useMemo(() => objects.filter((object) => object.objectType === "order"), [objects]);
  const subscriptions = useMemo(() => objects.filter((object) => object.objectType === "subscription"), [objects]);
  const entitlements = useMemo(() => objects.filter((object) => object.objectType === "entitlement"), [objects]);
  const buyers: Json[] = (crmQuery.data?.objects || []).filter((object: Json) => object.objectType === "person");
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) || offers.find((offer) => offer.state === "active") || offers[0];
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders[0];
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-commerce"] }), queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-commerce-buyers"] })]); };

  const createOffer = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "commerce", objectType: "offer", objectKey: `offer:${safeKey(offerName)}:${Date.now()}`,
      title: offerName.trim(), summary: offerDescription.trim(), classification: "confidential", visibility: "team",
      data: { name: offerName.trim(), priceMinor: minor(offerPrice), currency: "USD", operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "offer_catalog" }, evidenceIds: [], idempotencyKey: commandKey("native-offer-create"),
    })).json(),
    onSuccess: async (result) => { setSelectedOfferId(result.object.id); setOfferName(""); setOfferDescription(""); setOfferPrice(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!selectedOffer) throw new Error("Create or select an offer first.");
      if (!selectedBuyerId) throw new Error("Select a governed CRM person as the buyer.");
      const buyer = buyers.find((person) => person.id === selectedBuyerId);
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "commerce", objectType: "order", objectKey: `order:${safeKey(orderName || selectedOffer.title)}:${Date.now()}`,
        title: orderName.trim() || `${selectedOffer.title} order`, summary: "Native EOS commercial commitment pending the authorized payment path.", classification: "confidential", visibility: "team", parentObjectId: selectedOffer.id,
        data: { offerObjectId: selectedOffer.id, buyerReference: selectedBuyerId, amountMinor: Number(selectedOffer.data?.priceMinor || 0), currency: "USD", buyerDisplayName: buyer?.data?.displayName || buyer?.title || "Governed buyer", paymentState: "pending_authorized_collection", operatingMode: "native_eos" },
        sourceReference: { authority: "native_eos", capability: "order_management", paymentExecution: "not_dispatched" }, evidenceIds: [], idempotencyKey: commandKey("native-order-create"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedOrderId(result.object.id); setOrderName(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createSubscription = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error("Create or select an order first.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "commerce", objectType: "subscription", objectKey: `subscription:${safeKey(selectedOrder.title)}:${Date.now()}`,
        title: `${selectedOrder.title} subscription`, summary: "Native EOS recurring-service schedule. Payment collection remains separately authorized.", classification: "confidential", visibility: "team", parentObjectId: selectedOrder.id,
        data: { orderObjectId: selectedOrder.id, interval: "month", operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "subscription_management", paymentExecution: "not_dispatched" }, evidenceIds: [], idempotencyKey: commandKey("native-subscription-create"),
      })).json();
    }, onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const createEntitlement = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error("Create or select an order first.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "commerce", objectType: "entitlement", objectKey: `entitlement:${safeKey(selectedOrder.title)}:${Date.now()}`,
        title: `${selectedOrder.title} entitlement`, summary: "Native EOS delivery entitlement linked to a governed order.", classification: "confidential", visibility: "team", parentObjectId: selectedOrder.id,
        data: { subjectReference: selectedOrder.data?.buyerReference || "governed-buyer", scope: entitlementScope.trim(), orderObjectId: selectedOrder.id, operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "delivery_entitlement" }, evidenceIds: [], idempotencyKey: commandKey("native-entitlement-create"),
      })).json();
    }, onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const transition = useMutation({
    mutationFn: async ({ object, state }: { object: Json; state: "active" | "completed" }) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state, rationale: state === "active" ? "Activate the governed native EOS commercial record after authorized review." : "Record the governed commercial record as completed with its source and payment state retained.", evidenceIds: [], idempotencyKey: commandKey(`native-commerce-${state}`),
    })).json(), onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });

  return <Card data-testid="native-commerce-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" />Native Commerce Studio</CardTitle><CardDescription className="mt-1">Run the offer catalog, governed orders, service subscriptions, and delivery entitlements in EOS. A payment provider can execute an approved collection later, but it is not required to define the commercial system or is falsely represented as having collected money.</CardDescription></div><Button size="sm" variant="outline" onClick={() => { commerceQuery.refetch(); crmQuery.refetch(); }} disabled={commerceQuery.isFetching || crmQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${(commerceQuery.isFetching || crmQuery.isFetching) ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Commerce command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" /><h3 className="font-semibold">Offer catalog</h3></div><p className="mt-1 text-sm text-muted-foreground">Create the actual offer EOS should sell, separate from any payment processor’s product catalog.</p><div className="mt-4 grid gap-3"><Input value={offerName} onChange={(event) => setOfferName(event.target.value)} placeholder="Offer name" aria-label="Offer name" /><Textarea value={offerDescription} onChange={(event) => setOfferDescription(event.target.value)} placeholder="Result, scope, and delivery promise" aria-label="Offer description" /><Input value={offerPrice} onChange={(event) => setOfferPrice(event.target.value)} inputMode="decimal" placeholder="Price (USD)" aria-label="Offer price" /><Button disabled={!canExecute || offerName.trim().length < 2 || offerDescription.trim().length < 3 || createOffer.isPending} onClick={() => createOffer.mutate()}><Plus className="mr-2 h-4 w-4" />{createOffer.isPending ? "Creating…" : "Create offer"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-primary" /><h3 className="font-semibold">Governed order</h3></div><p className="mt-1 text-sm text-muted-foreground">A native order ties an EOS offer to a governed CRM buyer. It is not a claim that an external charge has happened.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="commerce-offer">Offer</Label><select id="commerce-offer" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedOffer?.id || ""} onChange={(event) => setSelectedOfferId(event.target.value)}><option value="">Select offer</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.title} · {money(offer.data?.priceMinor)}</option>)}</select></div><div><Label htmlFor="commerce-buyer">CRM buyer</Label><select id="commerce-buyer" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedBuyerId} onChange={(event) => setSelectedBuyerId(event.target.value)}><option value="">Select a governed person</option>{buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.data?.displayName || buyer.title}</option>)}</select></div><Input value={orderName} onChange={(event) => setOrderName(event.target.value)} placeholder="Order label (optional)" aria-label="Order label" /><Button disabled={!canExecute || !selectedOffer || !selectedBuyerId || createOrder.isPending} onClick={() => createOrder.mutate()}><Plus className="mr-2 h-4 w-4" />{createOrder.isPending ? "Creating…" : "Create order"}</Button></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Repeat2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Service and delivery controls</h3></div><p className="mt-1 text-sm text-muted-foreground">Turn an order into a recurring service schedule or a concrete delivery entitlement. The commercial promise stays visible to operations without needing an external billing interface.</p><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedOrder?.id || ""} onChange={(event) => setSelectedOrderId(event.target.value)} aria-label="Service order"><option value="">Select order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.title}</option>)}</select><Input value={entitlementScope} onChange={(event) => setEntitlementScope(event.target.value)} placeholder="Delivery scope" aria-label="Entitlement scope" /><Button variant="outline" disabled={!canExecute || !selectedOrder || createSubscription.isPending} onClick={() => createSubscription.mutate()}><Repeat2 className="mr-2 h-4 w-4" />Add subscription</Button><Button variant="outline" disabled={!canExecute || !selectedOrder || entitlementScope.trim().length < 2 || createEntitlement.isPending} onClick={() => createEntitlement.mutate()}><PackageCheck className="mr-2 h-4 w-4" />Grant entitlement</Button></div></section>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Native operating view</p><h3 className="mt-1 font-semibold">Commercial control board</h3></div><Badge variant="outline">{offers.length} offers · {orders.length} orders · {subscriptions.length} subscriptions · {entitlements.length} entitlements</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-3">{offers.map((offer) => { const relatedOrders = orders.filter((order) => order.data?.offerObjectId === offer.id); return <div key={offer.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{offer.title}</p><p className="mt-1 text-xs text-muted-foreground">{offer.summary || "No scope recorded"}</p></div><Badge variant={stateVariant(offer.state)}>{offer.state}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-background p-2">Price<br /><strong>{money(offer.data?.priceMinor)}</strong></div><div className="rounded-lg bg-background p-2">Orders<br /><strong>{relatedOrders.length}</strong></div></div><div className="mt-3 flex flex-wrap gap-2">{offer.state === "draft" && <Button size="sm" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: offer, state: "active" })}>Activate offer</Button>}</div></div>; })}{!offers.length && <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Create the first offer to make the company’s commercial promise actionable inside EOS.</div>}</div><div className="mt-4 space-y-2">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{order.title}</p><p className="mt-1 text-xs text-muted-foreground">{order.data?.buyerDisplayName || "Governed buyer"} · {money(order.data?.amountMinor)} · {order.data?.paymentState || "pending"}</p></div><div className="flex items-center gap-2"><Badge variant={stateVariant(order.state)}>{order.state}</Badge>{order.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: order, state: "active" })}>Activate order</Button>}{order.state === "active" && <Button size="sm" variant="outline" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: order, state: "completed" })}>Complete delivery</Button>}</div></div>)}</div></section>
      <Alert><CreditCard className="h-4 w-4" /><AlertTitle>Native commercial state, explicit payment boundary</AlertTitle><AlertDescription>EOS owns what is being sold, to whom, for what amount, and what delivery is owed. An external payment processor is an optional execution layer for an approved collection; until it returns a verified receipt, the order remains visibly pending rather than being marked paid by assumption.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
