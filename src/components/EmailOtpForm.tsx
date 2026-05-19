import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const OTP_LENGTH = 8;

type EmailOtpFormProps = {
  email: string;
  onSuccess?: () => void;
};

export function EmailOtpForm({ email, onSuccess }: EmailOtpFormProps) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async () => {
    const token = otp.replace(/\s/g, "");
    if (token.length !== OTP_LENGTH) {
      toast({
        title: "Введите код",
        description: `Код из письма — ${OTP_LENGTH} цифр.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    let { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      error = retry.error;
    }

    setLoading(false);

    if (error) {
      toast({
        title: "Неверный или устаревший код",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Email подтверждён",
      description: "Можно войти и начать расшифровку.",
    });

    if (onSuccess) {
      onSuccess();
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Код из письма отправлен на{" "}
        <span className="font-medium text-foreground">{email}</span>
      </p>
      <div className="flex justify-center">
        <InputOTP
          maxLength={OTP_LENGTH}
          value={otp}
          onChange={setOtp}
          onComplete={handleVerify}
        >
          <InputOTPGroup>
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <button
        type="button"
        onClick={handleVerify}
        disabled={loading || otp.length < OTP_LENGTH}
        className="w-full px-4 py-3 rounded-xl bg-navy text-primary-foreground hover:bg-navy-light transition-colors font-medium text-sm disabled:opacity-50"
      >
        {loading ? "Проверка..." : "Подтвердить код"}
      </button>
    </div>
  );
}
