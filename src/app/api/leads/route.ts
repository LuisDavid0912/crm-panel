import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// ✅ Convierte BigInt -> string para que JSON no explote
function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

export async function POST(req: Request) {
  // Si estás mandando JSON desde curl:
  const body = await req.json().catch(() => ({} as any));

  const tenantSlug = String(body.tenantSlug ?? body.tenant_slug ?? "").trim();
  const fullName = String(body.fullName ?? body.full_name ?? "").trim();
  const email = normalizeEmail(String(body.email ?? ""));

  if (!tenantSlug || !fullName || !email) {
    return new NextResponse("Missing fields", { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });

  if (!tenant) return new NextResponse("Tenant not found", { status: 404 });

  const lead = await prisma.lead.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { fullName, source: "FORM", status: "NEW" },
    create: { tenantId: tenant.id, email, fullName, source: "FORM", status: "NEW" },
    select: { id: true, tenantId: true, email: true, fullName: true, source: true, createdAt: true },
  });

  // ✅ OJO: en tu tabla es payload (según lo que creaste), NO metadata, y no existe tenant_id en lead_events.
  await prisma.$executeRawUnsafe(
    `insert into lead_events (lead_id, type, payload)
     values ($1, 'lead_created', $2::jsonb)`,
    lead.id,
    JSON.stringify({ source: "FORM" })
  );

  // ✅ Devuelve JSON seguro (BigInt -> string)
  return NextResponse.json(jsonSafe({ ok: true, lead }));
}
