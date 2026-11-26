import app from 'flarum/admin/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Stream from 'flarum/common/utils/Stream';

export interface ExcludeFieldAttrs extends ComponentAttrs {
  stream: Stream<string>;
}

/**
 * The excluded elements: one CSS selector per line, with the lines the
 * browser can't read listed under the box as they are typed. The forum
 * skips those lines the same way, so a typo never breaks a transition.
 */
export default class ExcludeField extends Component<ExcludeFieldAttrs> {
  view() {
    const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans('ernestdefoe-segue.admin.exclude.' + key, params);
    const bad = invalidLines(this.attrs.stream() || '');

    return (
      <div className="Form-group SegueExclude">
        <label for="segue-exclude">{t('label')}</label>
        <div className="helpText" id="segue-exclude-help">
          {t('help')}
        </div>
        <textarea
          id="segue-exclude"
          className="FormControl"
          rows={4}
          spellcheck={false}
          placeholder={t('placeholder')}
          aria-describedby="segue-exclude-help"
          bidi={this.attrs.stream}
        />
        {bad.length ? (
          <p className="SegueExclude-invalid" role="status">
            {t('invalid', { selectors: bad.join(', ') })}
          </p>
        ) : null}
      </div>
    );
  }
}

/** The lines document.querySelector rejects. */
export function invalidLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;

      try {
        document.querySelector(line);
        return false;
      } catch (e) {
        return true;
      }
    });
}
