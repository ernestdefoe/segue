<?php

namespace ErnestDefoe\Segue;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Segue's settings, read and cleaned in one place.
 */
class Settings
{
    public const LOADER = 'ernestdefoe-segue.loader';
    public const ICON = 'ernestdefoe-segue.icon';
    public const SIZE = 'ernestdefoe-segue.size';
    public const COLOR = 'ernestdefoe-segue.color';
    public const ICONS = 'ernestdefoe-segue.icons';
    public const TRANSITIONS = 'ernestdefoe-segue.transitions';
    public const DURATION = 'ernestdefoe-segue.duration';
    public const EXCLUDE = 'ernestdefoe-segue.exclude';
    public const FULL_PAGE = 'ernestdefoe-segue.full_page';

    /** The icons drawn in CSS, plus the forum's own logo. */
    public const BUILT_IN = ['ring', 'dots', 'bars', 'pulse', 'orbit', 'logo'];

    public const SIZES = ['small' => 32, 'medium' => 48, 'large' => 72];

    /** Transition time in seconds: the base the CSS durations are written for, and the range allowed. */
    public const BASE_SECONDS = 0.5;
    public const MIN_SECONDS = 0.2;
    public const MAX_SECONDS = 2.0;

    /** Excluded selectors: one per line, at most this many lines of this length. */
    public const MAX_SELECTORS = 20;
    public const MAX_SELECTOR_LENGTH = 200;

    /** Where uploaded icons live on the flarum-assets disk. */
    public const DIR = 'segue';

    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    public function loader(): bool
    {
        return (bool) $this->settings->get(self::LOADER);
    }

    /** @return list<string> uploaded icon file names, newest last */
    public function icons(): array
    {
        $icons = json_decode((string) $this->settings->get(self::ICONS), true);

        return is_array($icons) ? array_values(array_filter($icons, [self::class, 'isIconName'])) : [];
    }

    /** @param list<string> $icons */
    public function saveIcons(array $icons): void
    {
        $this->settings->set(self::ICONS, json_encode(array_values($icons)));
    }

    /**
     * The chosen icon: a built-in name or "file:<name>" for an upload that
     * still exists. Anything else falls back to the ring.
     */
    public function icon(): string
    {
        $icon = (string) $this->settings->get(self::ICON);

        if (in_array($icon, self::BUILT_IN, true)) {
            return $icon;
        }

        if (str_starts_with($icon, 'file:') && in_array(substr($icon, 5), $this->icons(), true)) {
            return $icon;
        }

        return 'ring';
    }

    public function size(): int
    {
        return self::SIZES[$this->settings->get(self::SIZE)] ?? self::SIZES['medium'];
    }

    /** A #rgb or #rrggbb colour, or null to follow the forum's primary colour. */
    public function color(): ?string
    {
        $color = trim((string) $this->settings->get(self::COLOR));

        return preg_match('/^#(?:[0-9a-f]{3}){1,2}$/i', $color) ? $color : null;
    }

    public function transitions(): string
    {
        $value = $this->settings->get(self::TRANSITIONS);

        return in_array($value, ['glide', 'fade', 'off'], true) ? $value : 'glide';
    }

    /** How long a page transition takes, in seconds, kept within the allowed range. */
    public function duration(): float
    {
        $seconds = (float) $this->settings->get(self::DURATION);

        return $seconds > 0 ? max(self::MIN_SECONDS, min(self::MAX_SECONDS, $seconds)) : self::BASE_SECONDS;
    }

    /** What every duration in forum.less is multiplied by (--segue-k). */
    public function scale(): float
    {
        return round($this->duration() / self::BASE_SECONDS, 3);
    }

    /**
     * The selectors of elements that stay still during a transition, one per
     * line. Only trimmed and capped here: the browser is the judge of what a
     * valid selector is, so forum.js tests each one and skips the bad ones.
     *
     * @return list<string>
     */
    public static function selectorLines(mixed $value): array
    {
        $lines = preg_split('/\R/', is_string($value) ? $value : '') ?: [];
        $lines = array_map('trim', $lines);
        $lines = array_filter($lines, fn (string $line) => $line !== '' && mb_strlen($line) <= self::MAX_SELECTOR_LENGTH);

        return array_slice(array_values(array_unique($lines)), 0, self::MAX_SELECTORS);
    }

    public function fullPage(): bool
    {
        return (bool) $this->settings->get(self::FULL_PAGE) && $this->transitions() !== 'off';
    }

    public static function isIconName(mixed $name): bool
    {
        return is_string($name) && (bool) preg_match('/^[a-z0-9]{20}\.(?:gif|webp)$/', $name);
    }
}
