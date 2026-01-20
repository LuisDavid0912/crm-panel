export default function ThanksPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-6 text-center">
        <h1 className="text-2xl font-semibold">¡Listo!</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Ya recibimos tus datos. En breve te llegará el recurso.
        </p>
        <a
          href={`/c/${params.slug}`}
          className="inline-block mt-6 rounded-xl bg-white text-black px-5 py-3 font-medium"
        >
          Volver
        </a>
      </div>
    </div>
  );
}
