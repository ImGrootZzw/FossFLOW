import { z } from 'zod';
import { id, constrainedStrings } from './common';

export const modelItemSchema = z.object({
  id,
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  icon: id.optional(),
  // Per-node label visibility toggles
  hideName: z.boolean().optional(),
  hideDescription: z.boolean().optional()
});

export const modelItemsSchema = z.array(modelItemSchema);
