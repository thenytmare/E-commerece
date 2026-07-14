import { z } from 'zod';

export const addressSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  county: z.string().trim().min(2, 'County is required'),
  city: z.string().trim().min(2, 'City is required'),
  street: z.string().trim().min(3, 'Street address is required'),
  postalCode: z.string().trim().optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;
