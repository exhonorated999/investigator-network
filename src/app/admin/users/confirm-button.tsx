"use client";

/**
 * A submit button that asks for confirmation before firing its parent form's
 * server action. Used for destructive account actions (e.g. Remove) so an
 * admin can't soft-delete someone with a stray click.
 */
export function ConfirmSubmit({
  label,
  message,
  className,
}: {
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
