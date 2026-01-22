import { notFound } from "next/navigation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Recomendado mientras estás iterando en prod (evita caching raro)
export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
}: {
  params: { slug?: string };
}) {
  const slug = (params?.slug ?? "").trim();

  if (!slug) {
    return notFound();
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!tenant) {
    return notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-6">
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Déjame tu nombre y correo para enviarte el recurso.
        </p>

        <form action="/api/leads" method="POST" className="mt-6 space-y-4">
          <input type="hidden" name="tenant_slug" value={slug} />

          <div>
            <label className="text-sm text-zinc-300">Nombre</label>
            <input
              name="full_name"
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3"
              placeholder="Tu nombre"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300">Email</label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3"
              placeholder="tucorreo@email.com"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-white text-black py-3 font-medium"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}

  );
}
