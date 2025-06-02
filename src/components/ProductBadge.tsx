
import { getProductName, getProductDisplayVariant } from "@/utils/productUtils";
import { ProductTitle } from "./ProductTitle";

interface ProductBadgeProps {
  productId: string | null;
  size?: "sm" | "md" | "lg";
  variant?: "auto" | "premium" | "live" | "gradient" | "minimal";
  className?: string;
}

export function ProductBadge({ 
  productId, 
  size = "md", 
  variant = "auto", 
  className 
}: ProductBadgeProps) {
  const productName = getProductName(productId);
  const autoVariant = variant === "auto" ? getProductDisplayVariant(productName) : variant;

  return (
    <ProductTitle
      title={productName}
      variant={autoVariant}
      size={size}
      className={className}
    />
  );
}
