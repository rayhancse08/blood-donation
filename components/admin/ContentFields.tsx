import type { Content } from "@/generated/prisma/client";
import { Field, inputClass, SelectOptions } from "@/components/ui";
import { CONTENT_TYPES, LANGUAGES } from "@/lib/constants";
import { toDateTimeInputValue } from "@/lib/format";

export function ContentFields({ content }: { content?: Content | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Title" required className="sm:col-span-2">
        <input name="title" required maxLength={200} defaultValue={content?.title} className={inputClass} />
      </Field>
      <Field label="Type" required>
        <select name="type" required defaultValue={content?.type ?? "ARTICLE"} className={inputClass}>
          <SelectOptions options={CONTENT_TYPES} />
        </select>
      </Field>
      <Field label="Language" required>
        <select name="language" required defaultValue={content?.language ?? "EN"} className={inputClass}>
          <SelectOptions options={LANGUAGES} />
        </select>
      </Field>
      <Field label="Summary" className="sm:col-span-2">
        <input name="summary" maxLength={500} defaultValue={content?.summary ?? ""} className={inputClass} />
      </Field>
      <Field label="Body" required hint="Plain text. Blank lines start a new paragraph." className="sm:col-span-2">
        <textarea name="body" required rows={12} defaultValue={content?.body} className={inputClass} />
      </Field>
      <Field label="Event date" hint="For events, campaigns and donation drives.">
        <input type="datetime-local" name="eventDate" defaultValue={toDateTimeInputValue(content?.eventDate)} className={inputClass} />
      </Field>
      <Field label="Event location">
        <input name="location" maxLength={200} defaultValue={content?.location ?? ""} className={inputClass} />
      </Field>
      <Field label="Cover image" hint={content?.coverUrl ? "Leave empty to keep the current image." : "JPG, PNG or WEBP up to 5 MB."}>
        <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className={inputClass} />
      </Field>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={content?.published ?? false} /> Published
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="notifyUsers" /> Notify all users when publishing
        </label>
      </div>
    </div>
  );
}
