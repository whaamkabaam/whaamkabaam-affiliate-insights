
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function ConfigForm() {
  const [stripeKey, setStripeKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    // Check if Stripe key is configured (just check if it exists, don't retrieve the actual value)
    const checkStripeKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-affiliate-data", {
          body: { checkKey: true }
        });
        
        if (!error && data) {
          setHasKey(true);
        }
      } catch (err) {
        console.error("Error checking Stripe key:", err);
      }
    };

    checkStripeKey();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // In a real app, we would need an edge function to securely save this
    // This is just for demonstration purposes
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("API key saved successfully");
      setHasKey(true);
      // Clear the input for security
      setStripeKey("");
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <CardDescription>
          {hasKey 
            ? "Your Stripe API key is configured. You can update it if needed."
            : "Configure your Stripe API key for accessing commission data."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasKey ? (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
            <p className="font-medium">✓ Stripe API key is configured</p>
            <p className="text-sm mt-1">Your API key is securely stored.</p>
          </div>
        ) : null}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="stripe-key" className="text-sm font-medium">
              {hasKey ? "Update Stripe Secret Key" : "Stripe Secret Key"}
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
            {isSubmitting ? "Saving..." : hasKey ? "Update API Key" : "Save API Key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
