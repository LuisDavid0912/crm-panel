import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  const form = await req.formData();

  const tenantSlug = String(form.get("tenant_slug") || "").trim();
  const fullName = String(form.get("full_name") || "").trim();
  const emailRaw = String(form.get("email") || "");
  const email = normalizeEmail(emailRaw);

  if (!tenantSlug || !fullName || !email) {
    return new Response("Missing fields", { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });

  if (!tenant) return new Response("Tenant not found", { status: 404 });

  const lead = await prisma.lead.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { fullName, source: "FORM", status: "NEW" },
    create: { tenantId: tenant.id, email, fullName, source: "FORM", status: "NEW" },
    select: { id: true, tenantId: true },
  });

  // Evento en timeline (sin modelo prisma para lead_events, usamos SQL directo)
  await prisma.$executeRawUnsafe(
    `insert into lead_events (tenant_id, lead_id, type, metadata)
     values ($1, $2, 'lead_created', $3::jsonb)`,
    lead.tenantId,
    lead.id,
    JSON.stringify({ source: "FORM" })
  );

  return new Response(null, {
    status: 302,
    headers: { Location: `/c/${tenantSlug}/gracias` },
  });
}
