import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Building2, 
  MoreHorizontal, 
  Star, 
  Phone, 
  Mail, 
  Search, 
  Plus,
  FileText,
  BarChart,
  Clock,
  CheckCircle2,
  Calendar,
  PieChart,
  MessageSquare
} from "lucide-react";

// Types for CRM data
type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  status: "lead" | "prospect" | "customer" | "churned";
  lastContact: string;
  notes: string;
  avatar?: string;
};

type Deal = {
  id: string;
  title: string;
  company: string;
  value: number;
  stage: "discovery" | "proposal" | "negotiation" | "closed-won" | "closed-lost";
  probability: number;
  expectedCloseDate: string;
  contactId: string;
  assignedAgentId: string;
  notes: string;
};

type Activity = {
  id: string;
  type: "email" | "call" | "meeting" | "task" | "note";
  subject: string;
  date: string;
  relatedTo: {
    type: "contact" | "deal";
    id: string;
    name: string;
  };
  completed: boolean;
  notes: string;
  createdByAgentId: string;
};

// Mock data for development
const mockContacts: Contact[] = [
  {
    id: "contact_1",
    name: "Jane Cooper",
    email: "jane.cooper@example.com",
    phone: "(555) 123-4567",
    company: "Acme Inc",
    title: "CEO",
    status: "customer",
    lastContact: "2025-04-15",
    notes: "Key decision maker, prefers email communication"
  },
  {
    id: "contact_2",
    name: "Alex Rodriguez",
    email: "alex.rodriguez@techlabs.com",
    phone: "(555) 234-5678",
    company: "TechLabs",
    title: "CTO",
    status: "lead",
    lastContact: "2025-04-10",
    notes: "Interested in AI solutions"
  },
  {
    id: "contact_3",
    name: "Emily Johnson",
    email: "emily@innovatech.co",
    phone: "(555) 345-6789",
    company: "InnovaTech",
    title: "Marketing Director",
    status: "prospect",
    lastContact: "2025-04-05",
    notes: "Follow up about marketing automation"
  },
  {
    id: "contact_4",
    name: "Michael Chen",
    email: "michael@globalfirm.com",
    phone: "(555) 456-7890",
    company: "Global Firm",
    title: "Operations Manager",
    status: "customer",
    lastContact: "2025-04-12",
    notes: "Renewal coming up in 2 months"
  },
  {
    id: "contact_5",
    name: "Sarah Williams",
    email: "sarah@startupnow.io",
    phone: "(555) 567-8901",
    company: "StartupNow",
    title: "Founder",
    status: "prospect",
    lastContact: "2025-04-08",
    notes: "Discussing enterprise plan options"
  }
];

const mockDeals: Deal[] = [
  {
    id: "deal_1",
    title: "Enterprise AI Implementation",
    company: "Acme Inc",
    value: 75000,
    stage: "proposal",
    probability: 60,
    expectedCloseDate: "2025-05-30",
    contactId: "contact_1",
    assignedAgentId: "agent_executive",
    notes: "Proposal sent, waiting for feedback"
  },
  {
    id: "deal_2",
    title: "Marketing Automation Suite",
    company: "InnovaTech",
    value: 45000,
    stage: "discovery",
    probability: 30,
    expectedCloseDate: "2025-06-15",
    contactId: "contact_3",
    assignedAgentId: "agent_sales",
    notes: "Initial discovery call completed"
  },
  {
    id: "deal_3",
    title: "AI Developer Tools Package",
    company: "TechLabs",
    value: 25000,
    stage: "negotiation",
    probability: 80,
    expectedCloseDate: "2025-05-15",
    contactId: "contact_2",
    assignedAgentId: "agent_sales",
    notes: "Discussing final terms"
  },
  {
    id: "deal_4",
    title: "Operations Analytics Platform",
    company: "Global Firm",
    value: 60000,
    stage: "closed-won",
    probability: 100,
    expectedCloseDate: "2025-04-10",
    contactId: "contact_4",
    assignedAgentId: "agent_executive",
    notes: "Contract signed, implementation begins next week"
  },
  {
    id: "deal_5",
    title: "Startup Growth Package",
    company: "StartupNow",
    value: 15000,
    stage: "negotiation",
    probability: 70,
    expectedCloseDate: "2025-05-10",
    contactId: "contact_5",
    assignedAgentId: "agent_sales",
    notes: "Discussing payment terms"
  }
];

