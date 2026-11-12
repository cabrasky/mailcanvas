import type { EmailBlock } from "../../services/emailBlocks";

export type DocumentState = {
  blocks: EmailBlock[];
  history: EmailBlock[][];
  future: EmailBlock[][];
};

export type DocumentAction =
  | { type: "publish"; blocks: EmailBlock[]; record?: boolean }
  | { type: "reset"; blocks: EmailBlock[] }
  | { type: "undo" }
  | { type: "redo" };

export const initialDocumentState = (blocks: EmailBlock[]): DocumentState => ({ blocks, history: [], future: [] });

export function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case "publish": {
      const record = action.record ?? true;
      if (!record) return { ...state, blocks: action.blocks };
      if (JSON.stringify(action.blocks) === JSON.stringify(state.blocks)) return state;
      return { blocks: action.blocks, history: [...state.history.slice(-49), state.blocks], future: [] };
    }
    case "reset":
      return { blocks: action.blocks, history: [], future: [] };
    case "undo": {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { blocks: previous, history: state.history.slice(0, -1), future: [state.blocks, ...state.future] };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return { blocks: next, history: [...state.history, state.blocks], future: state.future.slice(1) };
    }
  }
}
