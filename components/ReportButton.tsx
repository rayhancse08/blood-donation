"use client";

import { useState } from "react";
import { reportAction } from "@/lib/actions/safety";
import { REPORT_REASONS } from "@/lib/constants";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { buttonClass, Field, inputClass } from "./ui";

export function ReportButton({
  reportedUserId,
  requestId,
  label = "Report",
}: {
  reportedUserId?: string;
  requestId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass.small}>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold">Report a problem</h3>
            <ActionForm action={reportAction} resetOnSuccess>
              {reportedUserId && <input type="hidden" name="reportedUserId" value={reportedUserId} />}
              {requestId && <input type="hidden" name="requestId" value={requestId} />}
              <Field label="Reason" required>
                <select name="reason" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Select a reason
                  </option>
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </select>
              </Field>
              <Field label="Details">
                <textarea name="details" rows={3} maxLength={1000} className={inputClass} />
              </Field>
              {reportedUserId && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="block" /> Also block this user
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={buttonClass.secondary}>
                  Close
                </button>
                <SubmitButton className={buttonClass.primary}>Submit report</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
