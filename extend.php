<?php

/*
 * Segue — a loading screen in place of the blank flash while the forum
 * starts, and page transitions where titles and avatars glide between pages.
 *
 * The loading screen is drawn by CSS on <body> before any JavaScript runs:
 * the server only adds a class to <html> and a few custom properties. The
 * transitions are the browser's own View Transitions.
 */

use ErnestDefoe\Segue\Api\IconsController;
use ErnestDefoe\Segue\Content\Head;
use ErnestDefoe\Segue\Settings;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less')
        ->content(Head::class),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Routes('api'))
        ->post('/segue/icons', 'segue.icons.upload', IconsController::class)
        ->delete('/segue/icons/{name:[a-z0-9]+\.(?:gif|webp)}', 'segue.icons.delete', IconsController::class),

    // Keys written out, not Settings::*: reading the class here would load it
    // while the forum boots, and fatal every request mid-deploy.
    (new Extend\Settings())
        ->default('ernestdefoe-segue.loader', true)
        ->default('ernestdefoe-segue.icon', 'ring')
        ->default('ernestdefoe-segue.size', 'medium')
        ->default('ernestdefoe-segue.color', '')
        ->default('ernestdefoe-segue.icons', '[]')
        ->default('ernestdefoe-segue.transitions', 'glide')
        ->default('ernestdefoe-segue.duration', '0.5')
        ->default('ernestdefoe-segue.exclude', '')
        ->default('ernestdefoe-segue.full_page', true)
        ->serializeToForum('segueTransitions', 'ernestdefoe-segue.transitions')
        ->serializeToForum('segueExclude', 'ernestdefoe-segue.exclude', [Settings::class, 'selectorLines']),
];