const mockActivities: Activity[] = [
  {
    id: "activity_1",
    type: "call",
    subject: "Initial discovery call",
    date: "2025-04-15",
    relatedTo: {
      type: "contact",
      id: "contact_2",
      name: "Alex Rodriguez"
    },
    completed: true,
    notes: "Discussed AI integration needs",
    createdByAgentId: "agent_sales"
  },
  {
    id: "activity_2",
    type: "email",
    subject: "Proposal follow-up",
    date: "2025-04-16",
    relatedTo: {
      type: "deal",
      id: "deal_1",
      name: "Enterprise AI Implementation"
    },
    completed: true,
    notes: "Sent additional information about implementation timeline",
    createdByAgentId: "agent_executive"
  },
  {
    id: "activity_3",
    type: "meeting",
    subject: "Contract negotiation",
    date: "2025-04-20",
    relatedTo: {
      type: "deal",
      id: "deal_3",
      name: "AI Developer Tools Package"
    },
    completed: false,
    notes: "Prepare pricing adjustments",
    createdByAgentId: "agent_sales"
  },
  {
    id: "activity_4",
    type: "task",
    subject: "Prepare demo environment",
    date: "2025-04-18",
    relatedTo: {
      type: "deal",
      id: "deal_2",
      name: "Marketing Automation Suite"
    },
    completed: false,
    notes: "Set up custom demo with sample data",
    createdByAgentId: "agent_executive"
  },
  {
    id: "activity_5",
    type: "note",
    subject: "Customer feedback",
    date: "2025-04-14",
    relatedTo: {
      type: "contact",
      id: "contact_4",
      name: "Michael Chen"
    },
    completed: true,
    notes: "Very satisfied with initial setup, interested in expanding",
    createdByAgentId: "agent_sales"
  }
];

