import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { BloodGroupSelect, Card, Field, inputClass, PageHeader } from "@/components/ui";
import { broadcastNotificationAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { DIVISIONS } from "@/lib/bd-locations";

export const metadata: Metadata = { title: "Broadcast notifications" };

export default async function AdminNotificationsPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Broadcast notifications" description="Send an in-app notification (and optional SMS) to a group of users." />
      <Card>
        <ActionForm action={broadcastNotificationAction} resetOnSuccess>
          <Field label="Audience" required>
            <select name="audience" required className={inputClass}>
              <option value="ALL">All users</option>
              <option value="DONORS">All donors</option>
              <option value="AVAILABLE_DONORS">Available donors</option>
              <option value="BLOOD_GROUP">Donors of a blood group</option>
              <option value="DISTRICT">Users in a district</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood group" hint="Only for the blood group audience.">
              <BloodGroupSelect placeholder="—" />
            </Field>
            <Field label="District" hint="Only for the district audience.">
              <select name="district" className={inputClass}>
                <option value="">—</option>
                {DIVISIONS.map((division) => (
                  <optgroup key={division.name} label={division.name}>
                    {division.districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title" required>
            <input name="title" required maxLength={120} className={inputClass} />
          </Field>
          <Field label="Message" required>
            <textarea name="body" required rows={4} maxLength={500} className={inputClass} />
          </Field>
          <Field label="Link (optional)" hint="An in-app path such as /awareness or /requests/new">
            <input name="link" maxLength={200} placeholder="/awareness" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sms" /> Also send as SMS (charges apply)
          </label>
          <SubmitButton pendingText="Sending…">Send notification</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
