import { create } from 'zustand'
import type { ActiveTab, FilterState, SkillGenerateState } from '@/types/ui'
import type { EventType } from '@/types/events'

interface UIStoreState {
  activeTab: ActiveTab
  filter: FilterState
  skillGenerateState: SkillGenerateState
  expandedEventIds: Set<string>

  // Actions
  setActiveTab: (tab: ActiveTab) => void
  toggleFilterType: (type: EventType) => void
  setSearchQuery: (q: string) => void
  toggleEventExpanded: (id: string) => void
  setSkillGenerateState: (state: SkillGenerateState) => void
  resetFilter: () => void
}

const DEFAULT_FILTER: FilterState = {
  types: [],
  searchQuery: '',
}

export const useUIStore = create<UIStoreState>((set) => ({
  activeTab: 'events',
  filter: { ...DEFAULT_FILTER },
  skillGenerateState: 'idle',
  expandedEventIds: new Set(),

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleFilterType: (type) =>
    set((s) => {
      const types = s.filter.types.includes(type)
        ? s.filter.types.filter((t) => t !== type)
        : [...s.filter.types, type]
      return { filter: { ...s.filter, types } }
    }),

  setSearchQuery: (q) =>
    set((s) => ({ filter: { ...s.filter, searchQuery: q } })),

  toggleEventExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedEventIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedEventIds: next }
    }),

  setSkillGenerateState: (state) => set({ skillGenerateState: state }),

  resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),
}))