// Helper function to get status badge color
function getStatusBadge(status: Contact["status"]) {
  switch (status) {
    case "lead":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Lead</Badge>;
    case "prospect":
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Prospect</Badge>;
    case "customer":
      return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Customer</Badge>;
    case "churned":
      return <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">Churned</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

// Helper function to get deal stage badge
function getDealStageBadge(stage: Deal["stage"]) {
  switch (stage) {
    case "discovery":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Discovery</Badge>;
    case "proposal":
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Proposal</Badge>;
    case "negotiation":
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50">Negotiation</Badge>;
    case "closed-won":
      return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Closed Won</Badge>;
    case "closed-lost":
      return <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">Closed Lost</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

// Helper function to get activity type icon
function getActivityTypeIcon(type: Activity["type"]) {
  switch (type) {
    case "call":
      return <Phone className="h-4 w-4 text-blue-500" />;
    case "email":
      return <Mail className="h-4 w-4 text-purple-500" />;
    case "meeting":
      return <Calendar className="h-4 w-4 text-green-500" />;
    case "task":
      return <CheckCircle2 className="h-4 w-4 text-amber-500" />;
    case "note":
      return <FileText className="h-4 w-4 text-gray-500" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

export default function CRMPage() {
  const [selectedTab, setSelectedTab] = useState("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  
  // In a real app, these would be React Query hooks fetching from your backend
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/crm/contacts"],
    queryFn: async () => {
      // In a real app, this would be a fetch call to your API
      // For now, we'll just return the mock data
      return new Promise<Contact[]>((resolve) => {
        setTimeout(() => resolve(mockContacts), 500);
      });
    },
  });
  
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["/api/crm/deals"],
    queryFn: async () => {
      return new Promise<Deal[]>((resolve) => {
        setTimeout(() => resolve(mockDeals), 500);
      });
    },
  });
  
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/crm/activities"],
    queryFn: async () => {
      return new Promise<Activity[]>((resolve) => {
        setTimeout(() => resolve(mockActivities), 600);
      });
    },
  });
  
  // Filter contacts based on search query
  const filteredContacts = contacts?.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Filter deals based on search query
  const filteredDeals = deals?.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-1 md:p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customer Relationship Management</h1>
        <div className="flex items-center space-x-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <h3 className="text-2xl font-bold">{contacts?.length || 0}</h3>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Active Deals</p>
                <h3 className="text-2xl font-bold">
                  {deals?.filter(deal => 
                    deal.stage !== "closed-won" && deal.stage !== "closed-lost"
                  ).length || 0}
                </h3>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <BarChart className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <h3 className="text-2xl font-bold">
                  ${deals?.reduce((sum, deal) => 
                    deal.stage !== "closed-lost" ? sum + deal.value : sum, 0
                  ).toLocaleString() || 0}
                </h3>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <PieChart className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="contacts" value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="contacts" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            <span>Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex items-center">
            <Building2 className="mr-2 h-4 w-4" />
            <span>Deals</span>
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            <span>Activities</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="contacts" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>
                  Manage your business contacts
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* This would be a form in the real app */}
                    <p className="text-sm text-muted-foreground">Contact creation form would go here</p>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactsLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredContacts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No contacts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContacts?.map(contact => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{contact.name}</div>
                                <div className="text-sm text-muted-foreground">{contact.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{contact.company}</TableCell>
                          <TableCell>{getStatusBadge(contact.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>{new Date(contact.lastContact).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>Add Task</DropdownMenuItem>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="deals" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Deals</CardTitle>
                <CardDescription>
                  Track your sales pipeline
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Deal</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* This would be a form in the real app */}
                    <p className="text-sm text-muted-foreground">Deal creation form would go here</p>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Close Date</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealsLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredDeals?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          No deals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDeals?.map(deal => (
                        <TableRow key={deal.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{deal.title}</div>
                              <div className="text-sm text-muted-foreground">{deal.company}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getDealStageBadge(deal.stage)}</TableCell>
                          <TableCell>${deal.value.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>{new Date(deal.expectedCloseDate).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    deal.probability >= 70 ? 'bg-green-500' : 
                                    deal.probability >= 40 ? 'bg-amber-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${deal.probability}%` }}
                                ></div>
                              </div>
                              <span className="text-sm">{deal.probability}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>Update Stage</DropdownMenuItem>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="activities" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Activities</CardTitle>
                <CardDescription>
                  Recent and upcoming activities
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule New Activity</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* This would be a form in the real app */}
                    <p className="text-sm text-muted-foreground">Activity creation form would go here</p>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {activitiesLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <div key={i} className="flex items-start space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 w-full">
                          <Skeleton className="h-5 w-1/3" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    ))
                  ) : activities?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No activities found
                    </div>
                  ) : (
                    activities?.map(activity => (
                      <div key={activity.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                        <div className={`p-2 rounded-full ${
                          activity.completed 
                            ? 'bg-green-100' 
                            : new Date(activity.date) < new Date() 
                              ? 'bg-red-100' 
                              : 'bg-blue-100'
                        }`}>
                          {getActivityTypeIcon(activity.type)}
                        </div>
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{activity.subject}</h4>
                            <Badge variant={activity.completed ? "outline" : "secondary"}>
                              {activity.completed ? "Completed" : "Pending"}
                            </Badge>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="mr-1 h-3.5 w-3.5" />
                            <span>{new Date(activity.date).toLocaleDateString()}</span>
                            <span className="mx-2">•</span>
                            <span>Related to: {activity.relatedTo.name}</span>
                          </div>
                          {activity.notes && (
                            <p className="text-sm mt-2">{activity.notes}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}