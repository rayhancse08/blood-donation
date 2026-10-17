"use client";

import { useContext, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { FormPendingContext } from "./ActionForm";
import { buttonClass } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Please wait…",
  className = buttonClass.primary,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending: formPending } = useFormStatus();
  const contextPending = useContext(FormPendingContext);
  const pending = formPending || contextPending;
  return (
    <button {...rest} type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
