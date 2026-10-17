import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ContentFields } from "@/components/admin/ContentFields";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, buttonClass, Card, PageHeader } from "@/components/ui";
import { deleteContentAction, saveContentAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/format";

export const metadata: Metadata = { title: "Edit content" };

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const saved = one((await searchParams).saved) === "1";
  const content = await db.content.findUnique({ where: { id } });
  if (!content) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit content"
        description={<Link href="/admin/content" className="hover:underline">← Back to all content</Link>}
        actions={
          content.published ? (
            <Link href={`/awareness/${content.slug}`} className={buttonClass.secondary}>
              View live
            </Link>
          ) : null
        }
      />
      {saved && <Alert tone="success">Content created.</Alert>}
      <Card>
        <ActionForm action={saveContentAction.bind(null, content.id)}>
          <ContentFields content={content} />
          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Card>
      <Card title="Danger zone">
        <form action={deleteContentAction.bind(null, content.id)}>
          <button type="submit" className={buttonClass.danger}>
            Delete this content
          </button>
        </form>
      </Card>
    </div>
  );
}
