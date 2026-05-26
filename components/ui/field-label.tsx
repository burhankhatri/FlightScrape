import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  htmlFor?: string;
}

/** Sentence-case field label — subtle, not shouty uppercase */
export function FieldLabel({ children, htmlFor }: Props) {
  return (
    <label htmlFor={htmlFor} className="type-label block mb-1.5">
      {children}
    </label>
  );
}
