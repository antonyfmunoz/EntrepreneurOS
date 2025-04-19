import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Plus, 
  FileText, 
  Edit2, 
  Trash2, 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  Home,
  FolderEdit,
  ArrowLeft
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Define folder type
type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

// Define document type based on our schema
type Document = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

// Folder form schema
const folderFormSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentId: z.string().optional().nullable(),
});

type FolderFormData = z.infer<typeof folderFormSchema>;

// Document form schema (derived from insertDocumentSchema)
const documentFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  folderId: z.string().optional().nullable(),
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
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  
  // Initialize document form with useForm hook
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      content: "",
      folderId: null,
      tags: "" as any,
    },
  });
  
  // Initialize folder form with useForm hook
  const folderForm = useForm<FolderFormData>({
    resolver: zodResolver(folderFormSchema),
    defaultValues: {
      name: "",
      parentId: null,
    },
  });

  // Query for fetching documents
  const { 
    data: documents, 
    isLoading: documentsLoading, 
    isError: documentsError,
    error: documentsErrorData
  } = useQuery<Document[]>({
    queryKey: ["/api/documents", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/documents?folderId=${currentFolderId}` 
        : '/api/documents';
      const res = await apiRequest("GET", url);
      return await res.json();
    },
    enabled: !!user,
  });
  
  // Query for fetching folders
  const {
    data: folders,
    isLoading: foldersLoading,
    isError: foldersError,
    error: foldersErrorData
  } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
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
  
  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folder: FolderFormData) => {
      // Add current folder as parent if we're inside a folder
      const folderData = {
        ...folder,
        parentId: folder.parentId || currentFolderId
      };
      const res = await apiRequest("POST", "/api/folders", folderData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder created",
        description: "Your folder has been created successfully.",
      });
      setShowFolderDialog(false);
      folderForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create folder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: FolderFormData }) => {
      const res = await apiRequest("PATCH", `/api/folders/${id}`, folder);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder updated",
        description: "Your folder has been updated successfully.",
      });
      setShowFolderDialog(false);
      setEditingFolder(null);
      folderForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update folder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      
      // If we deleted the current folder, go back to parent
      if (currentFolderId) {
        const currentFolder = folders?.find(f => f.id === currentFolderId);
        if (currentFolder) {
          setCurrentFolderId(currentFolder.parentId);
        }
      }
      
      toast({
        title: "Folder deleted",
        description: "The folder and its contents have been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete folder",
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
    form.setValue("folderId", document.folderId);
    form.setValue("tags", document.tags.join(", ") as any);
    setShowDocumentDialog(true);
  };

  // Handle new document
  const handleNewDocument = () => {
    setEditingDocument(null);
    form.reset();
    
    // If we're in a folder, set the folder ID for the new document
    if (currentFolderId) {
      form.setValue('folderId', currentFolderId);
    }
    
    setShowDocumentDialog(true);
  };

  // Filter documents based on search query and current folder
  const filteredDocuments = documents?.filter(doc => {
    // Filter by search query if present
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by current folder if not searching
    const matchesFolder = searchQuery ? true : (
      currentFolderId 
        ? doc.folderId === currentFolderId 
        : true // When on root, show documents without folder
    );
    
    return matchesSearch && matchesFolder;
  });

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

  // Helper function to build breadcrumb path
  const updateFolderPath = (folderId: string | null) => {
    if (folderId === null) {
      setFolderPath([]);
      return;
    }
    
    // Find the current folder
    const currentFolder = folders?.find(f => f.id === folderId);
    if (!currentFolder) return;
    
    // Build the path from root to current folder
    const path: Folder[] = [currentFolder];
    let parentId = currentFolder.parentId;
    
    while (parentId) {
      const parent = folders?.find(f => f.id === parentId);
      if (parent) {
        path.unshift(parent); // Add parent to beginning of path
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    
    setFolderPath(path);
  };
  
  // Effect to update folder path whenever current folder changes
  useEffect(() => {
    updateFolderPath(currentFolderId);
  }, [currentFolderId, folders]);
  
  // Handle folder selection
  const handleFolderSelect = (folderId: string) => {
    setCurrentFolderId(folderId);
  };
  
  // Handle new folder creation
  const handleNewFolder = () => {
    setEditingFolder(null);
    folderForm.reset();
    folderForm.setValue('parentId', currentFolderId);
    setShowFolderDialog(true);
  };
  
  // Handle folder editing
  const handleEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    folderForm.setValue('name', folder.name);
    folderForm.setValue('parentId', folder.parentId);
    setShowFolderDialog(true);
  };
  
  // Handle folder form submission
  const onFolderSubmit = (data: FolderFormData) => {
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, folder: data });
    } else {
      createFolderMutation.mutate(data);
    }
  };

  // Loading and error states
  if (documentsLoading || foldersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (documentsError || foldersError) {
    const errorMessage = documentsErrorData?.message || foldersErrorData?.message;
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
        <p className="text-destructive font-medium">Error loading data</p>
        <p>{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Documents</h1>
          {currentFolderId && (
            <Button 
              variant="ghost" 
              onClick={() => setCurrentFolderId(null)}
              size="sm"
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All Documents</span>
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleNewFolder} variant="outline">
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
          <Button onClick={handleNewDocument}>
            <Plus className="w-4 h-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>
      
      {/* Breadcrumb Navigation */}
      {folderPath.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 bg-secondary/20 p-2 rounded">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs" 
            onClick={() => setCurrentFolderId(null)}
          >
            <Home className="h-3.5 w-3.5 mr-1" />
            Home
          </Button>
          {folderPath.map((folder, index) => (
            <div key={folder.id} className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 mx-1" />
              <Button
                variant={index === folderPath.length - 1 ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setCurrentFolderId(folder.id)}
              >
                <Folder className="h-3.5 w-3.5 mr-1" />
                {folder.name}
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {/* Folders Section */}
      {!searchQuery && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">Folders</h2>
          </div>
          {folders?.filter(folder => folder.parentId === currentFolderId).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 mb-6 bg-muted/20 rounded-lg">
              <Folder className="h-12 w-12 text-muted-foreground mb-2" />
              <h3 className="text-base font-medium">No folders found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                {folders?.length === 0
                  ? "Create your first folder to organize your documents."
                  : "This folder has no subfolders."}
              </p>
              <Button onClick={handleNewFolder} variant="outline" size="sm">
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {folders?.filter(folder => folder.parentId === currentFolderId).map(folder => (
                <Card 
                  key={folder.id} 
                  className="cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => handleFolderSelect(folder.id)}
                >
                  <CardHeader className="py-4 px-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center space-x-2">
                      <Folder className="h-5 w-5" />
                      <CardTitle className="text-base">{folder.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
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
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditFolder(folder);
                        }}>
                          <FolderEdit className="mr-2 h-4 w-4" />
                          Edit Folder
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this folder? All documents inside will be moved to the root.")) {
                              deleteFolderMutation.mutate(folder.id);
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">
          {searchQuery ? "Search Results" : currentFolderId ? "Documents in this folder" : "All Documents"}
        </h2>
        <div>
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
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
                name="folderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Folder</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => field.onChange(value === "null" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a folder (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">
                          <div className="flex items-center">
                            <Home className="mr-2 h-4 w-4" />
                            <span>Root (No folder)</span>
                          </div>
                        </SelectItem>
                        {folders?.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            <div className="flex items-center">
                              <Folder className="mr-2 h-4 w-4" />
                              <span>{folder.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
      
      {/* Folder Creation/Editing Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Edit Folder" : "Create New Folder"}</DialogTitle>
            <DialogDescription>
              {editingFolder
                ? "Update the folder details."
                : "Enter a name for your new folder."}
            </DialogDescription>
          </DialogHeader>

          <Form {...folderForm}>
            <form onSubmit={folderForm.handleSubmit(onFolderSubmit)} className="space-y-6">
              <FormField
                control={folderForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Folder Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Folder" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={folderForm.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Folder</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => field.onChange(value === "null" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a parent folder (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">
                          <div className="flex items-center">
                            <Home className="mr-2 h-4 w-4" />
                            <span>Root (No parent)</span>
                          </div>
                        </SelectItem>
                        {folders?.filter(f => f.id !== editingFolder?.id).map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            <div className="flex items-center">
                              <Folder className="mr-2 h-4 w-4" />
                              <span>{folder.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowFolderDialog(false);
                    folderForm.reset();
                    setEditingFolder(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createFolderMutation.isPending || updateFolderMutation.isPending
                  }
                >
                  {(createFolderMutation.isPending || updateFolderMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingFolder ? "Update Folder" : "Create Folder"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}