import { LitElement, html, css } from 'lit';
import { EwtInstallDialog } from 'esp-web-tools/dist/install-dialog.js';
import 'esp-web-tools/dist/install-button.js';
import { progressView } from './flash-progress.js';
import { t, onLanguageChange } from './i18n.js';

class TiltFlashProgress extends LitElement {
  static properties = { state: { attribute: false }, clock: { state: true } };
  static styles = css`
    :host { display:block; width:min(400px, 100%); color:#26312a; font:14px/1.65 'Noto Sans Thai','Segoe UI',Tahoma,sans-serif; }
    h3,p { margin:0; } h3 { font-size:18px; font-weight:600; }
    .meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; color:#747d73; font-size:12px; margin:6px 0 14px; }
    progress { display:block; width:100%; height:12px; accent-color:#6b9b41; }
    .number { font-size:28px; font-weight:600; margin:8px 0; } .amount { font-size:12px; color:#747d73; }
    ol { padding:0; list-style:none; display:flex; flex-wrap:wrap; gap:5px 14px; font-size:12px; margin:16px 0; color:#747d73; }
    li[aria-current=step] { color:#44693a; font-weight:700; } li[data-done=true] { color:#44693a; }
    .hint { background:#f0f4e9; border-radius:8px; padding:12px; font-size:13px; }
    .hint[data-stalled=true] { background:#fff0d6; color:#76511b; }
    details { margin-top:16px; font-size:12px; } summary { cursor:pointer; }
    pre { max-height:150px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; padding:10px; background:#f4f5ef; border-radius:6px; font:11px/1.5 monospace; }
    @media(prefers-reduced-motion:reduce) { progress { animation:none; } }
  `;
  connectedCallback() {
    super.connectedCallback();
    this.clock = Date.now();
    this.startedAt = this.clock;
    this.timer = setInterval(() => { this.clock = Date.now(); }, 1000);
    this.unsubscribe = onLanguageChange(() => this.requestUpdate());
  }
  disconnectedCallback() { clearInterval(this.timer); this.unsubscribe?.(); super.disconnectedCallback(); }
  render() {
    const view = progressView(this.state || { details: { startedAt: this.startedAt, updatedAt: this.startedAt } }, Math.max(this.clock, this.state?.details?.updatedAt || 0));
    const phases = ['connect', 'stub', 'flash-id', 'download', 'check', 'erase', 'write', 'reset'];
    const index = phases.indexOf(view.phase);
    const steps = [['connect', 'flash.stepConnect'], ['download', 'flash.stepDownload'], ...(this.state?.details?.eraseFirst === false ? [] : [['erase', 'flash.stepErase']]), ['write', 'flash.stepWrite']];
    return html`
      <h3 role="status" aria-live="polite">${t(`flash.phase.${view.phase}`)}</h3>
      <div class="meta"><span>${this.state?.chipFamily || t('flash.detectingChip')}</span><span>${t('flash.elapsed', { seconds: view.elapsed })}</span></div>
      ${view.percentage !== undefined
        ? html`<progress aria-label=${t(`flash.phase.${view.phase}`)} max="100" .value=${view.percentage}></progress><p class="number">${view.percentage}%</p>`
        : html`<progress aria-label=${t(`flash.phase.${view.phase}`)}></progress>`}
      ${view.bytes !== undefined ? html`<p class="amount">${view.total !== undefined ? t('flash.bytes', { received: view.bytes, total: view.total }) : t('flash.received', { received: view.bytes })}</p>` : ''}
      <ol>${steps.map(([phase, key]) => html`<li aria-current=${(phase === view.phase || (phase === 'connect' && index <= 2) || (phase === 'download' && view.phase === 'check') || (phase === 'write' && view.phase === 'reset')) ? 'step' : 'false'} data-done=${index > phases.indexOf(phase)}>${index > phases.indexOf(phase) ? '✓' : '○'} ${t(key)}</li>`)}</ol>
      <p class="hint" data-stalled=${view.stalled}>${view.stalled ? html`${t('flash.idle', { seconds: view.idle })}<br>` : ''}${t(view.hint)}</p>
      <details><summary>${t('flash.logs')}</summary><pre>${this.state?.details?.logs?.join('\n') || t('flash.noLog')}</pre></details>
    `;
  }
}
customElements.define('tilt-flash-progress', TiltFlashProgress);

// ESP Web Tools 10.4.0 has no public renderer hook. Keep this small adapter
// tied to the pinned release; confirmation, erase choices and serial ownership
// remain in its dialog. Only the installation status view is replaced.
const originalRenderInstall = EwtInstallDialog.prototype._renderInstall;
const originalConfirmInstall = EwtInstallDialog.prototype._confirmInstall;
EwtInstallDialog.prototype._confirmInstall = async function () {
  try { await originalConfirmInstall.call(this); }
  catch (error) {
    this._installState = { state: 'error', details: { failedPhase: 'connect', logs: [], details: String(error) } };
  }
};
EwtInstallDialog.prototype._renderInstall = function () {
  const state = this._installState;
  if (this._installConfirmed && (!state || !['finished', 'error'].includes(state.state) || (state.state === 'finished' && this._client === undefined))) {
    return [t('flash.installing'), html`<tilt-flash-progress slot="content" .state=${state}></tilt-flash-progress>`, false];
  }
  if (state?.state === 'error') {
    const key = state.details.translationKey;
    const hint = state.details.failedPhase === 'connect' ? 'flash.bootHelp' : state.details.failedPhase === 'download' ? 'flash.downloadHelp' : 'flash.retryHelp';
    return [t('flash.failed'), html`
      <div slot="content"><p>${key ? t(key, { chip: state.chipFamily }) : t('flash.errorPhase', { phase: t(`flash.phase.${state.details.failedPhase}`) })}</p><p>${t(hint)}</p><details><summary>${t('flash.logs')}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto">${[...state.details.logs, state.details.details].join('\n')}</pre></details></div>
      <div slot="actions"><ew-text-button @click=${() => this._closeDialog()}>${t('flash.close')}</ew-text-button></div>
    `, false];
  }
  return originalRenderInstall.call(this);
};
