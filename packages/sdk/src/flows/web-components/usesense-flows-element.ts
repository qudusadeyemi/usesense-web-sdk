/**
 * <usesense-flows> — zero-dependency Web Components surface for the Flows
 * runner. Drives the same server contract as the React FlowRunner via the
 * shared FlowsClient (client.ts) and the framework-free FlowController, and
 * ships no framework runtime.
 *
 * Usage:
 *
 *   import { defineUseSenseFlowsElement } from '@usesense/web-sdk';
 *   defineUseSenseFlowsElement();
 *
 *   const el = document.createElement('usesense-flows');
 *   el.flowRunId = flowRunId;
 *   el.sdkToken = sdkToken;
 *   el.addEventListener('complete', (e) => console.log(e.detail.outcome));
 *   el.addEventListener('error', (e) => console.error(e.detail.code));
 *   document.body.appendChild(el);
 *
 * Built-in surfaces: loading, terminal, form, id_number, document (file /
 * PDF upload), info, and consent. Face capture is emitted as a cancelable
 * `capture` event so a host can wire the React VerificationCaptureEngine (or
 * their own) and drive the run via resolveCapture()/failCapture(); when the
 * event is not intercepted the run fails with unsupported_action. Full
 * white-label appearance/copy and camera quality-gated capture are handled by
 * the React runner (flows.run) and intentionally not duplicated here.
 */

import { createFlowsClient } from '../client';
import { FlowController, type ControllerState } from './flow-controller';
import { FlowError, type FormField, type IdTypeOption, type InfoAction, type PendingAction } from '../types';
import { isPdf, pdfFirstPageToJpegBase64 } from '../pdf';

const DEFAULT_PRIMARY = '#4F7CFF';

