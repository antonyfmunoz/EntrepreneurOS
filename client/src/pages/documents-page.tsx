import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, FileText, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { SearchXIcon } from "lucide-react";

// Define document type based on our schema
type Document = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

// Document form schema (derived from insertDocumentSchema)
const documentFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  tags: z.string().optional().transform(tags => 
    tags 
      ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) 
      : []
  ) as unknown as z.ZodType<string[]>,
});

type DocumentFormData = z.infer<typeof documentFormSchema>;

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Initialize form with useForm hook
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      content: "",
      tags: "" as any,
    },
  });

  // Query for fetching documents
  const { 
    data: documents, 
    isLoading, 
    isError,
    error 
  } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: !!user,
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (document: DocumentFormData) => {
      const res = await apiRequest("POST", "/api/documents", document);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document created",
        description: "Your document has been created successfully.",
      });
      setShowDocumentDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, document }: { id: string; document: DocumentFormData }) => {
      const res = await apiRequest("PATCH", `/api/documents/${id}`, document);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document updated",
        description: "Your document has been updated successfully.",
      });
      setShowDocumentDialog(false);
      setEditingDocument(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: DocumentFormData) => {
    if (editingDocument) {
      updateDocumentMutation.mutate({ id: editingDocument.id, document: data });
    } else {
      createDocumentMutation.mutate(data);
    }
  };

  // Handle edit document
  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    form.setValue("title", document.title);
    form.setValue("content", document.content);
    form.setValue("tags", document.tags.join(", ") as any);
    setShowDocumentDialog(true);
  };

  // Handle new document
  const handleNewDocument = () => {
    setEditingDocument(null);
    form.reset();
    setShowDocumentDialog(true);
  };

  // Filter documents based on search query
  const filteredDocuments = documents?.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format date function
  const formatDate = (dateString: Date) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive font-medium">Error loading documents</p>
        <p>{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Button onClick={handleNewDocument}>
          <Plus className="w-4 h-4 mr-2" />
          New Document
        </Button>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filteredDocuments?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <SearchXIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No documents found</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            {documents?.length === 0
              ? "Create your first document by clicking the 'New Document' button above."
              : "No documents match your search criteria. Try different keywords."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments?.map((document) => (
            <Card key={document.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{document.title}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Last updated: {formatDate(document.updatedAt)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="prose-sm max-h-36 overflow-hidden relative">
                <div className="line-clamp-4">
                  {document.content}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent"></div>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <div className="flex flex-wrap gap-1">
                  {document.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {document.tags.length > 3 && (
                    <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                      +{document.tags.length - 3}
                    </span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditDocument(document)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this document?")) {
                          deleteDocumentMutation.mutate(document.id);
                        }
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Document Creation/Editing Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingDocument ? "Edit Document" : "Create New Document"}</DialogTitle>
            <DialogDescription>
              {editingDocument
                ? "Update the details of your document."
                : "Enter the details for your new document."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Document Title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your document content here..."
                        {...field}
                        className="min-h-[200px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="business, report, strategy (comma separated)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDocumentDialog(false);
                    form.reset();
                    setEditingDocument(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createDocumentMutation.isPending || updateDocumentMutation.isPending
                  }
                >
                  {(createDocumentMutation.isPending || updateDocumentMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingDocument ? "Update Document" : "Create Document"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}