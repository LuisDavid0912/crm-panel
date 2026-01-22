import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

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
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  let tenantSlug = "";
  let fullName = "";
  let emailRaw = "";
  let source = "FORM";

  // 1) JSON (API)
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    tenantSlug = String(body.tenantSlug ?? body.tenant_slug ?? "").trim();
    fullName = String(body.fullName ?? body.full_name ?? "").trim();
    emailRaw = String(body.email ?? "").trim();
    source = String(body.source ?? "FORM").trim() || "FORM";
  } else {
    // 2) Form (x-www-form-urlencoded o multipart/form-data)
    const form = await req.formData();
    tenantSlug = String(form.get("tenant_slug") ?? form.get("tenantSlug") ?? "").trim();
    fullName = String(form.get("full_name") ?? form.get("fullName") ?? "").trim();
    emailRaw = String(form.get("email") ?? "").trim();
    source = String(form.get("source") ?? "FORM").trim() || "FORM";
  }

  const email = normalizeEmail(emailRaw);

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
    update: { fullName, source, status: "NEW" },
    create: { tenantId: tenant.id, email, fullName, source, status: "NEW" },
    select: {
      id: true,
      tenantId: true,
      email: true,
      fullName: true,
      source: true,
      createdAt: true,
    },
  });

  // lead_events: (lead_id, type, payload)
  await prisma.$executeRaw`
    insert into lead_events (lead_id, type, payload)
    values (${lead.id}, 'lead_created', ${JSON.stringify({ source })}::jsonb)
  `;

  // ✅ Si NO es JSON, asumimos navegador/form y redirigimos al dominio real (no localhost)
  if (!ct.includes("application/json")) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("x-forwarded-server") ??
      req.headers.get("host") ??
      "crm.jucemaga.com";

    return NextResponse.redirect(`${proto}://${host}/c/${tenantSlug}/gracias`, 302);
  }

  // JSON response (API)
  return NextResponse.json(jsonSafe({ ok: true, lead }));
}

