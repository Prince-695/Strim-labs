"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, MessageSquare, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Please enter a valid work email"),
  company: z.string().min(1, "Company name is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", company: "", message: "" },
  });

  const onSubmit = async (values: ContactValues) => {
    // Simulate inquiry dispatch
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSubmitted(true);
  };

  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start max-w-5xl mx-auto">
          {/* Left Info Column */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              Contact &amp; Solutions
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Talk with our Capacity Engineers
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Have questions regarding high-concurrency load clusters, on-premise OTel collector deployments, or custom enterprise SLAs? Reach out and our solutions team will respond promptly.
            </p>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                  <Mail className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Email Support</div>
                  <a href="mailto:support@strim-labs.com" className="hover:text-brand">
                    support@strim-labs.com
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Community &amp; Discussions</div>
                  <a
                    href="https://github.com/Prince-695/Strim/issues"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand"
                  >
                    github.com/Prince-695/Strim
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Inquiry Received</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Thank you for reaching out. One of our capacity engineers will review your request and get back to you within 24 hours.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    placeholder="Priya Sharma"
                    disabled={isSubmitting}
                    {...register("name")}
                    className={errors.name ? "border-rose-500" : ""}
                  />
                  {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="developer@company.com"
                    disabled={isSubmitting}
                    {...register("email")}
                    className={errors.email ? "border-rose-500" : ""}
                  />
                  {errors.email && <p className="text-xs text-rose-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company">Company / Organization</Label>
                  <Input
                    id="company"
                    placeholder="Acme Corp"
                    disabled={isSubmitting}
                    {...register("company")}
                    className={errors.company ? "border-rose-500" : ""}
                  />
                  {errors.company && (
                    <p className="text-xs text-rose-500">{errors.company.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">How can we assist?</Label>
                  <Textarea
                    id="message"
                    rows={4}
                    placeholder="Tell us about your traffic volumes, concurrency requirements, or current architecture..."
                    disabled={isSubmitting}
                    {...register("message")}
                    className={errors.message ? "border-rose-500" : ""}
                  />
                  {errors.message && (
                    <p className="text-xs text-rose-500">{errors.message.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand text-brand-foreground hover:bg-brand-strong font-medium mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Inquiry
                      <Send className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
