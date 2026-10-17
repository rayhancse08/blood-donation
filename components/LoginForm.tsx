"use client";

import { useActionState, useState } from "react";
import { requestOtpAction, verifyOtpAction, type OtpState } from "@/lib/actions/auth";
import { SubmitButton } from "./SubmitButton";
import { Alert, buttonClass, cn, Field, inputClass } from "./ui";

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [channel, setChannel] = useState<"PHONE" | "EMAIL">("PHONE");
  const [requestState, requestAction] = useActionState<OtpState, FormData>(requestOtpAction, { step: "request", channel: "PHONE" });
  const [verifyState, verifyAction] = useActionState<OtpState, FormData>(verifyOtpAction, { step: "verify", channel: "PHONE" });
  const [editing, setEditing] = useState(false);

  const showVerify = requestState.step === "verify" && !editing;
  const googleHref = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}

      {!showVerify ? (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
            {(["PHONE", "EMAIL"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setChannel(value)}
                className={cn(
                  "rounded-md py-2 text-sm font-medium",
                  channel === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600",
                )}
              >
                {value === "PHONE" ? "Phone number" : "Email"}
              </button>
            ))}
          </div>

          <form
            action={(formData) => {
              setEditing(false);
              requestAction(formData);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="channel" value={channel} />
            <input type="hidden" name="next" value={next ?? ""} />
            <Field label={channel === "PHONE" ? "Mobile number" : "Email address"}>
              <input
                key={channel}
                name="target"
                type={channel === "PHONE" ? "tel" : "email"}
                inputMode={channel === "PHONE" ? "tel" : "email"}
                autoComplete={channel === "PHONE" ? "tel" : "email"}
                placeholder={channel === "PHONE" ? "01XXXXXXXXX" : "you@example.com"}
                required
                className={inputClass}
              />
            </Field>
            {requestState.error && <Alert tone="error">{requestState.error}</Alert>}
            <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Sending code…">
              Send verification code
            </SubmitButton>
          </form>

          <div className="flex items-center gap-3 text-xs uppercase text-gray-400">
            <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
          </div>

          <a href={googleHref} className={`${buttonClass.secondary} w-full`}>
            <svg viewBox="0 0 48 48" className="h-5 w-5">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </a>
        </>
      ) : (
        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="target" value={requestState.target} />
          <input type="hidden" name="channel" value={requestState.channel} />
          <input type="hidden" name="next" value={next ?? ""} />
          {requestState.message && <Alert tone="success">{requestState.message}</Alert>}
          {requestState.devCode && (
            <Alert tone="warning">
              Development mode: your code is <strong>{requestState.devCode}</strong>
            </Alert>
          )}
          <Field label="Verification code">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6-digit code"
              required
              autoFocus
              className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            />
          </Field>
          {verifyState.error && <Alert tone="error">{verifyState.error}</Alert>}
          <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Verifying…">
            Verify and continue
          </SubmitButton>
          <button type="button" onClick={() => setEditing(true)} className="w-full text-sm text-gray-600 hover:underline">
            Use a different {requestState.channel === "PHONE" ? "number" : "email"}
          </button>
        </form>
      )}
    </div>
  );
}
