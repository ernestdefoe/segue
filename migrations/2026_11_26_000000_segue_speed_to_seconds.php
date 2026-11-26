<?php

/*
 * Transition speed (Fast / Normal / Slow) became a time in seconds. A forum
 * that chose Fast or Slow keeps the same pace; Normal is the new default.
 */

use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $settings = $schema->getConnection()->table('settings');
        $speed = (clone $settings)->where('key', 'ernestdefoe-segue.speed')->value('value');
        $seconds = match ($speed) {
            'fast' => '0.35',
            'slow' => '0.7',
            default => null,
        };

        if ($seconds !== null) {
            (clone $settings)->updateOrInsert(['key' => 'ernestdefoe-segue.duration'], ['value' => $seconds]);
        }

        (clone $settings)->where('key', 'ernestdefoe-segue.speed')->delete();
    },

    'down' => function (Builder $schema) {
        $settings = $schema->getConnection()->table('settings');
        $seconds = (float) (clone $settings)->where('key', 'ernestdefoe-segue.duration')->value('value');
        $speed = match (true) {
            $seconds > 0 && $seconds < 0.45 => 'fast',
            $seconds > 0.55 => 'slow',
            default => null,
        };

        if ($speed !== null) {
            (clone $settings)->updateOrInsert(['key' => 'ernestdefoe-segue.speed'], ['value' => $speed]);
        }

        (clone $settings)->where('key', 'ernestdefoe-segue.duration')->delete();
    },
];
