import { PageHeader } from "@/components/ui/PageHeader";
import { LinkChildForm } from "./LinkChildForm";

export default function LinkChildPage() {
  return (
    <>
      <PageHeader
        eyebrow="Parent workspace"
        title="Link another child"
        intro="Enter the student code and name to add another child to your account."
      />
      <LinkChildForm />
    </>
  );
}
