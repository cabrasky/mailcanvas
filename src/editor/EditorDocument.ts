import { emailBlocksToHtml, parseEmailHtmlToBlocks, type EmailBlock } from "../services/emailBlocks";
import type { EmailComponent } from "../services/emailComponents";

export type DocumentSnapshot = Readonly<{ html: string; blocks: EmailBlock[] }>;
export type DocumentState = Readonly<{
  present: DocumentSnapshot;
  past: readonly DocumentSnapshot[];
  future: readonly DocumentSnapshot[];
  savedHtml: string;
}>;

/** An edit publishes its HTML and block tree together before notifying React or the host. */
export class EditorDocument {
  private state: DocumentState;
  private listeners = new Set<() => void>();
  private pending: string[] = [];
  private received: string;

  constructor(html: string, private emit: (html: string) => void) {
    this.received = html;
    this.state = { present: { html, blocks: parseEmailHtmlToBlocks(html) }, past: [], future: [], savedHtml: html };
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(next: DocumentState) {
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private notifyHost() {
    const html = this.state.present.html;
    this.pending = [...this.pending.slice(-99), html];
    this.emit(html);
  }

  /** An acknowledgement of our own edit must not discard selection or undo history. */
  receive(html: string): boolean {
    if (html === this.received) return false;
    this.received = html;
    const acknowledgement = this.pending.indexOf(html);
    if (acknowledgement >= 0) {
      this.pending = this.pending.slice(acknowledgement + 1);
      return false;
    }
    this.pending = [];
    this.update({ present: { html, blocks: parseEmailHtmlToBlocks(html) }, past: [], future: [], savedHtml: html });
    return true;
  }

  replace(html: string) {
    if (html === this.state.present.html) return;
    this.commit({ html, blocks: parseEmailHtmlToBlocks(html) });
  }

  edit(transform: (blocks: EmailBlock[]) => EmailBlock[], components: EmailComponent[] = [], record = true) {
    const blocks = transform(this.state.present.blocks);
    if (blocks === this.state.present.blocks || JSON.stringify(blocks) === JSON.stringify(this.state.present.blocks)) return;
    this.commit({ html: emailBlocksToHtml(blocks, { components }), blocks }, record);
  }

  private commit(present: DocumentSnapshot, record = true) {
    const past = record ? [...this.state.past.slice(-49), this.state.present] : this.state.past;
    this.update({ ...this.state, present, past, future: [] });
    this.notifyHost();
  }

  undo() {
    const present = this.state.past.at(-1);
    if (!present) return;
    this.update({ ...this.state, present, past: this.state.past.slice(0, -1), future: [this.state.present, ...this.state.future] });
    this.notifyHost();
  }

  redo() {
    const [present, ...future] = this.state.future;
    if (!present) return;
    this.update({ ...this.state, present, past: [...this.state.past.slice(-49), this.state.present], future });
    this.notifyHost();
  }

  markSaved(html = this.state.present.html) {
    this.update({ ...this.state, savedHtml: html });
  }
}
