import { supabase } from '@/lib/supabase';

export interface ScanSummary {
  id: string;
  created_at: string;
  image_usable: boolean;
  ingredients: { name: string; category: string; quantity_estimate: string | null }[];
}

export async function listScans(limit = 20): Promise<ScanSummary[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('id, created_at, image_usable, scan_ingredients(name, category, quantity_estimate)')
    .eq('image_usable', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    image_usable: s.image_usable,
    ingredients: s.scan_ingredients ?? [],
  }));
}

export async function deleteScan(id: string): Promise<void> {
  const { error } = await supabase.from('scans').delete().eq('id', id);
  if (error) throw error;
}
