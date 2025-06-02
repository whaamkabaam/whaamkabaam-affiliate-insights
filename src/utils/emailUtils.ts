
// Utility function to censor email addresses
export const censorEmail = (email: string): string => {
  if (!email || !email.includes('@')) {
    return email;
  }
  
  const [username, domain] = email.split('@');
  
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  
  const visibleStart = username.slice(0, 2);
  const visibleEnd = username.slice(-1);
  const censored = `${visibleStart}***${visibleEnd}@${domain}`;
  
  return censored;
};
