import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, buttonClass, PageContainer } from "@/components/ui";
import { contentTypeLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Health awareness" };

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await db.content.findFirst({
    where: { slug, published: true },
    include: { author: { select: { name: true } } },
  });
  if (!item) notFound();

  const paragraphs = item.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const isEvent = ["EVENT", "CAMPAIGN", "DONATION_DRIVE"].includes(item.type);

  return (
    <PageContainer className="max-w-3xl">
      <article lang={item.language === "BN" ? "bn" : "en"}>
        <Link href="/awareness" className="text-sm text-gray-600 hover:underline">
          ← Health awareness
        </Link>
        <div className="mt-4 flex flex-wrap gap-1">
          <Badge tone="purple">{contentTypeLabel(item.type)}</Badge>
        </div>
        <h1 className="mt-3 break-words text-2xl font-bold sm:text-3xl">{item.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {item.author?.name ? `${item.author.name} · ` : ""}
          {formatDate(item.createdAt)}
        </p>
        {item.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverUrl} alt="" className="mt-6 max-h-60 w-full rounded-xl object-cover sm:max-h-96" />
        )}
        {isEvent && (item.eventDate || item.location) && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            {item.eventDate && (
              <p>
                <strong>When:</strong> {formatDateTime(item.eventDate)}
              </p>
            )}
            {item.location && (
              <p>
                <strong>Where:</strong> {item.location}
              </p>
            )}
          </div>
        )}
        {item.summary && <p className="mt-6 text-base text-gray-700 sm:text-lg">{item.summary}</p>}
        <div className="mt-6 space-y-4 break-words leading-relaxed text-gray-800">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
        {item.type === "DONATION_DRIVE" && (
          <Link href="/profile#roles" className={`${buttonClass.primary} mt-8`}>
            Become a donor
          </Link>
        )}
      </article>
    </PageContainer>
  );
}
