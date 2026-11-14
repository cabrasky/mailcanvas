import {it,expect} from 'vitest';
import {previewDocument,PREVIEW_SANDBOX} from './previewDocument';
it('opens preview links separately and preserves fragment links without enabling scripts',()=>{
 const doc=new DOMParser().parseFromString(previewDocument('<a href="https://example.test" target="_top">Go</a><a href="#section">Section</a>'),'text/html');
 expect(doc.querySelector('a')?.target).toBe('_blank');
 expect(doc.querySelector('a')?.rel).toBe('noopener noreferrer');
 expect(doc.querySelectorAll('a')[1].target).toBe('_self');
 expect(PREVIEW_SANDBOX).toContain('allow-popups');
 expect(PREVIEW_SANDBOX).not.toContain('allow-scripts');
});
