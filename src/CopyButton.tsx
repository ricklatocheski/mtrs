import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({
  onClick,
  label,
  withText = false,
}: {
  onClick: () => Promise<boolean>;
  label: string;
  withText?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={"copy-button " + (copied ? "is-copied" : "")}
      aria-label={label}
      title={label}
      onClick={async () => {
        if (await onClick()) {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2200);
        }
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      <span>{copied ? "Copiado" : withText ? "Copiar" : ""}</span>
    </button>
  );
}
