"use client";

import { createContext, useActionState, useEffect, useRef, useTransition, type ReactNode } from "react";
import type { ActionState } from "@/lib/form";
import { FormMessage } from "./ui";

export const FormPendingContext = createContext(false);

/**
 * Submits through a transition instead of `<form action>` so React does not
 * reset the user's input when the server action returns a validation error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className ?? "space-y-4"}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <FormMessage state={state} />
      <FormPendingContext value={pending}>{children}</FormPendingContext>
    </form>
  );
}
