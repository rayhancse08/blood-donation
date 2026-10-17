import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ContentFields } from "@/components/admin/ContentFields";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, PageHeader } from "@/components/ui";
import { saveContentAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { contentTypeLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Awareness content" };

export default async function AdminContentPage() {
  await requireAdmin();
  const contents = await db.content.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <PageHeader title="Awareness content" description="Articles, health tips, campaigns, events and donation guides in English and Bangla." />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th>Type</th>
              <th>Language</th>
              <th>Status</th>
              <th className="px-4">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contents.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/content/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td>{contentTypeLabel(c.type)}</td>
                <td>{c.language === "BN" ? "বাংলা" : "English"}</td>
                <td>
                  <Badge tone={c.published ? "green" : "gray"}>{c.published ? "Published" : "Draft"}</Badge>
                </td>
                <td className="px-4 text-xs">{formatDate(c.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {contents.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No content yet.</p>}
      </div>

      <Card title="Create content">
        <ActionForm action={saveContentAction.bind(null, null)}>
          <ContentFields />
          <SubmitButton>Create</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
