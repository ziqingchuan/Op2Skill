import type { EventType } from './events'

export type ActiveTab = 'events' | 'skill' | 'preview'

export interface FilterState {
  types: EventType[]
  searchQuery: string
}

export type SkillGenerateState = 'idle' | 'generating' | 'done' | 'error'
