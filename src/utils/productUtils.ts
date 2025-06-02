
// Product name mappings
export const PRODUCT_NAMES: Record<string, string> = {
  'prod_RINO6yE0y4O9gX': 'Coaching Program',
  'prod_RINKAvP3L2kZeV': 'Standard Course',
  // Add more product mappings as needed
};

export const getProductName = (productId: string | null): string => {
  if (!productId) return 'Unknown Product';
  return PRODUCT_NAMES[productId] || productId;
};
