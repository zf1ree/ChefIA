// Estado em memória do fluxo foto → revisão → receitas (não persiste:
// só liga as telas entre si; os dados permanentes ficam no Supabase).
import { useSyncExternalStore } from 'react';

import type { DetectedIngredient, GenerateRecipesRequest, GenerateRecipesResponse, StorageLocation } from '@shared/schemas';

export interface ReviewItem {
  key: string;
  name: string;
  quantity: string | null;
  category: string;
  confidence: number | null;
  needsConfirmation: boolean;
  location: StorageLocation;
  expiresOn: string | null;
}

export interface FlowState {
  photoUri: string | null;
  scanId: string | null;
  scanNotes: string | null;
  /** Lista que o usuário está revisando antes de gerar receitas. */
  review: ReviewItem[];
  /** Origem da lista: análise de foto ou "Minha Geladeira". */
  source: 'scan' | 'fridge' | 'manual';
  lastRequest: GenerateRecipesRequest | null;
  lastResult: GenerateRecipesResponse | null;
}

const initial: FlowState = {
  photoUri: null,
  scanId: null,
  scanNotes: null,
  review: [],
  source: 'manual',
  lastRequest: null,
  lastResult: null,
};

let state: FlowState = initial;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const flowStore = {
  get: () => state,
  set(patch: Partial<FlowState>) {
    state = { ...state, ...patch };
    emit();
  },
  reset() {
    state = initial;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useFlow(): FlowState {
  return useSyncExternalStore(flowStore.subscribe, flowStore.get, flowStore.get);
}

let counter = 0;
export function newKey(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export function reviewFromDetected(items: DetectedIngredient[]): ReviewItem[] {
  return items.map((i) => ({
    key: newKey(),
    name: i.name,
    quantity: i.quantity_estimate,
    category: i.category,
    confidence: i.confidence,
    needsConfirmation: i.needs_confirmation,
    location: i.location_hint ?? (i.category === 'congelados' ? 'freezer' : ['graos', 'enlatados', 'temperos'].includes(i.category) ? 'pantry' : 'fridge'),
    expiresOn: null,
  }));
}

// Foto escolhida aguardando análise (fica só em memória, nunca é persistida).
let pendingImage: import('@/lib/image').PickedImage | null = null;
export function setPendingImage(img: import('@/lib/image').PickedImage | null) {
  pendingImage = img;
}
export function getPendingImage() {
  return pendingImage;
}
