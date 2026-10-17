import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { ProfileFields } from "@/components/ProfileFields";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonClass, Card, PageContainer, PageHeader } from "@/components/ui";
import { saveProfileAction } from "@/lib/actions/profile";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const user = await requireUser({ allowIncompleteProfile: true });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Complete your profile"
        description="This helps us match you with the right donors or receivers. Only your name and blood group are visible publicly."
      />
      <Card>
        <ActionForm action={saveProfileAction} className="space-y-6">
          <input type="hidden" name="redirectTo" value="/dashboard" />
          <ProfileFields user={user} onboarding />
          <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Saving…">
            Save and continue
          </SubmitButton>
        </ActionForm>
      </Card>
    </PageContainer>
  );
}
