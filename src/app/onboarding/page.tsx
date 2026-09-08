"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, PenLine, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipSelect } from "@/components/shared/chip-select";
import { cn } from "@/lib/utils";
import {
  BUDGET_OPTIONS,
  GENDER_OPTIONS,
  OCCASION_OPTIONS,
  STYLE_OPTIONS,
} from "@/types/user";
import { COLOR_PALETTE } from "@/lib/colors";

const TOTAL_STEPS = 9;

export default function OnboardingPage() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [favColors, setFavColors] = useState<string[]>([]);
  const [dislikedColors, setDislikedColors] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [budget, setBudget] = useState("Mid-range");
  const [submitting, setSubmitting] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = [
    true,
    name.trim().length > 0,
    gender.length > 0,
    styles.length > 0,
    true,
    true,
    true,
    true,
    true,
  ][step];

  async function finishBasics() {
    setSubmitting(true);
    await completeOnboarding({
      name: name.trim(),
      gender,
      preferences: {
        preferredStyles: styles,
        favoriteColors: favColors,
        dislikedColors,
        occasions,
        budget,
      },
    });
    setSubmitting(false);
    next();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-xl flex-1 flex flex-col px-6 py-10">
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <div className="mb-8 flex items-center gap-3">
            <button onClick={back} className="rounded-full p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${(step / (TOTAL_STEPS - 2)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          {step === 0 && (
            <div className="text-center space-y-6">
              <p className="text-sm font-medium text-accent tracking-wide uppercase">Welcome to Vastr</p>
              <h1 className="font-display text-4xl sm:text-5xl leading-tight">
                Your closet,
                <br />
                understood by AI.
              </h1>
              <p className="text-muted-foreground text-base max-w-sm mx-auto">
                Answer a few quick questions so your AI stylist can start recommending outfits
                that actually feel like you.
              </p>
              <Button size="lg" onClick={next} className="mt-4">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <StepShell title="What should we call you?">
              <Input
                autoFocus
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg h-14 text-center"
              />
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Who are we styling?" subtitle="This tunes recommendations to the right category.">
              <div className="flex flex-col gap-3">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={cn(
                      "rounded-2xl border px-5 py-4 text-left text-sm font-medium transition-all",
                      gender === g
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Pick your styles" subtitle="Choose as many as feel right.">
              <ChipSelect options={STYLE_OPTIONS} value={styles} onChange={setStyles} />
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Colours you love" subtitle="Optional, but it helps a lot.">
              <ChipSelect options={COLOR_PALETTE} value={favColors} onChange={setFavColors} />
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title="Colours to avoid" subtitle="We'll steer clear of these.">
              <ChipSelect
                options={COLOR_PALETTE.filter((c) => !favColors.includes(c))}
                value={dislikedColors}
                onChange={setDislikedColors}
              />
            </StepShell>
          )}

          {step === 6 && (
            <StepShell title="Where do you usually dress for?" subtitle="Pick your typical occasions.">
              <ChipSelect options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} />
            </StepShell>
          )}

          {step === 7 && (
            <div className="space-y-8">
              <StepShell title="One last thing" subtitle="What's your usual shopping budget?">
                <ChipSelect
                  options={BUDGET_OPTIONS}
                  value={[budget]}
                  onChange={(v) => setBudget(v[v.length - 1] ?? budget)}
                  multiple={false}
                />
              </StepShell>
            </div>
          )}
        </div>

        {step > 0 && step < TOTAL_STEPS - 1 && (
          <Button
            size="lg"
            disabled={!canContinue || submitting}
            onClick={step === 7 ? finishBasics : next}
            className="w-full mt-8"
          >
            {step === 7 ? (submitting ? "Saving..." : "Continue") : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {step === TOTAL_STEPS - 1 && (
          <div className="flex-1 flex flex-col justify-center text-center space-y-8 animate-in fade-in duration-500">
            <div>
              <Sparkles className="h-8 w-8 text-accent mx-auto mb-4" />
              <h1 className="font-display text-3xl sm:text-4xl">Let&apos;s build your digital wardrobe.</h1>
              <p className="text-muted-foreground mt-3 max-w-sm mx-auto">
                Add a few pieces now, or later — your stylist gets smarter with every item you add.
              </p>
            </div>

            <div className="grid gap-4">
              <button
                onClick={() => router.push("/wardrobe?add=scan")}
                className="group rounded-2xl border border-border bg-card p-5 text-left hover:border-accent/50 hover:shadow-md transition-all flex items-center gap-4"
              >
                <div className="rounded-xl bg-accent/10 p-3 text-accent">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Scan my clothes</p>
                  <p className="text-sm text-muted-foreground">Upload photos, AI fills in the details</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => router.push("/wardrobe?add=manual")}
                className="group rounded-2xl border border-border bg-card p-5 text-left hover:border-accent/50 hover:shadow-md transition-all flex items-center gap-4"
              >
                <div className="rounded-xl bg-secondary p-3">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Add clothes manually</p>
                  <p className="text-sm text-muted-foreground">Fill in the details yourself</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <button
              onClick={() => router.push("/home")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now — take me to my dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
