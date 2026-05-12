import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REASONS: Array<{ value: string; label: string }> = [
  { value: "too_expensive", label: "Слишком дорого" },
  { value: "not_using", label: "Перестал(а) пользоваться" },
  { value: "missing_feature", label: "Не хватает функций" },
  { value: "quality", label: "Не устраивает качество расшифровки" },
  { value: "switching", label: "Перехожу на другой сервис" },
  { value: "temporary", label: "Временно не нужно, вернусь позже" },
  { value: "other", label: "Другая причина" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: string;
  onConfirm: () => Promise<boolean>;
}

export const CancelSurveyDialog = ({ open, onOpenChange, tier, onConfirm }: Props) => {
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Выберите причину, чтобы мы могли стать лучше.");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onConfirm();
      if (!ok) {
        toast.error("Не удалось отключить автопродление. Попробуйте ещё раз.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("subscription_cancellations").insert({
          user_id: user.id,
          tier: tier as "basic" | "pro" | "team",
          reason,
          comment: comment.trim() || null,
          contact_consent: consent,
        });
      }
      toast.success("Спасибо! Ваш ответ поможет улучшить сервис.");
      onOpenChange(false);
      setReason("");
      setComment("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Почему вы отключаете автопродление?</DialogTitle>
          <DialogDescription>
            Подписка останется активной до конца оплаченного периода. Расскажите, что пошло не так — это поможет нам стать лучше и предложить вам индивидуальные условия.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label htmlFor={`reason-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>

        <div>
          <Label htmlFor="cancel-comment" className="text-sm">Комментарий (необязательно)</Label>
          <Textarea
            id="cancel-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Что бы помогло вам остаться?"
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox id="cancel-consent" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
          <Label htmlFor="cancel-consent" className="text-sm font-normal cursor-pointer leading-snug">
            Можно связаться со мной, чтобы предложить индивидуальные условия или скидку
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Не отключать
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting ? "Сохраняем…" : "Отключить автопродление"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
