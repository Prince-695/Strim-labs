"use client";

import { Building2, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useCreateOrg } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { Field } from "./ui/label";

export function CreateOrgModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { orgs, setOrgId, refreshOrgs } = useSession();
  const createOrg = useCreateOrg();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setName("");
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter an organization name.");
      return;
    }
    if (orgs.length >= 3) {
      setError("Maximum limit of 3 organizations per user reached.");
      return;
    }

    try {
      const res = await createOrg.mutateAsync({ name: name.trim() });
      await refreshOrgs();
      setOrgId(res.org.id);
      toast.success(`Organization "${res.org.name}" created!`);
      close(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to create organization. You may have reached the 3-org limit."
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Create New Organization"
      description="Organizations group projects, members, and production telemetry together."
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createOrg.isPending}>
            Create Organization
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quota Indicator */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Building2 className="size-3.5 text-brand" /> Organization Quota
          </span>
          <span className="font-mono text-muted-foreground">
            {orgs.length} / 3 max
          </span>
        </div>

        <Field id="org-name" label="Organization Name" error={error ? error : undefined}>
          <Input
            id="org-name"
            data-autofocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Acme Corp, Engineering Team"
          />
        </Field>

        {error && (
          <Alert tone="danger" title="Unable to create organization">
            {error}
          </Alert>
        )}
      </form>
    </Dialog>
  );
}
