
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AffiliateOverview } from "@/types/affiliate";

interface AffiliateSelectorProps {
  affiliates: AffiliateOverview[];
  selectedAffiliate: string | null;
  onAffiliateChange: (affiliateCode: string | null) => void;
}

export const AffiliateSelector = ({ 
  affiliates, 
  selectedAffiliate, 
  onAffiliateChange 
}: AffiliateSelectorProps) => {
  return (
    <div className="w-64">
      <label className="text-sm font-medium mb-2 block">View as Affiliate:</label>
      <Select 
        value={selectedAffiliate || "all"} 
        onValueChange={(value) => onAffiliateChange(value === "all" ? null : value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an affiliate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Affiliates (Admin View)</SelectItem>
          {affiliates.map((affiliate) => (
            <SelectItem key={affiliate.affiliateCode} value={affiliate.affiliateCode}>
              {affiliate.email} ({affiliate.affiliateCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