const SHADOW_STYLES = `
  :host { display: block; font-family: 'DM Sans', system-ui, sans-serif; color:#1C1A17; }
  .wrap { display:flex; align-items:center; justify-content:center; width:100%;
          min-height:100%; padding:24px; box-sizing:border-box; background:#FDFCFA; }
  .card { display:flex; flex-direction:column; gap:16px; width:100%; max-width:420px; }
  h1 { font-size:1.5rem; font-weight:700; color:#1C1A17; margin:0; letter-spacing:-0.01em; }
  p { font-size:0.95rem; line-height:1.5; color:#6B6660; margin:0; }
  label { font-size:.9rem; font-weight:600; color:#1C1A17; }
  input, select { padding:12px 14px; font-size:1rem; border:1px solid #D8D4CE;
                  border-radius:12px; background:#fff; color:#1C1A17; font-family:inherit;
                  box-sizing:border-box; width:100%; }
  .row { display:flex; flex-direction:column; gap:6px; }
  .checkrow { display:flex; align-items:flex-start; gap:8px; font-size:.9rem; color:#1C1A17;
              font-weight:400; }
  .hint { font-size:.8rem; color:#8A857D; }
  .err { font-size:.8rem; color:#D14343; }
  button.primary { padding:14px 16px; font-size:1rem; font-weight:600; color:#fff;
                   border:none; border-radius:12px; cursor:pointer; }
  button.primary:disabled { opacity:0.5; cursor:default; }
  button.secondary { padding:12px 16px; font-size:.95rem; color:#4A463F;
                     background:transparent; border:none; cursor:pointer; }
  button.chip { display:flex; align-items:center; gap:12px; width:100%; text-align:left;
                border-radius:12px; padding:14px 16px; cursor:pointer; background:#fff;
                border:1px solid #D8D4CE; color:#1C1A17; font-family:inherit; font-size:1rem; }
  ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; }
  li { display:flex; gap:10px; align-items:flex-start; font-size:.95rem; color:#1C1A17; }
  .glyph { flex:0 0 24px; height:24px; display:inline-flex; align-items:center;
           justify-content:center; border-radius:50%; background:#EDEAE4; font-size:.8rem; }
  .spinner { width:36px; height:36px; border-radius:50%; animation:spin .8s linear infinite; }
  .pending { display:flex; flex-direction:column; align-items:center; gap:14px;
             color:#4A463F; font-size:.95rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const GLYPHS: Record<string, string> = {
  check: '\u2713',
  shield: '\u26E8',
  camera: '\uD83D\uDCF7',
  warning: '!',
  info: 'i',
};

/**
 * Define the <usesense-flows> custom element. No-op during SSR (no HTMLElement)
 * or if the tag is already registered.
 */
export function defineUseSenseFlowsElement(tag = 'usesense-flows'): void {
  if (
    typeof HTMLElement === 'undefined' ||
    typeof customElements === 'undefined' ||
    customElements.get(tag)
  ) {
    return;
  }

  class UseSenseFlowsElement extends HTMLElement {
    flowRunId = '';
    sdkToken = '';
    apiBaseUrl?: string;
    primaryColor = DEFAULT_PRIMARY;

    private controller?: FlowController;
    private unsubscribe?: () => void;
    private root: ShadowRoot;
    private settled = false;
    private activeColor = DEFAULT_PRIMARY;
    private urlOpened = false;
    /** Persisted form values across re-renders (server invalid_input). */
    private formValues: Record<string, unknown> = {};
    private formSig = '';

    static get observedAttributes(): string[] {
      return ['flow-run-id', 'sdk-token', 'api-base-url', 'primary-color'];
    }

    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
    }

    attributeChangedCallback(name: string, _old: string, value: string): void {
      if (name === 'flow-run-id') this.flowRunId = value;
      else if (name === 'sdk-token') this.sdkToken = value;
      else if (name === 'api-base-url') this.apiBaseUrl = value;
      else if (name === 'primary-color') this.primaryColor = value || DEFAULT_PRIMARY;
    }

    connectedCallback(): void {
      const style = document.createElement('style');
      style.textContent = SHADOW_STYLES;
      this.root.appendChild(style);

      this.controller = new FlowController(
        createFlowsClient({
          flowRunId: this.flowRunId,
          sdkToken: this.sdkToken,
          apiBaseUrl: this.apiBaseUrl,
        })
      );
      this.unsubscribe = this.controller.subscribe((s) => this.render(s));
      void this.controller.start();
    }

    disconnectedCallback(): void {
      this.unsubscribe?.();
    }

    // ── Public API for hosts intercepting the `capture` event ────────────────

    /** Advance the run after a host-handled capture (e.g. face). */
    resolveCapture(inputs: Record<string, unknown> = {}): void {
      void this.controller?.advance(inputs);
    }

    /** Fail the run after a host-handled capture failed. */
    failCapture(error?: { code?: string; message?: string }): void {
      this.controller?.fail(
        error instanceof FlowError
          ? error
          : new FlowError(
              (error?.code as FlowError['code']) ?? 'unknown',
              error?.message ?? 'Capture failed'
            )
      );
    }

    private emit(
      type: 'complete' | 'error' | 'capture',
      detail: unknown,
      cancelable = false
    ): boolean {
      return this.dispatchEvent(
        new CustomEvent(type, { detail, bubbles: true, cancelable })
      );
    }

    private render(state: ControllerState): void {
      this.activeColor = this.primaryColor;

      if (state.phase === 'done') {
        if (!this.settled) {
          this.settled = true;
          this.emit('complete', state.result);
        }
        this.clear();
        return;
      }
      if (state.phase === 'error') {
        if (!this.settled) {
          this.settled = true;
          this.emit('error', state.error);
        }
        this.clear();
        return;
      }

      this.clear();
      const wrap = el('div', { class: 'wrap' });
      const card = el('div', { class: 'card' });
      wrap.appendChild(card);
      this.root.appendChild(wrap);

      if (state.phase === 'loading') {
        card.appendChild(this.pending('Loading...'));
        return;
      }

      this.activeColor = state.view.branding?.primary_color ?? this.primaryColor;
      this.renderAction(card, state.action, state.fieldErrors);
    }

    /** Remove everything except the persistent <style>. */
    private clear(): void {
      while (this.root.childNodes.length > 1) {
        this.root.removeChild(this.root.lastChild as Node);
      }
    }

    private renderAction(
      card: HTMLElement,
      action: PendingAction,
      fieldErrors: Record<string, string>
    ): void {
      if (action.kind === 'info') {
        card.appendChild(this.infoSurface(action));
        return;
      }
      if (action.kind === 'redirect_to_consent') {
        card.appendChild(this.consentSurface(action.consentUrl));
        return;
      }
      if (action.kind === 'capture') {
        switch (action.capture) {
          case 'form':
            card.appendChild(this.formSurface(action.fields, fieldErrors));
            return;
          case 'id_number':
            card.appendChild(this.idNumberSurface(action.idTypes ?? []));
            return;
          case 'document':
            card.appendChild(this.documentSurface(action.documentCategory));
            return;
          case 'face':
            card.appendChild(this.faceSurface(action.toolId));
            return;
        }
      }
      // Unknown kind: fail-fast per the action contract.
      this.controller?.fail(
        new FlowError('unsupported_action', `Unsupported action: ${JSON.stringify(action)}`)
      );
    }

    // ── Surfaces ─────────────────────────────────────────────────────────────

    private formSurface(
      fields: (string | FormField)[],
      serverErrors: Record<string, string>
    ): HTMLElement {
      const normalised = fields.map(normaliseField);
      const form = el('form');

      const sig = normalised.map((f) => `${f.key}:${f.type}`).join('|');
      if (sig !== this.formSig) {
        this.formSig = sig;
        this.formValues = {};
        for (const f of normalised) {
          this.formValues[f.key] =
            f.initial !== undefined
              ? f.initial
              : f.type === 'checkbox'
                ? false
                : '';
        }
      }
      const values = this.formValues;
      const clientErrors: Record<string, string> = {};

      form.appendChild(el('h1', {}, 'A few details'));
      form.appendChild(el('p', {}, 'Please enter the information below to continue.'));

      const rerender = () => {
        const card = form.parentElement as HTMLElement;
        card.replaceChildren(this.formSurface(fields, { ...serverErrors, ...clientErrors }));
      };

      for (const field of normalised) {
        form.appendChild(
          this.fieldRow(field, values, serverErrors[field.key])
        );
      }

      const submit = el('button', { class: 'primary', type: 'submit' }, 'Continue');
      submit.style.background = this.activeColor;
      form.appendChild(submit);

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        let hasError = false;
        for (const f of normalised) {
          const err = validateFieldValue(f, (values[f.key] ?? '') as string | boolean);
          if (err) {
            clientErrors[f.key] = err;
            hasError = true;
          }
        }
        if (hasError) {
          rerender();
          return;
        }
        void this.controller?.advance(coerceValues(normalised, values));
      });
      return form;
    }

    private fieldRow(
      field: FormField,
      values: Record<string, unknown>,
      error?: string
    ): HTMLElement {
      const row = el('div', { class: 'row' });
      const labelText =
        (field.label ?? humanise(field.key)) + (field.required !== false ? ' *' : '');
      const errId = error ? `${field.key}-error` : undefined;
      const current = values[field.key];

      if (field.type === 'checkbox') {
        const wrapL = el('label', { class: 'checkrow' });
        const cb = el('input', { type: 'checkbox', id: field.key }) as HTMLInputElement;
        cb.checked = current === true;
        if (errId) cb.setAttribute('aria-describedby', errId);
        if (error) cb.setAttribute('aria-invalid', 'true');
        cb.addEventListener('change', () => (values[field.key] = cb.checked));
        wrapL.appendChild(cb);
        wrapL.appendChild(el('span', {}, labelText));
        row.appendChild(wrapL);
      } else if (field.type === 'select' || field.type === 'country') {
        row.appendChild(el('label', { for: field.key }, labelText));
        const sel = el('select', { id: field.key }) as HTMLSelectElement;
        if (errId) sel.setAttribute('aria-describedby', errId);
        if (error) sel.setAttribute('aria-invalid', 'true');
        const opts =
          field.type === 'country' && field.allowed_countries
            ? field.allowed_countries.map((c) => ({ value: c, label: c }))
            : (field.options ?? []);
        sel.appendChild(el('option', { value: '' }, field.placeholder ?? 'Select...'));
        for (const o of opts) sel.appendChild(el('option', { value: o.value }, o.label));
        sel.value = typeof current === 'string' ? current : '';
        sel.addEventListener('change', () => (values[field.key] = sel.value));
        row.appendChild(sel);
      } else {
        row.appendChild(el('label', { for: field.key }, labelText));
        const input = el('input', {
          id: field.key,
          type: htmlType(field.type),
          placeholder: field.placeholder ?? (field.type === 'date' ? 'YYYY-MM-DD' : ''),
        }) as HTMLInputElement;
        input.value = typeof current === 'string' ? current : '';
        if (errId) input.setAttribute('aria-describedby', errId);
        if (error) input.setAttribute('aria-invalid', 'true');
        input.addEventListener('input', () => (values[field.key] = input.value));
        row.appendChild(input);
      }

      if (error) row.appendChild(el('span', { class: 'err', id: errId!, role: 'alert' }, error));
      else if (field.hint) row.appendChild(el('span', { class: 'hint' }, field.hint));
      return row;
    }

    private idNumberSurface(idTypes: IdTypeOption[]): HTMLElement {
      const container = el('div', { class: 'card' });
      container.appendChild(el('h1', {}, 'Select an option'));
      container.appendChild(el('p', {}, 'Choose the type of ID to validate.'));

      let chosen: IdTypeOption | undefined = idTypes.length === 1 ? idTypes[0] : undefined;
      let value = '';

      const list = el('div', { class: 'card' });
      const inputRow = el('div', { class: 'row' });
      const submit = el('button', { class: 'primary' }, 'Continue') as HTMLButtonElement;
      submit.style.background = this.activeColor;

      const refreshSubmit = () => {
        const tooShort = chosen?.maxLength
          ? value.trim().length < chosen.maxLength
          : value.trim().length === 0;
        submit.disabled = !chosen || tooShort;
      };

      const renderInput = () => {
        inputRow.replaceChildren();
        if (!chosen) return;
        inputRow.appendChild(el('label', { for: 'id-number-input' }, `Enter your ${chosen.label}`));
        const input = el('input', {
          id: 'id-number-input',
          placeholder: chosen.hint ?? '',
        }) as HTMLInputElement;
        if (chosen.numeric) input.setAttribute('inputmode', 'numeric');
        if (chosen.maxLength) input.setAttribute('maxlength', String(chosen.maxLength));
        input.value = value;
        input.addEventListener('input', () => {
          value = chosen?.numeric ? input.value.replace(/\D/g, '') : input.value;
          if (input.value !== value) input.value = value;
          refreshSubmit();
        });
        inputRow.appendChild(input);
      };

      for (const it of idTypes) {
        const chip = el('button', { class: 'chip', type: 'button' });
        const body = el('span', {}, '');
        body.appendChild(el('strong', {}, it.label));
        if (it.hint) body.appendChild(el('span', { class: 'hint' }, ` ${it.hint}`));
        chip.appendChild(body);
        chip.addEventListener('click', () => {
          chosen = it;
          value = '';
          for (const c of list.children) {
            (c as HTMLElement).style.border = '1px solid #D8D4CE';
          }
          chip.style.border = `2px solid ${this.activeColor}`;
          renderInput();
          refreshSubmit();
        });
        if (chosen === it) chip.style.border = `2px solid ${this.activeColor}`;
        list.appendChild(chip);
      }

      submit.addEventListener('click', () => {
        if (!chosen) return;
        void this.controller?.advance({ id_type: chosen.value, [chosen.field]: value.trim() });
      });

      renderInput();
      refreshSubmit();
      container.appendChild(list);
      container.appendChild(inputRow);
      container.appendChild(submit);
      return container;
    }

    private documentSurface(documentCategory: string): HTMLElement {
      // Emit a cancelable capture event first so a host can intercept and drive
      // a custom camera; otherwise render the built-in file/PDF upload.
      const proceed = this.emit(
        'capture',
        { kind: 'document', documentCategory },
        true
      );
      if (!proceed) {
        return this.pending('Preparing document capture...');
      }

      const container = el('div', { class: 'card' });
      container.appendChild(el('h1', {}, 'Upload your document'));
      container.appendChild(
        el('p', {}, 'Take a clear photo of your document, or choose an existing image or PDF.')
      );

      const fileInput = el('input', {
        type: 'file',
        accept: 'image/*,application/pdf',
        capture: 'environment',
      }) as HTMLInputElement;
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file || !this.controller) return;
        container.replaceChildren(this.pending('Submitting your document...'));
        void this.uploadFile(file, documentCategory);
      });

      const primary = el('button', { class: 'primary' }, 'Take or upload photo');
      primary.style.background = this.activeColor;
      primary.addEventListener('click', () => fileInput.click());

      const cancel = el('button', { class: 'secondary' }, 'Cancel');
      cancel.addEventListener('click', () => void this.controller?.cancel());

      container.appendChild(fileInput);
      container.appendChild(primary);
      container.appendChild(cancel);
      return container;
    }

    private async uploadFile(file: File, documentCategory: string): Promise<void> {
      try {
        let data: string;
        let mimeType: string;
        if (isPdf(file)) {
          data = await pdfFirstPageToJpegBase64(await file.arrayBuffer());
          mimeType = 'image/jpeg';
        } else {
          data = await blobToBase64(file);
          mimeType = file.type || 'image/jpeg';
        }
        await this.controller?.uploadDocument({ data, mimeType, documentType: documentCategory });
      } catch (err) {
        this.controller?.fail(
          err instanceof FlowError
            ? err
            : new FlowError('unknown', err instanceof Error ? err.message : 'Document upload failed')
        );
      }
    }

    private faceSurface(toolId?: string): HTMLElement {
      // Face capture uses the React VerificationCaptureEngine, which a vanilla
      // element cannot mount. Offer the primer and emit a cancelable capture
      // event so a host can wire the engine and call resolveCapture(); if it is
      // not intercepted, fail with a clear unsupported_action.
      const container = el('div', { class: 'card' });
      container.appendChild(el('h1', {}, 'Take a selfie'));
      container.appendChild(
        el('p', {}, "A quick face scan confirms you're a real, live person.")
      );
      const primary = el('button', { class: 'primary' }, 'Start face scan');
      primary.style.background = this.activeColor;
      primary.addEventListener('click', () => {
        const proceed = this.emit('capture', { kind: 'face', toolId }, true);
        if (!proceed) {
          container.replaceChildren(this.pending('Preparing face capture...'));
          return;
        }
        this.controller?.fail(
          new FlowError(
            'unsupported_action',
            'Face capture requires the React runner (flows.run) or a host-provided capture handler.'
          )
        );
      });
      container.appendChild(primary);
      return container;
    }

    private infoSurface(info: InfoAction): HTMLElement {
      const container = el('div', { class: 'card' });
      if (info.image_url) {
        const img = el('img', { src: info.image_url, alt: '' }) as HTMLImageElement;
        img.style.width = '100%';
        img.style.maxHeight = '192px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '12px';
        container.appendChild(img);
      }
      container.appendChild(el('h1', {}, info.title));
      if (info.body) container.appendChild(el('p', {}, info.body));

      if (info.bullets && info.bullets.length) {
        const ul = el('ul');
        for (const b of info.bullets) {
          const li = el('li');
          li.appendChild(el('span', { class: 'glyph' }, GLYPHS[b.icon ?? 'info']));
          li.appendChild(el('span', {}, b.text));
          ul.appendChild(li);
        }
        container.appendChild(ul);
      }

      const openUrl = info.primary_cta.open_url;
      const primary = el(
        'button',
        { class: 'primary' },
        this.urlOpened && openUrl ? "I'm back, continue" : info.primary_cta.label
      );
      primary.style.background = this.activeColor;
      primary.addEventListener('click', () => {
        if (openUrl && !this.urlOpened) {
          openExternal(openUrl);
          this.urlOpened = true;
          primary.textContent = "I'm back, continue";
          return;
        }
        void this.controller?.advance({});
      });
      container.appendChild(primary);

      if (info.secondary_cta) {
        const secondary = el('button', { class: 'secondary' }, info.secondary_cta.label);
        secondary.addEventListener('click', () => {
          if (info.secondary_cta?.action === 'cancel') void this.controller?.cancel();
          else void this.controller?.advance({});
        });
        container.appendChild(secondary);
      }
      return container;
    }

    private consentSurface(consentUrl: string): HTMLElement {
      const container = el('div', { class: 'card' });
      container.appendChild(el('h1', {}, 'Consent required'));
      container.appendChild(
        el('p', {}, 'Open the secure consent page, grant consent, then come back and continue.')
      );
      const open = el('button', { class: 'primary' }, 'Open consent page');
      open.style.background = this.activeColor;
      open.addEventListener('click', () => openExternal(consentUrl));
      const confirm = el('button', { class: 'secondary' }, "I've granted consent");
      confirm.addEventListener('click', () => void this.controller?.advance({}));
      container.appendChild(open);
      container.appendChild(confirm);
      return container;
    }

    private pending(label: string): HTMLElement {
      const box = el('div', { class: 'pending' });
      const sp = el('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' });
      sp.style.border = `3px solid ${this.activeColor}33`;
      sp.style.borderTopColor = this.activeColor;
      box.appendChild(sp);
      box.appendChild(el('span', {}, label));
      return box;
    }
  }

  customElements.define(tag, UseSenseFlowsElement);
}

// ── tiny DOM helpers (no framework) ──────────────────────────────────────────

function el(
  tag: string,
  attrs: Record<string, string> = {},
  text?: string
): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Normalise a heterogeneous fields entry to a FormField (mirrors main). */
function normaliseField(entry: string | FormField): FormField {
  if (typeof entry !== 'string') return entry;
  return { key: entry, type: 'text', label: humanise(entry), required: true };
}

/** Client-side echo of the server's form validation (inline feedback only). */
function validateFieldValue(field: FormField, raw: string | boolean): string | null {
  const required = field.required !== false;
  const isBlank =
    typeof raw === 'boolean' ? false : raw === undefined || raw === null || String(raw).trim() === '';
  if (isBlank) return required ? `${field.label ?? field.key} is required` : null;
  const v = field.validators ?? {};
  const fail = (msg: string) => v.error_message ?? msg;
  if (typeof raw === 'string') {
    if (v.pattern) {
      try {
        if (!new RegExp(v.pattern).test(raw))
          return fail(`${field.label ?? field.key} is not in the expected format`);
      } catch {
        /* trust server */
      }
    }
    if (v.min_length !== undefined && raw.length < v.min_length)
      return fail(`Must be at least ${v.min_length} characters`);
    if (v.max_length !== undefined && raw.length > v.max_length)
      return fail(`Must be at most ${v.max_length} characters`);
  }
  if (field.type === 'number') {
    const n = Number(raw);
    if (Number.isNaN(n)) return fail(`${field.label ?? field.key} must be a number`);
    if (typeof v.min === 'number' && n < v.min) return fail(`Must be at least ${v.min}`);
    if (typeof v.max === 'number' && n > v.max) return fail(`Must be at most ${v.max}`);
  }
  if (field.type === 'date' && typeof raw === 'string') {
    if (typeof v.min === 'string' && raw < v.min) return fail(`Must be on or after ${v.min}`);
    if (typeof v.max === 'string' && raw > v.max) return fail(`Must be on or before ${v.max}`);
  }
  return null;
}

/** Coerce raw form values to the right primitive by field type. */
function coerceValues(
  fields: FormField[],
  values: Record<string, unknown>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (f.type === 'checkbox') out[f.key] = raw === true || raw === 'true';
    else if (f.type === 'number' && raw !== '' && raw !== undefined) out[f.key] = Number(raw);
    else out[f.key] = (raw as string) ?? '';
  }
  return out;
}

function htmlType(type: FormField['type']): string {
  switch (type) {
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

/** Humanise a snake/camel key into a Title Case label (mirrors main). */
function humanise(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Convert a Blob to a raw (unprefixed) base64 string. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read document image'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

function openExternal(url: string): void {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
