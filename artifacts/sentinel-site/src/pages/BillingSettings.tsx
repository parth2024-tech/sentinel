import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { CreditCard, Building2, Users } from "lucide-react";
import { toast } from "sonner";
// In a fully integrated app, these would come from `@workspace/api-client-react`
// For Phase 1 we mock the API call since the hook might require a custom query.

export default function BillingSettings() {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName })
      });
      if (res.ok) {
        toast.success("Organization created successfully");
        setOrgName("");
      } else {
        toast.error("Failed to create organization");
      }
    } catch (err) {
      toast.error("Error connecting to API");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // In a real app we'd have the orgId in context, here we mock 'mock-org-1'
      const res = await fetch("/api/organizations/mock-org-1/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: "price_mock_123",
          successUrl: window.location.href,
          cancelUrl: window.location.href
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Redirect to stripe checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.success("Checkout session created (Mock)");
        }
      } else {
        toast.error("Failed to start checkout");
      }
    } catch (err) {
      toast.error("Error connecting to API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Organization & Billing</h1>
        <p className="text-muted-foreground">
          Manage your enterprise fleet, users, and subscription settings.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Create Organization
            </CardTitle>
            <CardDescription>
              Set up a new workspace for your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input 
                  value={orgName} 
                  onChange={(e) => setOrgName(e.target.value)} 
                  placeholder="Acme Corp" 
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                Create Workspace
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-border/40 bg-card/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Subscription Plan
            </CardTitle>
            <CardDescription>
              Upgrade to Sentinel Enterprise for unlimited MDM device tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 bg-muted/20">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="font-semibold text-lg">Free Tier</h4>
                  <p className="text-sm text-muted-foreground">Up to 3 devices manually tracked.</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">$0</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Users className="w-4 h-4" /> 1 Team Member</li>
                <li className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> No Credit Card Required</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubscribe} disabled={loading} className="w-full" variant="default">
              Upgrade to Enterprise
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
