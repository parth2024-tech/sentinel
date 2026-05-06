import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJoinWaitlist, useGetWaitlistCount, getGetWaitlistCountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import type { WaitlistResult } from "@workspace/api-client-react";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type FormData = z.infer<typeof schema>;

interface WaitlistFormProps {
  compact?: boolean;
}

export default function WaitlistForm({ compact = false }: WaitlistFormProps) {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useJoinWaitlist({
    mutation: {
      onSuccess: (data: WaitlistResult) => {
        if (data.alreadyExists) {
          setServerError("This email is already on the waitlist.");
        } else {
          setSuccess(true);
          queryClient.invalidateQueries({ queryKey: getGetWaitlistCountQueryKey() });
        }
      },
      onError: () => {
        setServerError("Something went wrong. Please try again.");
      },
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = (data: FormData) => {
    setServerError(null);
    mutation.mutate({ data: { email: data.email } });
  };

  if (success) {
    return (
      <div
        className={`flex items-center gap-3 ${compact ? "py-3" : "py-6"} text-primary`}
        data-testid="waitlist-success"
      >
        <CheckCircle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-semibold text-sm">You're on the list.</p>
          <p className="text-xs text-muted-foreground mt-0.5">We'll let you know when Sentinel launches.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full" data-testid="form-waitlist">
      <div className={`flex ${compact ? "flex-row gap-2" : "flex-col sm:flex-row gap-3"} w-full`}>
        <div className="flex-1">
          <input
            {...register("email")}
            type="email"
            placeholder="your@email.com"
            className="w-full px-4 py-3 rounded-lg bg-muted/60 border border-border/80 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            data-testid="input-email"
          />
          {errors.email && (
            <p className="text-xs text-destructive mt-1.5" data-testid="error-email">
              {errors.email.message}
            </p>
          )}
          {serverError && (
            <p className="text-xs text-destructive mt-1.5" data-testid="error-server">
              {serverError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-5 py-3 rounded-lg font-medium text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2 justify-center whitespace-nowrap transition-all duration-200 glow-cyan"
          data-testid="button-submit-waitlist"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Joining...
            </>
          ) : (
            <>
              Get Early Access
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function WaitlistCount() {
  const { data } = useGetWaitlistCount();
  const count = data?.count ?? 0;
  if (!count) return null;
  return (
    <span className="text-xs text-muted-foreground" data-testid="text-waitlist-count">
      {count.toLocaleString()} {count === 1 ? "person" : "people"} on the waitlist
    </span>
  );
}
