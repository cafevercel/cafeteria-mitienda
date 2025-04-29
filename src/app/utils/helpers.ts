export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };
  
  export const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };
  
  export const calculateTotal = (items: { precio: number; cantidad: number }[]): number => {
    return items.reduce((total, item) => total + item.precio * item.cantidad, 0);
  };
  
  export const generateUniqueId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };