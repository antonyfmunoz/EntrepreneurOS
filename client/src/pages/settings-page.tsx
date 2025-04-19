import { Layout } from "@/components/layout";
import { Integrations } from "@/components/integrations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  
  return (
    <Layout title="Settings">
      <div className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Interface Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Dark Mode</h3>
                    <p className="text-sm text-muted-foreground">Toggle dark mode for the interface</p>
                  </div>
                  <Switch id="dark-mode" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Compact View</h3>
                    <p className="text-sm text-muted-foreground">Display more content with less padding</p>
                  </div>
                  <Switch id="compact-view" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">External Services</h3>
                    <p className="text-sm text-muted-foreground">Connect your agents to external tools and services</p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/integrations">
                      Manage Integrations
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <input 
                    type="text" 
                    id="name" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    defaultValue={user?.fullName || user?.username || ""}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <input 
                    type="email" 
                    id="email" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    defaultValue={user?.email || ""}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="company">Company/Organization</Label>
                  <input 
                    type="text" 
                    id="company" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    defaultValue={user?.company || ""}
                  />
                </div>

                <Button className="mt-2">Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Task Notifications</h3>
                    <p className="text-sm text-muted-foreground">Receive notifications when tasks are assigned or completed</p>
                  </div>
                  <Switch id="task-notifications" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Agent Activity</h3>
                    <p className="text-sm text-muted-foreground">Notifications for new agent activities and updates</p>
                  </div>
                  <Switch id="agent-activity" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">System Updates</h3>
                    <p className="text-sm text-muted-foreground">Get notified about system updates and new features</p>
                  </div>
                  <Switch id="system-updates" defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}