import app from 'flarum/admin/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';
import type Stream from 'flarum/common/utils/Stream';

const BUILT_IN = ['ring', 'dots', 'bars', 'pulse', 'orbit', 'logo'];
const ICONS = 'ernestdefoe-segue.icons';

/**
 * The loading icon setting: a tile for every icon, each one running, with
 * the chosen one outlined. Admins add their own icons from the last tile;
 * uploads are saved at once (the choice itself waits for Save Changes).
 *
 * attrs.icon and attrs.color are the page's setting streams.
 */
export interface IconPickerAttrs extends ComponentAttrs {
  icon: Stream<string>;
  color: Stream<string>;
}

interface IconsResponse {
  icons: string[];
  added?: string;
}

const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans('ernestdefoe-segue.admin.icons.' + key, params);

export default class IconPicker extends Component<IconPickerAttrs> {
  private uploading = false;

  view() {
    const logo = app.forum.attribute<string | null>('logoUrl');

    return (
      <div className="Form-group SegueIconsGroup">
        <label>{t('label')}</label>
        <div className="helpText">{t('help')}</div>
        <div className="SegueIcons">
          {BUILT_IN.map((name) =>
            name === 'logo'
              ? logo && this.tile('logo', t('logo'), <span className="SegueIcon SegueIcon--logo" style={{ '--segue-image': cssUrl(logo) }} />)
              : this.tile(name, t(name), <span className={'SegueIcon SegueIcon--' + name} />)
          )}
          {this.uploads().map((name, i) =>
            this.tile(
              'file:' + name,
              t('custom', { number: i + 1 }),
              <span className="SegueIcon SegueIcon--image" style={{ '--segue-image': cssUrl(this.url(name)) }} />,
              <Button
                className="Button Button--icon Button--link SegueIcons-remove"
                icon="fas fa-times"
                aria-label={t('remove')}
                onclick={() => this.remove(name)}
              />
            )
          )}
          {this.uploadTile()}
        </div>
        <div className="helpText">{t('upload_help')}</div>
      </div>
    );
  }

  /** One icon: a button that picks it, showing it running in the chosen color. */
  tile(value: string, label: Mithril.Children, preview: Mithril.Children, extra?: Mithril.Children) {
    const chosen = this.attrs.icon() === value;
    const color = this.attrs.color();
    const style: Record<string, string> = /^#(?:[0-9a-f]{3}){1,2}$/i.test(color || '') ? { '--segue-color': color } : {};

    return (
      <div className="SegueIcons-cell">
        <button
          type="button"
          className={'SegueIcons-tile' + (chosen ? ' is-active' : '')}
          aria-pressed={chosen ? 'true' : 'false'}
          onclick={() => this.attrs.icon(value)}
        >
          <span className="SegueIcons-preview" style={style}>
            {preview}
          </span>
          <span className="SegueIcons-label">{label}</span>
        </button>
        {extra}
      </div>
    );
  }

  uploadTile() {
    return (
      <div className="SegueIcons-cell">
        <label className={'SegueIcons-tile SegueIcons-upload' + (this.uploading ? ' disabled' : '')}>
          <span className="SegueIcons-preview">
            <Icon name={this.uploading ? 'fas fa-spinner fa-spin' : 'fas fa-upload'} />
          </span>
          <span className="SegueIcons-label">{t('upload')}</span>
          <input
            type="file"
            accept="image/gif,image/png,image/webp,image/jpeg"
            hidden
            disabled={this.uploading}
            onchange={(e: Event) => this.upload(e.target as HTMLInputElement)}
          />
        </label>
      </div>
    );
  }

  uploads(): string[] {
    try {
      const icons = JSON.parse(app.data.settings[ICONS] || '[]');
      return Array.isArray(icons) ? icons : [];
    } catch (e) {
      return [];
    }
  }

  url(name: string): string {
    return app.forum.attribute('assetsBaseUrl') + '/segue/' + name;
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const body = new FormData();
    body.append('icon', file);

    this.uploading = true;
    app
      .request<IconsResponse>({ method: 'POST', url: app.forum.attribute('apiUrl') + '/segue/icons', serialize: (raw: FormData) => raw, body })
      .then((response) => {
        this.saved(response.icons);
        // Picking what was just added is almost always the point of adding it.
        if (response.added) this.attrs.icon('file:' + response.added);
      })
      .catch(() => {
        /* app.request already showed the error */
      })
      .finally(() => {
        this.uploading = false;
        m.redraw();
      });
  }

  remove(name: string): void {
    app
      .request<IconsResponse>({ method: 'DELETE', url: app.forum.attribute('apiUrl') + '/segue/icons/' + name })
      .then((response) => {
        this.saved(response.icons);
        if (this.attrs.icon() === 'file:' + name) this.attrs.icon('ring');
        m.redraw();
      })
      .catch(() => {
        /* app.request already showed the error */
      });
  }

  saved(icons: string[]): void {
    app.data.settings[ICONS] = JSON.stringify(icons);
  }
}

// Our URLs never hold a quote, but keep url("") closed whatever they hold.
function cssUrl(url: string): string {
  return 'url("' + String(url).replace(/["\\\n]/g, encodeURIComponent) + '")';
}
