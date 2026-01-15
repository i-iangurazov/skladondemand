export const phoneRegex = /^\+996\d{9}$/;

export const isValidPhone = (value: string) => phoneRegex.test(value);
