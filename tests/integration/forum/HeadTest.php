<?php

namespace ErnestDefoe\Segue\Tests\integration\forum;

use ErnestDefoe\Segue\Settings;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

class HeadTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-segue');
    }

    private function page(): string
    {
        $response = $this->send($this->request('GET', '/'));
        $this->assertSame(200, $response->getStatusCode());

        return (string) $response->getBody();
    }

    #[Test]
    public function the_loading_screen_goes_up_before_the_stylesheet()
    {
        $html = $this->page();

        $script = strpos($html, 'classList.add("segue-loading")');
        $this->assertNotFalse($script);
        $this->assertLessThan(strpos($html, 'rel="stylesheet"'), $script);
        $this->assertStringContainsString('"data-segue-icon","ring"', $html);
        $this->assertStringContainsString('--segue-size:48px', $html);
        $this->assertStringContainsString('@view-transition{navigation:auto}', $html);
    }

    #[Test]
    public function bad_settings_fall_back_to_safe_values()
    {
        $this->setting(Settings::ICON, 'file:../../etc/passwd');
        $this->setting(Settings::COLOR, 'red;}</style><script>alert(1)</script>');
        $this->setting(Settings::SIZE, 'enormous');

        $html = $this->page();

        $this->assertStringContainsString('"data-segue-icon","ring"', $html);
        $this->assertStringNotContainsString('alert(1)', $html);
        $this->assertStringNotContainsString('--segue-color', $html);
        $this->assertStringContainsString('--segue-size:48px', $html);
    }

    #[Test]
    public function turning_the_loading_screen_and_transitions_off_leaves_the_page_alone()
    {
        $this->setting(Settings::LOADER, false);
        $this->setting(Settings::TRANSITIONS, 'off');

        $html = $this->page();

        $this->assertStringNotContainsString('segue-loading', $html);
        $this->assertStringNotContainsString('@view-transition', $html);
    }

    public static function durations(): array
    {
        return [
            'default' => [null, '1'],
            'slower' => ['1.5', '3'],
            'too long' => ['60', '4'],
            'too short' => ['0.01', '0.4'],
            'not a number' => ['soon;}</style>', '1'],
        ];
    }

    #[Test]
    #[DataProvider('durations')]
    public function the_transition_time_scales_every_duration_within_range(?string $seconds, string $scale)
    {
        if ($seconds !== null) {
            $this->setting(Settings::DURATION, $seconds);
        }

        $html = $this->page();

        $this->assertStringContainsString('--segue-k:'.$scale.';', $html);
        $this->assertStringNotContainsString('soon', $html);
    }

    #[Test]
    public function excluded_selectors_reach_the_forum_one_per_line()
    {
        $this->setting(Settings::EXCLUDE, "  .TopBar \r\n\n#banner\n.TopBar\n".str_repeat('a', 201)."\n:is(");

        $response = $this->send($this->request('GET', '/api'));
        $forum = json_decode((string) $response->getBody(), true)['data']['attributes'];

        // Trimmed, de-duplicated, overlong lines dropped; validity is the browser's call.
        $this->assertSame(['.TopBar', '#banner', ':is('], $forum['segueExclude']);
    }

    #[Test]
    public function at_most_twenty_selectors_are_kept()
    {
        $this->assertCount(20, Settings::selectorLines(implode("\n", array_map(fn ($i) => ".a$i", range(1, 30)))));
        $this->assertSame([], Settings::selectorLines(null));
    }

    #[Test]
    public function the_old_speed_choice_becomes_seconds()
    {
        $migration = require __DIR__.'/../../../migrations/2026_11_26_000000_segue_speed_to_seconds.php';
        $settings = fn () => $this->database()->table('settings');

        $settings()->insert(['key' => 'ernestdefoe-segue.speed', 'value' => 'slow']);
        $migration['up']($this->database()->getSchemaBuilder());

        $this->assertSame('0.7', $settings()->where('key', Settings::DURATION)->value('value'));
        $this->assertNull($settings()->where('key', 'ernestdefoe-segue.speed')->value('value'));

        $migration['down']($this->database()->getSchemaBuilder());
        $this->assertSame('slow', $settings()->where('key', 'ernestdefoe-segue.speed')->value('value'));
        $this->assertNull($settings()->where('key', Settings::DURATION)->value('value'));
    }
}
