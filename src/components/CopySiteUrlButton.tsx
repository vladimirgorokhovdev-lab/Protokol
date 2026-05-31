import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyFriendlyUrl } from "@/lib/friendlyUrl";
import { SITE_ORIGIN } from "@/lib/siteUrl";
import { cn } from "@/lib/utils";

interface CopySiteUrlButtonProps {
  className?: string;
  compact?: boolean;
}

export function CopySiteUrlButton({
  className,
  compact = false,
}: CopySiteUrlButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyFriendlyUrl();
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const label = SITE_ORIGIN.replace(/^https:\/\//, "");

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[11px] hover:text-foreground transition-colors",
          className,
        )}
        title="Скопировать ссылку на сайт (кириллица)"
      >
        {label}
        {copied ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3 opacity-60" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-xs",
        className,
      )}
      title="В буфер попадёт https://протоколъ.рф (не punycode)"
    >
      <span className="font-mono text-foreground">{label}</span>
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          <span className="text-green-600">Скопировано</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Скопировать ссылку</span>
        </>
      )}
    </button>
  );
}
