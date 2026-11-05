import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Plain, readable styles for legal text (no typography plugin in this app).
const components: Components = {
  h1: (p) => <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-4" {...p} />,
  h2: (p) => <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3" {...p} />,
  h3: (p) => <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2" {...p} />,
  p: (p) => <p className="leading-7 text-gray-800 my-3" {...p} />,
  ul: (p) => <ul className="list-disc pl-6 my-3 space-y-1 text-gray-800" {...p} />,
  ol: (p) => <ol className="list-decimal pl-6 my-3 space-y-1 text-gray-800" {...p} />,
  a: (p) => <a className="text-[#11589F] underline" {...p} />,
  blockquote: (p) => (
    <blockquote className="border-l-4 border-amber-400 bg-amber-50 px-4 py-2 my-4 text-sm text-amber-900" {...p} />
  ),
  table: (p) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left align-top" {...p} />,
  td: (p) => <td className="border border-gray-300 px-3 py-2 align-top" {...p} />,
  code: (p) => <code className="rounded bg-gray-100 px-1 text-sm" {...p} />,
};

/** A public page (no sign-in) that store reviewers and customers can open. */
export function LegalPage({
  markdown,
  draft,
}: {
  markdown: string;
  draft: boolean;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {draft && (
        <div
          role="note"
          className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          Энэ баримт <strong>батлагдаагүй төсөл</strong>. Хуулийн хяналтын дараа
          эцсийн хувилбараар солигдоно.
        </div>
      )}
      <article className="rounded-xl bg-white px-5 py-6 shadow-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </article>
      <nav className="mt-6 flex gap-4 text-sm text-gray-600">
        <Link href="/privacy" className="underline">
          Нууцлалын бодлого
        </Link>
        <Link href="/support" className="underline">
          Тусламж
        </Link>
      </nav>
    </main>
  );
}
