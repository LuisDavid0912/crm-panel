import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";

  let body: any = {};

  // 1) Parse body (JSON o form)
  if (ct.includes("application/json")) {
    body = await req.json();
  } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    body = Object.fromEntries(form.entries());
  } else {
    return json({ error: "Unsupported Content-Type", contentType: ct }, 415);
  }

  // 2) Acepta snake_case y camelCase (por compat)
  const tenantSlug = String(body.tenant_slug ?? body.tenantSlug ?? "").trim();
  const fullName = String(body.full_name ?? body.fullName ?? "").trim();
  const emailRaw = String(body.email ?? "");
  const email = normalizeEmail(emailRaw);
  const source = String(body.source ?? "FORM").trim() || "FORM";

  if (!tenantSlug || !fullName || !email) {
    return json(
      { error: "Missing fields", required: ["tenantSlug|tenant_slug", "fullName|full_name", "email"] },
      400
    );
  }

  // 3) Busca tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });

  if (!tenant) return json({ error: "Tenant not found", tenantSlug }, 404);

  // 4) Upsert lead
  const lead = await prisma.lead.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { fullName, source, status: "NEW" },
    create: { tenantId: tenant.id, email, fullName, source, status: "NEW" },
    select: { id: true, tenantId: true, email: true, fullName: true, source: true, status: true },
  });

  // 5) Timeline: ajustado a tu tabla real (payload + sin tenant_id)
  await prisma.$executeRawUnsafe(
    `insert into lead_events (lead_id, type, payload)
     values ($1, $2, $3::jsonb)`,
    lead.id,
    "lead_created",
    JSON.stringify({ source })
  );

  // 6) Respuesta API
  // Si quieres mantener redirect para el formulario del front, puedes detectar Accept:text/html y redirigir.
  return json({ ok: true, lead }, 201);
}
