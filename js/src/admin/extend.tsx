import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import type ExtensionPage from 'flarum/admin/components/ExtensionPage';
import IconPicker from './components/IconPicker';
import ExcludeField from './components/ExcludeField';

const KEY = 'ernestdefoe-segue.';

const t = (key: string) => app.translator.trans('ernestdefoe-segue.admin.' + key);
const options = (key: string, values: string[]) => Object.fromEntries(values.map((value) => [value, t(key + '.' + value)]));

export default [
  new Extend.Admin()
    .setting(() => ({ setting: KEY + 'loader', type: 'switch', label: t('loader_label'), help: t('loader_help') }), 100)
    .customSetting(function (this: ExtensionPage) {
      return <IconPicker icon={this.setting(KEY + 'icon')} color={this.setting(KEY + 'color')} />;
    }, 90)
    .setting(() => ({ setting: KEY + 'size', type: 'select', label: t('size_label'), options: options('size', ['small', 'medium', 'large']) }), 80)
    .setting(() => ({ setting: KEY + 'color', type: 'color-preview', label: t('color_label'), help: t('color_help') }), 70)
    .setting(
      () => ({
        setting: KEY + 'transitions',
        type: 'select',
        label: t('transitions_label'),
        help: t('transitions_help'),
        options: options('transitions', ['glide', 'fade', 'off']),
      }),
      60
    )
    .setting(
      () => ({
        setting: KEY + 'duration',
        type: 'number',
        min: 0.2,
        max: 2,
        step: 0.05,
        label: t('duration_label'),
        help: t('duration_help'),
      }),
      50
    )
    .customSetting(function (this: ExtensionPage) {
      return <ExcludeField stream={this.setting(KEY + 'exclude')} />;
    }, 40)
    .setting(() => ({ setting: KEY + 'full_page', type: 'switch', label: t('full_page_label'), help: t('full_page_help') }), 30),
];
