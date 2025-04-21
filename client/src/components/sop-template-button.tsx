import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";

interface SOPTemplateButtonProps {
  form: UseFormReturn<any>;
  username?: string;
}

export function SOPTemplateButton({ form, username }: SOPTemplateButtonProps) {
  return (
    <Button 
      size="sm" 
      variant="secondary" 
      type="button"
      onClick={() => {
        // Add the SOP template
        form.setValue('title', 'Standard Operating Procedure: ');
        form.setValue('content', 
`# STANDARD OPERATING PROCEDURE

## 1. PURPOSE
[Describe the purpose of this procedure]

## 2. SCOPE
[Define what operations, processes, or departments this SOP applies to]

## 3. RESPONSIBILITIES
[List roles and their responsibilities in executing this procedure]

### Role 1: [e.g., Manager]
- Responsibility 1
- Responsibility 2

### Role 2: [e.g., Employee]
- Responsibility 1
- Responsibility 2

## 4. PROCEDURE
[Detail the step-by-step process]

### 4.1 [First Major Step]
1. Sub-step 1
2. Sub-step 2
3. Sub-step 3

### 4.2 [Second Major Step]
1. Sub-step 1
2. Sub-step 2
3. Sub-step 3

## 5. QUALITY CONTROL
[Describe how to verify the procedure was completed correctly]

## 6. EXCEPTIONS
[List any exceptions to this procedure and how to handle them]

## 7. REFERENCES
[List related documents, regulations, or other resources]

## 8. REVISION HISTORY

| Version | Date | Description of Change | Author |
|---------|------|---------------------|--------|
| 1.0 | ${new Date().toLocaleDateString()} | Initial creation | ${username || ''} |`);
        form.setValue('tags', 'sop, procedure, process' as any);
      }}
    >
      <i className="ri-file-list-3-line mr-1.5"></i>
      Use SOP Template
    </Button>
  );
}