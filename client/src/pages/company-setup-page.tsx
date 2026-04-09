import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const companySetupSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  type: z.string().optional(),
  stage: z.string().optional(),
  offer: z.string().optional(),
  targetCustomer: z.string().optional(),
  goals: z.string().optional(),
});

type CompanySetupValues = z.infer<typeof companySetupSchema>;

export default function CompanySetupPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<CompanySetupValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      name: "",
      type: "",
      stage: "",
      offer: "",
      targetCustomer: "",
      goals: "",
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (values: CompanySetupValues) => {
      const res = await apiRequest("POST", "/api/company", values);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/company"],
      });
  
      setLocation("/home");
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn’t create company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CompanySetupValues) => {
    createCompanyMutation.mutate(values);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(1200px_circle_at_50%_-20%,hsl(var(--primary))_0%,transparent_55%)] opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <Card className="w-full border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">Create Your Company</CardTitle>
            <CardDescription className="text-muted-foreground">
              Set up the basics so your workspace can personalize everything else.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc." autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Input placeholder="SaaS, Agency, Marketplace…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <FormControl>
                          <Input placeholder="Idea, MVP, Growth…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="offer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What do you sell, in one clear sentence?"
                          className="min-h-[90px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetCustomer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target customer</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Who is this for? (roles, segments, industries)"
                          className="min-h-[90px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goals</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What would success look like over the next 30–90 days?"
                          className="min-h-[90px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={createCompanyMutation.isPending}>
                    {createCompanyMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Company
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

