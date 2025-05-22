
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ConfigForm() {
  const [stripeKey, setStripeKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulating API key saving
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("API key saved successfully");
      // In a real app, we would store this securely
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <CardDescription>
          Configure your Stripe API key for accessing commission data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="stripe-key" className="text-sm font-medium">
              Stripe Secret Key
            </label>
            <Input
              id="stripe-key"
              type="password"
              value={stripeKey}
              onChange={(e) => setStripeKey(e.target.value)}
              placeholder="sk_test_..."
            />
            <p className="text-xs text-muted-foreground">
              This key is stored securely and is used to fetch your commission data from Stripe.
            </p>
          </div>
          <Button 
            type="submit" 
            disabled={isSubmitting || !stripeKey} 
            className="bg-brand-red hover:bg-brand-red/90"
          >
            {isSubmitting ? "Saving..." : "Save API Key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
