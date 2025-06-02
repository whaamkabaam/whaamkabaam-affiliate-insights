
// Product name mappings
export const PRODUCT_NAMES: Record<string, string> = {
  'prod_RINO6yE0y4O9gX': 'Live Custom Curve Settings',
  'prod_RINKAvP3L2kZeV': 'Premium Personalized Custom Curve Settings',
  // Add more product mappings as needed
};

export const getProductName = (productId: string | null): string => {
  if (!productId) return 'Unknown Product';
  return PRODUCT_NAMES[productId] || productId;
};
