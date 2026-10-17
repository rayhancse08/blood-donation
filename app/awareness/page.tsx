import type { Metadata } from "next";
import Link from "next/link";
import type { ContentType, Language } from "@/generated/prisma/client";
import { Badge, EmptyState, PageContainer, PageHeader, Tabs } from "@/components/ui";
import { CONTENT_TYPES, contentTypeLabel, LANGUAGE_VALUES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, one } from "@/lib/format";

export const metadata: Metadata = { title: "Health awareness" };

export default async function AwarenessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const type = one(params.type);
  const lang = one(params.lang);
  const validType = CONTENT_TYPES.some((t) => t.value === type) ? (type as ContentType) : null;
  const validLang = (LANGUAGE_VALUES as string[]).includes(lang) ? (lang as Language) : null;

  const items = await db.content.findMany({
    where: { published: true, ...(validType ? { type: validType } : {}), ...(validLang ? { language: validLang } : {}) },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    take: 60,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Health awareness"
        description="Articles, tips, campaigns, events and donation drives to keep you and your community healthy."
      />
      <Tabs
        active={validType ?? "all"}
        items={[
          { key: "all", label: "All", href: "/awareness" },
          ...CONTENT_TYPES.map((t) => ({ key: t.value, label: t.label, href: `/awareness?type=${t.value}` })),
        ]}
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href={`/awareness${validType ? `?type=${validType}` : ""}`} className={!validLang ? "font-semibold text-red-600" : "text-gray-600"}>
          All languages
        </Link>
        <Link href={`/awareness?lang=EN${validType ? `&type=${validType}` : ""}`} className={validLang === "EN" ? "font-semibold text-red-600" : "text-gray-600"}>
          English
        </Link>
        <Link href={`/awareness?lang=BN${validType ? `&type=${validType}` : ""}`} className={validLang === "BN" ? "font-semibold text-red-600" : "text-gray-600"}>
          বাংলা
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nothing here yet" description="New awareness content will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={`/awareness/${item.slug}`} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md">
              {item.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.coverUrl} alt="" className="h-40 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="purple">{contentTypeLabel(item.type)}</Badge>
                  {item.eventDate && <Badge tone="blue">{formatDate(item.eventDate)}</Badge>}
                </div>
                <h2 className="mt-2 font-semibold">{item.title}</h2>
                {item.summary && <p className="mt-1 line-clamp-3 text-sm text-gray-600">{item.summary}</p>}
                {item.location && <p className="mt-2 text-xs text-gray-500">{item.location}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
