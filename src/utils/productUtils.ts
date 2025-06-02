
// Product name mappings with improved display names
export const PRODUCT_NAMES: Record<string, string> = {
  'prod_RINO6yE0y4O9gX': 'Live Custom Curve Settings',
  'prod_RINKAvP3L2kZeV': 'Premium Personalized Custom Curve Settings',
  // Add more product mappings as needed
};

export const getProductName = (productId: string | null): string => {
  if (!productId) return 'Unknown Product';
  return PRODUCT_NAMES[productId] || productId;
};

export const getProductDisplayVariant = (productName: string): "premium" | "live" | "gradient" | "default" => {
  const name = productName.toLowerCase();
  if (name.includes("premium")) return "premium";
  if (name.includes("live")) return "live";
  if (name.includes("personalized")) return "gradient";
  return "default";
};
